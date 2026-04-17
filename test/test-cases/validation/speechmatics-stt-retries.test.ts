import { afterEach, describe, expect, test } from 'bun:test'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { runSpeechmaticsStt } from '~/cli/commands/process-steps/step-2-stt/stt-services/speechmatics/run-speechmatics-stt'
import { readProviderCheckpointMetadata, writeProviderCheckpointFixture } from '../../test-utils/manifest-helpers'

const originalFetch = globalThis.fetch
const originalApiKey = process.env['SPEECHMATICS_API_KEY']
const originalBaseUrl = process.env['SPEECHMATICS_BASE_URL']
const originalPollDeadline = process.env['AUTOSHOW_STT_POLL_DEADLINE_MS_SPEECHMATICS']
const originalBunSleep = Bun.sleep
const tempDirs: string[] = []

const createAudioFixture = async (): Promise<{ audioPath: string, outputDir: string }> => {
  const outputDir = await mkdtemp(join(tmpdir(), 'autoshow-speechmatics-stt-'))
  tempDirs.push(outputDir)

  const audioPath = join(outputDir, 'sample.wav')
  await Bun.write(audioPath, new Uint8Array(2048).fill(1))

  return { audioPath, outputDir }
}

afterEach(async () => {
  globalThis.fetch = originalFetch
  ;(Bun as typeof Bun & { sleep: typeof Bun.sleep }).sleep = originalBunSleep

  if (originalApiKey === undefined) {
    delete process.env['SPEECHMATICS_API_KEY']
  } else {
    process.env['SPEECHMATICS_API_KEY'] = originalApiKey
  }

  if (originalBaseUrl === undefined) {
    delete process.env['SPEECHMATICS_BASE_URL']
  } else {
    process.env['SPEECHMATICS_BASE_URL'] = originalBaseUrl
  }

  if (originalPollDeadline === undefined) {
    delete process.env['AUTOSHOW_STT_POLL_DEADLINE_MS_SPEECHMATICS']
  } else {
    process.env['AUTOSHOW_STT_POLL_DEADLINE_MS_SPEECHMATICS'] = originalPollDeadline
  }

  await Promise.all(tempDirs.splice(0).map(async (dir) => {
    await rm(dir, { recursive: true, force: true })
  }))
})

describe('runSpeechmaticsStt', () => {
  test('retries a transient create failure, parses speaker labels, and cleans up the remote job', async () => {
    const { audioPath, outputDir } = await createAudioFixture()
    process.env['SPEECHMATICS_API_KEY'] = 'test-key'
    process.env['SPEECHMATICS_BASE_URL'] = 'https://speechmatics.test'

    let createAttempts = 0
    let pollAttempts = 0
    let transcriptAttempts = 0
    let deleteAttempts = 0

    globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input)
      const method = init?.method ?? 'GET'

      if (url === 'https://speechmatics.test/v2/jobs' && method === 'POST') {
        createAttempts += 1
        if (createAttempts === 1) {
          return new Response('bad gateway', {
            status: 502,
            headers: { 'retry-after': '0' }
          })
        }

        return new Response(JSON.stringify({
          id: 'job-123'
        }), {
          status: 200,
          headers: { 'content-type': 'application/json' }
        })
      }

      if (url === 'https://speechmatics.test/v2/jobs/job-123' && method === 'GET') {
        pollAttempts += 1
        return new Response(JSON.stringify({
          job: {
            id: 'job-123',
            status: 'done'
          }
        }), {
          status: 200,
          headers: {
            'content-type': 'application/json',
            'retry-after': '0'
          }
        })
      }

      if (url === 'https://speechmatics.test/v2/jobs/job-123/transcript?format=json-v2' && method === 'GET') {
        transcriptAttempts += 1
        return new Response(JSON.stringify({
          format: '2.1',
          results: [
            { type: 'word', start_time: 0, end_time: 0.3, alternatives: [{ content: 'Hello', speaker: 'S1', confidence: 0.99, language: 'en' }] },
            { type: 'punctuation', start_time: 0.3, end_time: 0.3, alternatives: [{ content: ',', speaker: 'S1', confidence: 0.99, language: 'en' }] },
            { type: 'word', start_time: 0.31, end_time: 0.7, alternatives: [{ content: 'there', speaker: 'S1', confidence: 0.99, language: 'en' }] },
            { type: 'punctuation', start_time: 0.7, end_time: 0.7, is_eos: true, alternatives: [{ content: '.', speaker: 'S1', confidence: 0.99, language: 'en' }] },
            { type: 'word', start_time: 1.0, end_time: 1.4, alternatives: [{ content: 'Unknown', speaker: 'UU', confidence: 0.99, language: 'en' }] },
            { type: 'punctuation', start_time: 1.4, end_time: 1.4, is_eos: true, alternatives: [{ content: '.', speaker: 'UU', confidence: 0.99, language: 'en' }] }
          ]
        }), {
          status: 200,
          headers: { 'content-type': 'application/json' }
        })
      }

      if (url === 'https://speechmatics.test/v2/jobs/job-123' && method === 'DELETE') {
        deleteAttempts += 1
        return new Response(null, { status: 204 })
      }

      throw new Error(`Unexpected fetch: ${method} ${url}`)
    }) as unknown as typeof fetch

    const { result, metadata } = await runSpeechmaticsStt(audioPath, outputDir, {
      model: 'enhanced',
      segmentOffsetMinutes: 0
    })

    expect(createAttempts).toBe(2)
    expect(pollAttempts).toBe(1)
    expect(transcriptAttempts).toBe(1)
    expect(deleteAttempts).toBe(1)
    expect(result.text).toBe('Hello, there. Unknown.')
    expect(result.segments).toEqual([
      { start: '00:00:00', end: '00:00:00', text: 'Hello, there.', speaker: 'S1' },
      { start: '00:00:01', end: '00:00:01', text: 'Unknown.', speaker: 'UU' }
    ])
    expect(metadata.transcriptionService).toBe('speechmatics')
    expect(metadata.transcriptionModel).toBe('enhanced')
    expect(metadata.runtime?.stage).toBe('cleanup-complete')
    expect(metadata.runtime?.cleanup?.remoteJobDeleted).toBe(true)
  })

  test('reuses a persisted Speechmatics job with bounded resume probes and keeps the remote job when still running', async () => {
    const { audioPath, outputDir } = await createAudioFixture()
    process.env['SPEECHMATICS_API_KEY'] = 'test-key'
    process.env['SPEECHMATICS_BASE_URL'] = 'https://speechmatics.test'

    await writeProviderCheckpointFixture(outputDir, 'speechmatics', 'standard', {
      transcriptionService: 'speechmatics',
      transcriptionModel: 'standard',
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
    let deleteAttempts = 0

    globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input)
      const method = init?.method ?? 'GET'

      if (url === 'https://speechmatics.test/v2/jobs' && method === 'POST') {
        createAttempts += 1
        throw new Error('unexpected create')
      }

      if (url === 'https://speechmatics.test/v2/jobs/job-existing' && method === 'GET') {
        pollAttempts += 1
        return new Response(JSON.stringify({
          job: {
            id: 'job-existing',
            status: 'running'
          }
        }), {
          status: 200,
          headers: { 'content-type': 'application/json' }
        })
      }

      if (url === 'https://speechmatics.test/v2/jobs/job-existing' && method === 'DELETE') {
        deleteAttempts += 1
        return new Response(null, { status: 204 })
      }

      throw new Error(`Unexpected fetch: ${method} ${url}`)
    }) as unknown as typeof fetch

    await expect(
      runSpeechmaticsStt(audioPath, outputDir, {
        model: 'standard',
        segmentOffsetMinutes: 0,
        runMode: 'backfill'
      })
    ).rejects.toThrow('still pending after 5 resume status checks')

    expect(createAttempts).toBe(0)
    expect(pollAttempts).toBe(5)
    expect(deleteAttempts).toBe(0)
    expect(slept).toEqual([30_000, 60_000, 120_000, 240_000])

    const metadata = await readProviderCheckpointMetadata(outputDir)
    expect(metadata['runtime']).toEqual(expect.objectContaining({
      mode: 'resumed',
      stage: 'polling',
      remoteJobId: 'job-existing'
    }))
  })

  test('cleans up a terminally rejected job and surfaces the provider error', async () => {
    const { audioPath, outputDir } = await createAudioFixture()
    process.env['SPEECHMATICS_API_KEY'] = 'test-key'
    process.env['SPEECHMATICS_BASE_URL'] = 'https://speechmatics.test'

    let deleteAttempts = 0

    globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input)
      const method = init?.method ?? 'GET'

      if (url === 'https://speechmatics.test/v2/jobs' && method === 'POST') {
        return new Response(JSON.stringify({
          id: 'job-rejected'
        }), {
          status: 200,
          headers: { 'content-type': 'application/json' }
        })
      }

      if (url === 'https://speechmatics.test/v2/jobs/job-rejected' && method === 'GET') {
        return new Response(JSON.stringify({
          job: {
            id: 'job-rejected',
            status: 'rejected',
            errors: [
              { message: 'Unsupported model for this account' }
            ]
          }
        }), {
          status: 200,
          headers: { 'content-type': 'application/json' }
        })
      }

      if (url === 'https://speechmatics.test/v2/jobs/job-rejected' && method === 'DELETE') {
        deleteAttempts += 1
        return new Response(null, { status: 204 })
      }

      throw new Error(`Unexpected fetch: ${method} ${url}`)
    }) as unknown as typeof fetch

    await expect(
      runSpeechmaticsStt(audioPath, outputDir, {
        model: 'enhanced',
        segmentOffsetMinutes: 0
      })
    ).rejects.toThrow('Unsupported model for this account')

    expect(deleteAttempts).toBe(1)
  })
})
