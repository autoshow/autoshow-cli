import { afterEach, describe, expect, test } from 'bun:test'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { runAssemblyAiTranscribe } from '~/cli/commands/process-steps/step-2-stt/stt-services/assemblyai/run-assemblyai-stt'
import { readProviderCheckpointMetadata, writeProviderCheckpointFixture } from '../../test-utils/manifest-helpers'

const originalFetch = globalThis.fetch
const originalApiKey = process.env['ASSEMBLYAI_API_KEY']
const originalBaseUrl = process.env['ASSEMBLYAI_BASE_URL']
const originalBunSleep = Bun.sleep
const tempDirs: string[] = []

const createAudioFixture = async (): Promise<{ audioPath: string, outputDir: string }> => {
  const outputDir = await mkdtemp(join(tmpdir(), 'autoshow-assemblyai-stt-'))
  tempDirs.push(outputDir)

  const audioPath = join(outputDir, 'sample.wav')
  await Bun.write(audioPath, new Uint8Array(2048).fill(1))

  return { audioPath, outputDir }
}

afterEach(async () => {
  globalThis.fetch = originalFetch
  ;(Bun as typeof Bun & { sleep: typeof Bun.sleep }).sleep = originalBunSleep

  if (originalApiKey === undefined) {
    delete process.env['ASSEMBLYAI_API_KEY']
  } else {
    process.env['ASSEMBLYAI_API_KEY'] = originalApiKey
  }

  if (originalBaseUrl === undefined) {
    delete process.env['ASSEMBLYAI_BASE_URL']
  } else {
    process.env['ASSEMBLYAI_BASE_URL'] = originalBaseUrl
  }

  await Promise.all(tempDirs.splice(0).map(async (dir) => {
    await rm(dir, { recursive: true, force: true })
  }))
})

describe('runAssemblyAiTranscribe', () => {
  test('retries a transient upload failure and completes successfully', async () => {
    const { audioPath, outputDir } = await createAudioFixture()
    process.env['ASSEMBLYAI_API_KEY'] = 'test-key'
    process.env['ASSEMBLYAI_BASE_URL'] = 'https://assemblyai.test'

    let uploadAttempts = 0
    let pollAttempts = 0
    globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input)

      if (url === 'https://assemblyai.test/v2/upload') {
        uploadAttempts += 1
        if (uploadAttempts === 1) {
          return new Response('bad gateway', {
            status: 502,
            headers: { 'retry-after': '0' }
          })
        }

        return new Response(JSON.stringify({ upload_url: 'https://cdn.assemblyai.test/audio.wav' }), {
          status: 200,
          headers: { 'content-type': 'application/json' }
        })
      }

      if (url === 'https://assemblyai.test/v2/transcript' && init?.method === 'POST') {
        return new Response(JSON.stringify({ id: 'tx-123' }), {
          status: 200,
          headers: { 'content-type': 'application/json' }
        })
      }

      if (url === 'https://assemblyai.test/v2/transcript/tx-123' && init?.method === 'GET') {
        pollAttempts += 1
        return new Response(JSON.stringify({
          id: 'tx-123',
          status: 'completed',
          text: 'Hello world',
          utterances: [
            {
              confidence: 0.9,
              start: 0,
              end: 900,
              text: 'Hello world',
              speaker: 'A'
            }
          ]
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

    const { result, metadata } = await runAssemblyAiTranscribe(audioPath, outputDir, {
      model: 'universal-2',
      segmentOffsetMinutes: 0
    })

    expect(uploadAttempts).toBe(2)
    expect(pollAttempts).toBe(1)
    expect(result.text).toBe('Hello world')
    expect(metadata.transcriptionService).toBe('assemblyai')
    expect(metadata.transcriptionModel).toBe('universal-2')
  })

  test('reuses a persisted AssemblyAI job with bounded resume probes and no new transcript creation', async () => {
    const { audioPath, outputDir } = await createAudioFixture()
    process.env['ASSEMBLYAI_API_KEY'] = 'test-key'
    process.env['ASSEMBLYAI_BASE_URL'] = 'https://assemblyai.test'

    await writeProviderCheckpointFixture(outputDir, 'assemblyai', 'universal-3-pro', {
      transcriptionService: 'assemblyai',
      transcriptionModel: 'universal-3-pro',
      processingTime: 10,
      tokenCount: 0,
      runtime: {
        mode: 'fresh',
        stage: 'polling',
        remoteJobId: 'tx-existing',
        remoteAssetUrl: 'https://cdn.assemblyai.test/audio.wav',
        createCompletedAt: '2026-04-14T00:00:00.000Z'
      }
    })

    const slept: number[] = []
    ;(Bun as typeof Bun & { sleep: typeof Bun.sleep }).sleep = (async (ms: number) => {
      slept.push(ms)
    }) as typeof Bun.sleep

    let uploadAttempts = 0
    let createAttempts = 0
    let pollAttempts = 0
    globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input)

      if (url === 'https://assemblyai.test/v2/upload') {
        uploadAttempts += 1
        throw new Error('unexpected upload')
      }

      if (url === 'https://assemblyai.test/v2/transcript' && init?.method === 'POST') {
        createAttempts += 1
        throw new Error('unexpected create')
      }

      if (url === 'https://assemblyai.test/v2/transcript/tx-existing' && init?.method === 'GET') {
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
      runAssemblyAiTranscribe(audioPath, outputDir, {
        model: 'universal-3-pro',
        segmentOffsetMinutes: 0,
        runMode: 'backfill'
      })
    ).rejects.toThrow('still pending after 5 resume status checks')

    expect(uploadAttempts).toBe(0)
    expect(createAttempts).toBe(0)
    expect(pollAttempts).toBe(5)
    expect(slept).toEqual([30_000, 60_000, 120_000, 240_000])

    const metadata = await readProviderCheckpointMetadata(outputDir)
    expect(metadata['runtime']).toEqual(expect.objectContaining({
      mode: 'resumed',
      stage: 'polling',
      remoteJobId: 'tx-existing'
    }))
  })
})
