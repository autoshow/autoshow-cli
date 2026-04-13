import { afterEach, expect, test } from 'bun:test'
import { mkdir, mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { resumeSttMissingFromBatchDir } from '~/cli/commands/process-steps/step-2-stt/resume-stt-batch'
import { buildOptsFromFlags } from '~/cli/commands/process-steps/step-1-download/targets/build-opts-from-flags'
import { STABLE_LOCAL_AUDIO_PATH } from '../../test-utils/test-helpers'

const originalFetch = globalThis.fetch
const originalSonioxApiKey = process.env['SONIOX_API_KEY']
const originalSonioxBaseUrl = process.env['SONIOX_BASE_URL']
const tempDirs: string[] = []

afterEach(async () => {
  globalThis.fetch = originalFetch

  if (originalSonioxApiKey === undefined) {
    delete process.env['SONIOX_API_KEY']
  } else {
    process.env['SONIOX_API_KEY'] = originalSonioxApiKey
  }

  if (originalSonioxBaseUrl === undefined) {
    delete process.env['SONIOX_BASE_URL']
  } else {
    process.env['SONIOX_BASE_URL'] = originalSonioxBaseUrl
  }

  await Promise.all(tempDirs.splice(0).map(async (dir) => {
    await rm(dir, { recursive: true, force: true })
  }))
})

test('resumeSttMissingFromBatchDir reruns only missing providers into the existing outputDir', async () => {
  const batchDir = await mkdtemp(join(tmpdir(), 'autoshow-stt-resume-'))
  tempDirs.push(batchDir)

  const outputDir = join(batchDir, '2026-04-13_partial-item')
  const mistralDir = join(outputDir, 'providers', 'mistral-voxtral-mini-latest')
  await mkdir(mistralDir, { recursive: true })

  await Bun.write(join(mistralDir, 'transcription.txt'), '[00:00:00] [speaker-1] Existing Mistral transcript')
  await Bun.write(join(mistralDir, 'metadata.json'), JSON.stringify({
    transcriptionService: 'mistral',
    transcriptionModel: 'voxtral-mini-latest',
    transcriptionModelName: 'voxtral-mini-latest',
    processingTime: 100,
    tokenCount: 3
  }, null, 2))

  const rootMetadata = {
      step1: {
        title: 'resume-test',
        duration: '00:00:10',
        author: 'Local',
        description: '',
        url: `file://${resolve(STABLE_LOCAL_AUDIO_PATH)}`,
        slug: 'resume-test',
        audioFileName: 'resume-test.mp3',
        audioFileSize: 1234
    },
    step2: [
      {
        transcriptionService: 'mistral',
        transcriptionModel: 'voxtral-mini-latest',
        transcriptionModelName: 'voxtral-mini-latest',
        processingTime: 100,
        tokenCount: 3
      }
    ],
    completionStatus: 'incomplete',
    requestedProviders: [
      { service: 'mistral', model: 'voxtral-mini-latest', local: false, diarizationOptions: { enabled: true } },
      { service: 'soniox', model: 'stt-async-v4', local: false, diarizationOptions: { enabled: true } }
    ],
    providerStates: [
      {
        service: 'mistral',
        model: 'voxtral-mini-latest',
        local: false,
        artifactDir: 'providers/mistral-voxtral-mini-latest',
        status: 'succeeded',
        attempts: 1
      },
      {
        service: 'soniox',
        model: 'stt-async-v4',
        local: false,
        artifactDir: 'providers/soniox-stt-async-v4',
        status: 'failed',
        attempts: 1,
        retryable: true,
        lastError: {
          message: 'socket closed',
          retryable: true,
          errorFile: 'providers/soniox-stt-async-v4/error.json'
        }
      }
    ],
    missingProviders: [
      { service: 'soniox', model: 'stt-async-v4', local: false, diarizationOptions: { enabled: true } }
    ],
    errors: [
      {
        service: 'soniox',
        model: 'stt-async-v4',
        message: 'socket closed',
        retryable: true,
        errorFile: 'providers/soniox-stt-async-v4/error.json'
      }
    ]
  }

  await Bun.write(join(outputDir, 'metadata.json'), JSON.stringify(rootMetadata, null, 2))
  await Bun.write(join(batchDir, 'info.json'), JSON.stringify([
    {
      ...rootMetadata,
      outputDir
    }
  ], null, 2))

  process.env['SONIOX_API_KEY'] = 'soniox-test-key'
  process.env['SONIOX_BASE_URL'] = 'https://soniox.test'

  let createCalls = 0
  globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input)
    const method = init?.method ?? 'GET'

    if (url === 'https://soniox.test/v1/files' && method === 'POST') {
      return new Response(JSON.stringify({ id: 'file-1' }), {
        status: 200,
        headers: { 'content-type': 'application/json' }
      })
    }

    if (url === 'https://soniox.test/v1/transcriptions' && method === 'POST') {
      createCalls += 1
      return new Response(JSON.stringify({ id: 'tx-1', status: 'queued' }), {
        status: 201,
        headers: { 'content-type': 'application/json' }
      })
    }

    if (url === 'https://soniox.test/v1/transcriptions/tx-1' && method === 'GET') {
      return new Response(JSON.stringify({
        id: 'tx-1',
        status: 'completed'
      }), {
        status: 200,
        headers: { 'content-type': 'application/json' }
      })
    }

    if (url === 'https://soniox.test/v1/transcriptions/tx-1/transcript' && method === 'GET') {
      return new Response(JSON.stringify({
        id: 'tx-1',
        text: 'Recovered Soniox transcript.',
        tokens: [
          { text: 'Recovered Soniox transcript.', start_ms: 0, end_ms: 1000, speaker: 0 }
        ]
      }), {
        status: 200,
        headers: { 'content-type': 'application/json' }
      })
    }

    if (method === 'DELETE') {
      return new Response(null, { status: 204 })
    }

    throw new Error(`Unexpected request: ${method} ${url}`)
  }) as unknown as typeof fetch

  const opts = buildOptsFromFlags(false, {
    'no-cache': true
  })

  await resumeSttMissingFromBatchDir(batchDir, opts)

  expect(createCalls).toBe(1)
  expect(await Bun.file(join(outputDir, 'providers', 'soniox-stt-async-v4', 'transcription.txt')).exists()).toBe(true)

  const updatedMetadata = await Bun.file(join(outputDir, 'metadata.json')).json() as Record<string, unknown>
  expect(updatedMetadata['completionStatus']).toBe('full')
  expect(Array.isArray(updatedMetadata['missingProviders'])).toBe(true)
  expect((updatedMetadata['missingProviders'] as unknown[])).toHaveLength(0)
  expect(Array.isArray(updatedMetadata['step2'])).toBe(true)
  expect((updatedMetadata['step2'] as unknown[])).toHaveLength(2)

  const info = await Bun.file(join(batchDir, 'info.json')).json() as Array<Record<string, unknown>>
  expect(info[0]).toEqual(expect.objectContaining({
    completionStatus: 'full',
    outputDir
  }))
})
