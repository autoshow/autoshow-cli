import { afterEach, describe, expect, test } from 'bun:test'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { isSttPartialCompletionError, processStt } from '~/cli/commands/process-steps/process-stt'
import { buildOptsFromFlags } from '~/cli/commands/process-steps/step-1-download/targets/build-opts-from-flags'
import { STABLE_LOCAL_AUDIO_PATH } from '../../test-utils/test-helpers'
import { readRunMetadata } from '../../test-utils/manifest-helpers'

const originalFetch = globalThis.fetch
const originalSonioxApiKey = process.env['SONIOX_API_KEY']
const originalSonioxBaseUrl = process.env['SONIOX_BASE_URL']
const originalMistralApiKey = process.env['MISTRAL_API_KEY']
const originalMistralBaseUrl = process.env['MISTRAL_BASE_URL']
const tempDirs: string[] = []

const readFetchRequest = (input: string | URL | Request, init?: RequestInit): { url: string, method: string } => ({
  url: input instanceof Request ? input.url : String(input),
  method: input instanceof Request ? input.method : init?.method ?? 'GET'
})

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

  if (originalMistralApiKey === undefined) {
    delete process.env['MISTRAL_API_KEY']
  } else {
    process.env['MISTRAL_API_KEY'] = originalMistralApiKey
  }

  if (originalMistralBaseUrl === undefined) {
    delete process.env['MISTRAL_BASE_URL']
  } else {
    process.env['MISTRAL_BASE_URL'] = originalMistralBaseUrl
  }

  await Promise.all(tempDirs.splice(0).map(async (dir) => {
    await rm(dir, { recursive: true, force: true })
  }))
})

describe('processStt partial failure diagnostics', () => {
  test('preserves failed provider diagnostics and records them in metadata', async () => {
    const outputRoot = await mkdtemp(join(tmpdir(), 'autoshow-stt-partial-'))
    tempDirs.push(outputRoot)

    process.env['SONIOX_API_KEY'] = 'soniox-test-key'
    process.env['SONIOX_BASE_URL'] = 'https://soniox.test'
    process.env['MISTRAL_API_KEY'] = 'mistral-test-key'
    process.env['MISTRAL_BASE_URL'] = 'https://mistral.test/v1'

    globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
      const { url, method } = readFetchRequest(input, init)

      if (url === 'https://soniox.test/v1/files' && method === 'POST') {
        return new Response(JSON.stringify({ id: 'file-1' }), {
          status: 200,
          headers: { 'content-type': 'application/json' }
        })
      }

      if (url === 'https://soniox.test/v1/transcriptions' && method === 'POST') {
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
          text: 'Broken transcript payload',
          tokens: { invalid: true }
        }), {
          status: 200,
          headers: { 'content-type': 'application/json' }
        })
      }

      if (url === 'https://soniox.test/v1/transcriptions/tx-1' && method === 'DELETE') {
        return new Response(null, { status: 204 })
      }

      if (url === 'https://soniox.test/v1/files/file-1' && method === 'DELETE') {
        return new Response(null, { status: 204 })
      }

      if (url === 'https://mistral.test/v1/audio/transcriptions' && method === 'POST') {
        return new Response(JSON.stringify({
          model: 'voxtral-mini-latest',
          text: 'Hello from Mistral',
          language: null,
          usage: {},
          segments: [
            {
              start: 0,
              end: 1.5,
              text: 'Hello from Mistral',
              speaker_id: 'speaker_1'
            }
          ]
        }), {
          status: 200,
          headers: { 'content-type': 'application/json' }
        })
      }

      throw new Error(`Unexpected request: ${method} ${url}`)
    }) as unknown as typeof fetch

    const opts = buildOptsFromFlags(false, {
      'mistral-stt': 'voxtral-mini-latest',
      'soniox-stt': 'stt-async-v4',
      'no-cache': true
    })

    let outputDir: string | undefined
    try {
      await processStt({ filePath: STABLE_LOCAL_AUDIO_PATH }, outputRoot, opts)
      throw new Error('Expected processStt to throw on incomplete multi-provider output')
    } catch (error) {
      expect(isSttPartialCompletionError(error)).toBe(true)
      if (!isSttPartialCompletionError(error)) {
        throw error
      }
      outputDir = error.outputDir
      expect(error.completionStatus).toBe('incomplete')
      expect(error.missingProviders).toEqual([
        expect.objectContaining({
          service: 'soniox',
          model: 'stt-async-v4'
        })
      ])
    }

    expect(outputDir).toBeDefined()
    const resolvedOutputDir = outputDir as string
    const sonioxDir = `${resolvedOutputDir}/providers/soniox-stt-async-v4`

    const errorJson = await Bun.file(`${sonioxDir}/error.json`).json() as Record<string, unknown>
    const rawResponseJson = await Bun.file(`${sonioxDir}/raw-response.json`).json() as Record<string, unknown>
    const metadata = await readRunMetadata(resolvedOutputDir) as {
      step2: Array<{ transcriptionService: string }>
      completionStatus: string
      requestedProviders: Array<Record<string, unknown>>
      providerStates: Array<Record<string, unknown>>
      missingProviders: Array<Record<string, unknown>>
      errors: Array<Record<string, unknown>>
    }

    expect(errorJson['service']).toBe('soniox')
    expect(errorJson['model']).toBe('stt-async-v4')
    expect(errorJson['retryable']).toBe(false)
    expect(errorJson['rawResponseFile']).toBe('raw-response.json')

    expect(rawResponseJson).toEqual({
      id: 'tx-1',
      text: 'Broken transcript payload',
      tokens: { invalid: true }
    })

    expect(metadata.step2).toHaveLength(1)
    expect(metadata.completionStatus).toBe('incomplete')
    expect(metadata.requestedProviders).toHaveLength(2)
    expect(metadata.providerStates).toEqual(expect.arrayContaining([
      expect.objectContaining({
        service: 'mistral',
        model: 'voxtral-mini-latest',
        status: 'succeeded'
      }),
      expect.objectContaining({
        service: 'soniox',
        model: 'stt-async-v4',
        status: 'failed',
        artifactDir: 'providers/soniox-stt-async-v4'
      })
    ]))
    expect(metadata.missingProviders).toEqual([
      expect.objectContaining({
        service: 'soniox',
        model: 'stt-async-v4'
      })
    ])
    expect(metadata.step2[0]?.transcriptionService).toBe('mistral')
    expect(metadata.errors).toEqual([
      expect.objectContaining({
        service: 'soniox',
        model: 'stt-async-v4',
        retryable: false,
        errorFile: 'providers/soniox-stt-async-v4/error.json',
        rawResponseFile: 'providers/soniox-stt-async-v4/raw-response.json'
      })
    ])
  })
})
