import { afterEach, describe, expect, test } from 'bun:test'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { runRevStt } from '~/cli/commands/process-steps/step-2-stt/stt-services/rev/run-rev-stt'
import { readProviderCheckpointMetadata, writeProviderCheckpointFixture } from '../../test-utils/manifest-helpers'

const originalFetch = globalThis.fetch
const originalAccessToken = process.env['REVAI_ACCESS_TOKEN']
const originalBaseUrl = process.env['REVAI_BASE_URL']
const originalBunSleep = Bun.sleep
const tempDirs: string[] = []

const createAudioFixture = async (): Promise<{ audioPath: string, outputDir: string }> => {
  const outputDir = await mkdtemp(join(tmpdir(), 'autoshow-rev-stt-'))
  tempDirs.push(outputDir)

  const audioPath = join(outputDir, 'sample.wav')
  await Bun.write(audioPath, new Uint8Array(2048).fill(1))

  return { audioPath, outputDir }
}

afterEach(async () => {
  globalThis.fetch = originalFetch
  ;(Bun as typeof Bun & { sleep: typeof Bun.sleep }).sleep = originalBunSleep

  if (originalAccessToken === undefined) {
    delete process.env['REVAI_ACCESS_TOKEN']
  } else {
    process.env['REVAI_ACCESS_TOKEN'] = originalAccessToken
  }

  if (originalBaseUrl === undefined) {
    delete process.env['REVAI_BASE_URL']
  } else {
    process.env['REVAI_BASE_URL'] = originalBaseUrl
  }

  await Promise.all(tempDirs.splice(0).map(async (dir) => {
    await rm(dir, { recursive: true, force: true })
  }))
})

describe('runRevStt', () => {
  test('retries transient create and poll failures, normalizes transcript monologues, and records cleanup metadata', async () => {
    const { audioPath, outputDir } = await createAudioFixture()
    process.env['REVAI_ACCESS_TOKEN'] = 'test-token'
    process.env['REVAI_BASE_URL'] = 'https://rev.test'

    let createAttempts = 0
    let pollAttempts = 0
    let deleteAttempts = 0

    globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input)
      const method = init?.method ?? 'GET'

      if (url === 'https://rev.test/jobs' && method === 'POST') {
        createAttempts += 1
        if (createAttempts === 1) {
          return new Response('throttled', { status: 429, headers: { 'retry-after': '0' } })
        }
        if (createAttempts === 2) {
          return new Response('bad gateway', { status: 502, headers: { 'retry-after': '0' } })
        }
        if (createAttempts === 3) {
          return new Response('unavailable', { status: 503, headers: { 'retry-after': '0' } })
        }

        expect(init?.body).toBeInstanceOf(FormData)
        const body = init?.body as FormData
        expect(body.get('media')).toBeTruthy()
        expect(JSON.parse(String(body.get('options')))).toEqual({
          transcriber: 'machine',
          remove_disfluencies: true
        })

        return new Response(JSON.stringify({
          id: 'job-123',
          status: 'in_progress'
        }), {
          status: 200,
          headers: { 'content-type': 'application/json' }
        })
      }

      if (url === 'https://rev.test/jobs/job-123' && method === 'GET') {
        pollAttempts += 1
        if (pollAttempts === 1) {
          return new Response('bad gateway', { status: 502, headers: { 'retry-after': '0' } })
        }

        return new Response(JSON.stringify({
          id: 'job-123',
          status: 'transcribed'
        }), {
          status: 200,
          headers: {
            'content-type': 'application/json',
            'retry-after': '0'
          }
        })
      }

      if (url === 'https://rev.test/jobs/job-123/transcript' && method === 'GET') {
        expect(init?.headers).toEqual(expect.objectContaining({
          Authorization: 'Bearer test-token',
          Accept: 'application/vnd.rev.transcript.v1.0+json'
        }))

        return new Response(JSON.stringify({
          monologues: [
            {
              speaker: 0,
              elements: [
                { type: 'text', value: 'Hello', ts: 0, end_ts: 0.3 },
                { type: 'punct', value: ',' },
                { type: 'punct', value: ' ' },
                { type: 'text', value: 'there', ts: 0.31, end_ts: 0.7 },
                { type: 'punct', value: '.' }
              ]
            },
            {
              speaker: 1,
              elements: []
            },
            {
              speaker: 2,
              elements: [
                { type: 'text', value: 'General', ts: 1.0, end_ts: 1.4 },
                { type: 'punct', value: ' ' },
                { type: 'text', value: 'Kenobi', ts: 1.41, end_ts: 1.9 },
                { type: 'punct', value: '!' }
              ]
            }
          ]
        }), {
          status: 200,
          headers: { 'content-type': 'application/json' }
        })
      }

      if (url === 'https://rev.test/jobs/job-123' && method === 'DELETE') {
        deleteAttempts += 1
        return new Response(null, { status: 204 })
      }

      throw new Error(`Unexpected fetch: ${method} ${url}`)
    }) as unknown as typeof fetch

    const { result, metadata } = await runRevStt(audioPath, outputDir, {
      model: 'machine',
      segmentOffsetMinutes: 0
    })

    expect(createAttempts).toBe(4)
    expect(pollAttempts).toBe(2)
    expect(deleteAttempts).toBe(1)
    expect(result.text).toBe('Hello, there. General Kenobi!')
    expect(result.segments).toEqual([
      { start: '00:00:00', end: '00:00:00', text: 'Hello, there.', speaker: 'speaker-0' },
      { start: '00:00:01', end: '00:00:01', text: 'General Kenobi!', speaker: 'speaker-2' }
    ])
    expect(metadata.transcriptionService).toBe('rev')
    expect(metadata.transcriptionModel).toBe('machine')
    expect(metadata.runtime?.stage).toBe('cleanup-complete')
    expect(metadata.runtime?.cleanup?.remoteJobDeleted).toBe(true)
    expect(metadata.timings?.retryCount).toBeGreaterThan(0)

    const transcript = await Bun.file(`${outputDir}/transcription.txt`).text()
    expect(transcript).toContain('[speaker-0] Hello, there.')
    expect(transcript).toContain('[speaker-2] General Kenobi!')
  })

  test('sends low_cost to the Rev transcriber when requested', async () => {
    const { audioPath, outputDir } = await createAudioFixture()
    process.env['REVAI_ACCESS_TOKEN'] = 'test-token'
    process.env['REVAI_BASE_URL'] = 'https://rev.test'

    let deleteAttempts = 0

    globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input)
      const method = init?.method ?? 'GET'

      if (url === 'https://rev.test/jobs' && method === 'POST') {
        expect(init?.body).toBeInstanceOf(FormData)
        const body = init?.body as FormData
        expect(JSON.parse(String(body.get('options')))).toEqual({
          transcriber: 'low_cost',
          remove_disfluencies: true
        })

        return new Response(JSON.stringify({
          id: 'job-low-cost',
          status: 'in_progress'
        }), {
          status: 200,
          headers: { 'content-type': 'application/json' }
        })
      }

      if (url === 'https://rev.test/jobs/job-low-cost' && method === 'GET') {
        return new Response(JSON.stringify({
          id: 'job-low-cost',
          status: 'transcribed'
        }), {
          status: 200,
          headers: { 'content-type': 'application/json' }
        })
      }

      if (url === 'https://rev.test/jobs/job-low-cost/transcript' && method === 'GET') {
        return new Response(JSON.stringify({
          monologues: [
            {
              speaker: 0,
              elements: [
                { type: 'text', value: 'Turbo', ts: 0, end_ts: 0.4 },
                { type: 'punct', value: ' ' },
                { type: 'text', value: 'mode', ts: 0.41, end_ts: 0.8 },
                { type: 'punct', value: '.' }
              ]
            }
          ]
        }), {
          status: 200,
          headers: { 'content-type': 'application/json' }
        })
      }

      if (url === 'https://rev.test/jobs/job-low-cost' && method === 'DELETE') {
        deleteAttempts += 1
        return new Response(null, { status: 204 })
      }

      throw new Error(`Unexpected fetch: ${method} ${url}`)
    }) as unknown as typeof fetch

    const { result, metadata } = await runRevStt(audioPath, outputDir, {
      model: 'low_cost',
      segmentOffsetMinutes: 0
    })

    expect(result.text).toBe('Turbo mode.')
    expect(metadata.transcriptionService).toBe('rev')
    expect(metadata.transcriptionModel).toBe('low_cost')
    expect(metadata.runtime?.cleanup?.remoteJobDeleted).toBe(true)
    expect(deleteAttempts).toBe(1)
  })

  test('uses the default Rev API base path when REVAI_BASE_URL is unset', async () => {
    const { audioPath, outputDir } = await createAudioFixture()
    process.env['REVAI_ACCESS_TOKEN'] = 'test-token'
    delete process.env['REVAI_BASE_URL']

    const requests: string[] = []

    globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input)
      const method = init?.method ?? 'GET'
      requests.push(`${method} ${url}`)

      if (url === 'https://api.rev.ai/speechtotext/v1/jobs' && method === 'POST') {
        return new Response(JSON.stringify({
          id: 'job-default',
          status: 'in_progress'
        }), {
          status: 200,
          headers: { 'content-type': 'application/json' }
        })
      }

      if (url === 'https://api.rev.ai/speechtotext/v1/jobs/job-default' && method === 'GET') {
        return new Response(JSON.stringify({
          id: 'job-default',
          status: 'transcribed'
        }), {
          status: 200,
          headers: { 'content-type': 'application/json' }
        })
      }

      if (url === 'https://api.rev.ai/speechtotext/v1/jobs/job-default/transcript' && method === 'GET') {
        return new Response(JSON.stringify({
          monologues: [
            {
              speaker: 0,
              elements: [
                { type: 'text', value: 'Default', ts: 0, end_ts: 0.3 },
                { type: 'punct', value: ' ' },
                { type: 'text', value: 'base', ts: 0.31, end_ts: 0.6 },
                { type: 'punct', value: ' ' },
                { type: 'text', value: 'works', ts: 0.61, end_ts: 1.0 },
                { type: 'punct', value: '.' }
              ]
            }
          ]
        }), {
          status: 200,
          headers: { 'content-type': 'application/json' }
        })
      }

      if (url === 'https://api.rev.ai/speechtotext/v1/jobs/job-default' && method === 'DELETE') {
        return new Response(null, { status: 204 })
      }

      throw new Error(`Unexpected fetch: ${method} ${url}`)
    }) as unknown as typeof fetch

    const { result, metadata } = await runRevStt(audioPath, outputDir, {
      model: 'machine',
      segmentOffsetMinutes: 0
    })

    expect(result.text).toBe('Default base works.')
    expect(metadata.runtime?.cleanup?.remoteJobDeleted).toBe(true)
    expect(requests).toEqual([
      'POST https://api.rev.ai/speechtotext/v1/jobs',
      'GET https://api.rev.ai/speechtotext/v1/jobs/job-default',
      'GET https://api.rev.ai/speechtotext/v1/jobs/job-default/transcript',
      'DELETE https://api.rev.ai/speechtotext/v1/jobs/job-default'
    ])
  })

  test('reuses a persisted Rev job with bounded resume probes and no new create request', async () => {
    const { audioPath, outputDir } = await createAudioFixture()
    process.env['REVAI_ACCESS_TOKEN'] = 'test-token'
    process.env['REVAI_BASE_URL'] = 'https://rev.test'

    await writeProviderCheckpointFixture(outputDir, 'rev', 'machine', {
      transcriptionService: 'rev',
      transcriptionModel: 'machine',
      processingTime: 10,
      tokenCount: 0,
      runtime: {
        mode: 'fresh',
        stage: 'polling',
        remoteJobId: 'job-existing',
        createCompletedAt: '2026-04-15T00:00:00.000Z'
      }
    })

    const slept: number[] = []
    ;(Bun as typeof Bun & { sleep: typeof Bun.sleep }).sleep = (async (ms: number) => {
      slept.push(ms)
    }) as typeof Bun.sleep

    let createAttempts = 0
    let pollAttempts = 0

    globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input)
      const method = init?.method ?? 'GET'

      if (url === 'https://rev.test/jobs' && method === 'POST') {
        createAttempts += 1
        throw new Error('unexpected create')
      }

      if (url === 'https://rev.test/jobs/job-existing' && method === 'GET') {
        pollAttempts += 1
        return new Response(JSON.stringify({
          id: 'job-existing',
          status: 'in_progress'
        }), {
          status: 200,
          headers: { 'content-type': 'application/json' }
        })
      }

      throw new Error(`Unexpected fetch: ${method} ${url}`)
    }) as unknown as typeof fetch

    await expect(
      runRevStt(audioPath, outputDir, {
        model: 'machine',
        segmentOffsetMinutes: 0,
        runMode: 'backfill'
      })
    ).rejects.toThrow('still pending after 5 resume status checks')

    expect(createAttempts).toBe(0)
    expect(pollAttempts).toBe(5)
    expect(slept).toEqual([30_000, 60_000, 120_000, 240_000])

    const metadata = await readProviderCheckpointMetadata(outputDir)
    expect(metadata['runtime']).toEqual(expect.objectContaining({
      mode: 'resumed',
      stage: 'polling',
      remoteJobId: 'job-existing'
    }))
  })

  test('cleans up a terminally failed job and persists cleanup metadata', async () => {
    const { audioPath, outputDir } = await createAudioFixture()
    process.env['REVAI_ACCESS_TOKEN'] = 'test-token'
    process.env['REVAI_BASE_URL'] = 'https://rev.test'

    let deleteAttempts = 0

    globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input)
      const method = init?.method ?? 'GET'

      if (url === 'https://rev.test/jobs' && method === 'POST') {
        return new Response(JSON.stringify({
          id: 'job-failed',
          status: 'in_progress'
        }), {
          status: 200,
          headers: { 'content-type': 'application/json' }
        })
      }

      if (url === 'https://rev.test/jobs/job-failed' && method === 'GET') {
        return new Response(JSON.stringify({
          id: 'job-failed',
          status: 'failed',
          failure: 'download_failure',
          failure_detail: 'Source media could not be processed'
        }), {
          status: 200,
          headers: { 'content-type': 'application/json' }
        })
      }

      if (url === 'https://rev.test/jobs/job-failed' && method === 'DELETE') {
        deleteAttempts += 1
        return new Response(null, { status: 204 })
      }

      throw new Error(`Unexpected fetch: ${method} ${url}`)
    }) as unknown as typeof fetch

    await expect(
      runRevStt(audioPath, outputDir, {
        model: 'machine',
        segmentOffsetMinutes: 0
      })
    ).rejects.toThrow('Source media could not be processed')

    expect(deleteAttempts).toBe(1)

    const metadata = await readProviderCheckpointMetadata(outputDir)
    expect(metadata['runtime']).toEqual(expect.objectContaining({
      stage: 'cleanup-complete',
      remoteJobId: 'job-failed',
      cleanup: expect.objectContaining({
        remoteJobDeleted: true
      })
    }))
  })
})
