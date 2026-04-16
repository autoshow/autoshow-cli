import { afterEach, describe, expect, test } from 'bun:test'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { runGladiaStt } from '~/cli/commands/process-steps/step-2-stt/stt-services/gladia/run-gladia-stt'

const originalFetch = globalThis.fetch
const originalApiKey = process.env['GLADIA_API_KEY']
const originalBaseUrl = process.env['GLADIA_BASE_URL']
const originalBunSleep = Bun.sleep
const tempDirs: string[] = []

const createAudioFixture = async (): Promise<{ audioPath: string, outputDir: string }> => {
  const outputDir = await mkdtemp(join(tmpdir(), 'autoshow-gladia-stt-'))
  tempDirs.push(outputDir)

  const audioPath = join(outputDir, 'sample.wav')
  await Bun.write(audioPath, new Uint8Array(2048).fill(1))

  return { audioPath, outputDir }
}

afterEach(async () => {
  globalThis.fetch = originalFetch
  ;(Bun as typeof Bun & { sleep: typeof Bun.sleep }).sleep = originalBunSleep

  if (originalApiKey === undefined) {
    delete process.env['GLADIA_API_KEY']
  } else {
    process.env['GLADIA_API_KEY'] = originalApiKey
  }

  if (originalBaseUrl === undefined) {
    delete process.env['GLADIA_BASE_URL']
  } else {
    process.env['GLADIA_BASE_URL'] = originalBaseUrl
  }

  await Promise.all(tempDirs.splice(0).map(async (dir) => {
    await rm(dir, { recursive: true, force: true })
  }))
})

describe('runGladiaStt', () => {
  test('retries a transient upload failure and completes successfully', async () => {
    const { audioPath, outputDir } = await createAudioFixture()
    process.env['GLADIA_API_KEY'] = 'test-key'
    process.env['GLADIA_BASE_URL'] = 'https://gladia.test'

    let uploadAttempts = 0
    let pollAttempts = 0
    globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input)

      if (url === 'https://gladia.test/v2/upload') {
        uploadAttempts += 1
        if (uploadAttempts === 1) {
          return new Response('bad gateway', {
            status: 502,
            headers: { 'retry-after': '0' }
          })
        }

        return new Response(JSON.stringify({
          audio_url: 'https://cdn.gladia.test/audio.wav',
          audio_metadata: {
            id: 'asset-123',
            filename: 'sample.wav',
            extension: 'wav',
            size: 2048,
            audio_duration: 3.2,
            number_of_channels: 1
          }
        }), {
          status: 200,
          headers: { 'content-type': 'application/json' }
        })
      }

      if (url === 'https://gladia.test/v2/pre-recorded' && init?.method === 'POST') {
        return new Response(JSON.stringify({
          id: 'tx-123',
          result_url: 'https://gladia.test/v2/pre-recorded/tx-123'
        }), {
          status: 200,
          headers: { 'content-type': 'application/json' }
        })
      }

      if (url === 'https://gladia.test/v2/pre-recorded/tx-123' && init?.method === 'GET') {
        pollAttempts += 1
        return new Response(JSON.stringify({
          id: 'tx-123',
          status: 'done',
          result: {
            transcription: {
              full_transcript: 'Hello world',
              utterances: [
                {
                  start: 0,
                  end: 0.9,
                  confidence: 0.9,
                  text: 'Hello world',
                  speaker: 1,
                  words: [
                    {
                      start: 0,
                      end: 0.4,
                      confidence: 0.95,
                      word: 'Hello'
                    },
                    {
                      start: 0.41,
                      end: 0.9,
                      confidence: 0.94,
                      word: 'world'
                    }
                  ]
                }
              ]
            }
          }
        }), {
          status: 200,
          headers: {
            'content-type': 'application/json',
            'retry-after': '0'
          }
        })
      }

      throw new Error(`Unexpected fetch: ${url}`)
    }) as unknown as typeof fetch

    const { result, metadata } = await runGladiaStt(audioPath, outputDir, {
      model: 'default',
      segmentOffsetMinutes: 0
    })

    expect(uploadAttempts).toBe(2)
    expect(pollAttempts).toBe(1)
    expect(result.text).toBe('Hello world')
    expect(metadata.transcriptionService).toBe('gladia')
    expect(metadata.transcriptionModel).toBe('default')
  })

  test('reuses a persisted Gladia job with bounded resume probes and no new transcription creation', async () => {
    const { audioPath, outputDir } = await createAudioFixture()
    process.env['GLADIA_API_KEY'] = 'test-key'
    process.env['GLADIA_BASE_URL'] = 'https://gladia.test'

    await Bun.write(join(outputDir, 'metadata.json'), JSON.stringify({
      transcriptionService: 'gladia',
      transcriptionModel: 'default',
      transcriptionModelName: 'default',
      processingTime: 10,
      tokenCount: 0,
      runtime: {
        mode: 'fresh',
        stage: 'polling',
        remoteJobId: 'tx-existing',
        remoteAssetId: 'asset-existing',
        remoteAssetUrl: 'https://cdn.gladia.test/audio.wav',
        createCompletedAt: '2026-04-14T00:00:00.000Z'
      }
    }, null, 2))

    const slept: number[] = []
    ;(Bun as typeof Bun & { sleep: typeof Bun.sleep }).sleep = (async (ms: number) => {
      slept.push(ms)
    }) as typeof Bun.sleep

    let uploadAttempts = 0
    let createAttempts = 0
    let pollAttempts = 0
    globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input)

      if (url === 'https://gladia.test/v2/upload') {
        uploadAttempts += 1
        throw new Error('unexpected upload')
      }

      if (url === 'https://gladia.test/v2/pre-recorded' && init?.method === 'POST') {
        createAttempts += 1
        throw new Error('unexpected create')
      }

      if (url === 'https://gladia.test/v2/pre-recorded/tx-existing' && init?.method === 'GET') {
        pollAttempts += 1
        return new Response(JSON.stringify({
          id: 'tx-existing',
          status: 'processing'
        }), {
          status: 200,
          headers: { 'content-type': 'application/json' }
        })
      }

      throw new Error(`Unexpected fetch: ${url}`)
    }) as unknown as typeof fetch

    await expect(
      runGladiaStt(audioPath, outputDir, {
        model: 'default',
        segmentOffsetMinutes: 0,
        runMode: 'backfill'
      })
    ).rejects.toThrow('still pending after 5 resume status checks')

    expect(uploadAttempts).toBe(0)
    expect(createAttempts).toBe(0)
    expect(pollAttempts).toBe(5)
    expect(slept).toEqual([30_000, 60_000, 120_000, 240_000])

    const metadata = await Bun.file(join(outputDir, 'metadata.json')).json() as Record<string, unknown>
    expect(metadata['runtime']).toEqual(expect.objectContaining({
      mode: 'resumed',
      stage: 'polling',
      remoteJobId: 'tx-existing'
    }))
  })
})
