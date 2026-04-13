import { afterEach, expect, test } from 'bun:test'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { buildOptsFromFlags } from '~/cli/commands/process-steps/step-1-download/targets/build-opts-from-flags'
import { runSttBatch } from '~/cli/commands/process-steps/step-2-stt/stt-batch'
import { STABLE_LOCAL_AUDIO_PATH } from '../../test-utils/test-helpers'

const originalFetch = globalThis.fetch
const originalSonioxApiKey = process.env['SONIOX_API_KEY']
const originalSonioxBaseUrl = process.env['SONIOX_BASE_URL']
const originalMistralApiKey = process.env['MISTRAL_API_KEY']
const originalMistralBaseUrl = process.env['MISTRAL_BASE_URL']
const originalBunSleep = Bun.sleep
const cleanupPaths: string[] = []
type FetchWithMistralCalls = typeof fetch & { getMistralCalls: () => number }

const registerCleanupPath = (path: string | undefined): void => {
  if (path) {
    cleanupPaths.push(path)
  }
}

const createBatchInputs = async (label: string): Promise<string[]> => {
  const dir = await mkdtemp(join(tmpdir(), label))
  registerCleanupPath(dir)
  const bytes = await Bun.file(STABLE_LOCAL_AUDIO_PATH).bytes()
  const files = [
    join(dir, 'item-a.mp3'),
    join(dir, 'item-b.mp3')
  ]

  for (const file of files) {
    await Bun.write(file, bytes)
  }

  return files
}

const createSonioxSuccessFetch = (
  mistralHandler: (callIndex: number) => Response
): FetchWithMistralCalls => {
  let nextFileId = 1
  let nextTranscriptId = 1
  let mistralCalls = 0

  const fetchImpl = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input)
    const method = init?.method ?? 'GET'

    if (url === 'https://soniox.test/v1/files' && method === 'POST') {
      return new Response(JSON.stringify({ id: `file-${nextFileId++}` }), {
        status: 200,
        headers: { 'content-type': 'application/json' }
      })
    }

    if (url === 'https://soniox.test/v1/transcriptions' && method === 'POST') {
      return new Response(JSON.stringify({ id: `tx-${nextTranscriptId++}`, status: 'queued' }), {
        status: 201,
        headers: { 'content-type': 'application/json' }
      })
    }

    const transcriptStatusMatch = url.match(/^https:\/\/soniox\.test\/v1\/transcriptions\/([^/]+)$/)
    if (transcriptStatusMatch && method === 'GET') {
      return new Response(JSON.stringify({
        id: transcriptStatusMatch[1],
        status: 'completed'
      }), {
        status: 200,
        headers: { 'content-type': 'application/json' }
      })
    }

    const transcriptMatch = url.match(/^https:\/\/soniox\.test\/v1\/transcriptions\/([^/]+)\/transcript$/)
    if (transcriptMatch && method === 'GET') {
      return new Response(JSON.stringify({
        id: transcriptMatch[1],
        text: `Recovered Soniox transcript ${transcriptMatch[1]}.`,
        tokens: [
          { text: `Recovered Soniox transcript ${transcriptMatch[1]}.`, start_ms: 0, end_ms: 1000, speaker: 0 }
        ]
      }), {
        status: 200,
        headers: { 'content-type': 'application/json' }
      })
    }

    if (url.startsWith('https://soniox.test/v1/') && method === 'DELETE') {
      return new Response(null, { status: 204 })
    }

    if (url === 'https://mistral.test/v1/audio/transcriptions' && method === 'POST') {
      mistralCalls += 1
      return mistralHandler(mistralCalls)
    }

    throw new Error(`Unexpected request: ${method} ${url}`)
  }) as unknown as FetchWithMistralCalls

  Object.assign(fetchImpl, { getMistralCalls: (): number => mistralCalls })
  return fetchImpl
}

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

  ;(Bun as typeof Bun & { sleep: typeof Bun.sleep }).sleep = originalBunSleep

  await Promise.all(cleanupPaths.splice(0).map(async (path) => {
    await rm(path, { recursive: true, force: true })
  }))
})

test('runSttBatch blocks a permanently failing provider and marks later items as skipped', async () => {
  const items = await createBatchInputs('autoshow-stt-block-')

  process.env['SONIOX_API_KEY'] = 'soniox-test-key'
  process.env['SONIOX_BASE_URL'] = 'https://soniox.test'
  process.env['MISTRAL_API_KEY'] = 'mistral-test-key'
  process.env['MISTRAL_BASE_URL'] = 'https://mistral.test/v1'

  const fetchImpl = createSonioxSuccessFetch(() =>
    new Response(JSON.stringify({ detail: 'Unauthorized' }), {
      status: 401,
      headers: { 'content-type': 'application/json' }
    })
  )
  globalThis.fetch = fetchImpl

  const opts = buildOptsFromFlags(false, {
    'mistral-stt': 'voxtral-mini-latest',
    'soniox-stt': 'stt-async-v4',
    'batch-concurrency': '2',
    'no-cache': true
  })

  const result = await runSttBatch(items, 'stt-batch-block', opts, {
    concurrency: opts.batchConcurrency
  })
  registerCleanupPath(result.batchDir)

  expect(fetchImpl.getMistralCalls()).toBe(1)
  expect(result.ok).toBe(0)
  expect(result.incomplete).toBe(2)
  expect(result.fail).toBe(0)
  expect(result.batchDir).toBeDefined()
  if (!result.batchDir) {
    return
  }

  const info = await Bun.file(join(result.batchDir, 'info.json')).json() as Array<Record<string, unknown>>
  const mistralStates = info.flatMap((entry) =>
    Array.isArray(entry['providerStates'])
      ? entry['providerStates'].filter((state): state is Record<string, unknown> => typeof state === 'object' && state !== null)
      : []
  ).filter((state) => state['service'] === 'mistral')

  expect(mistralStates.map((state) => state['status']).sort()).toEqual(['failed', 'skipped'])

  const skippedErrors = info.flatMap((entry) =>
    Array.isArray(entry['errors'])
      ? entry['errors'].filter((error): error is Record<string, unknown> => typeof error === 'object' && error !== null)
      : []
  ).filter((error) => error['service'] === 'mistral' && error['skipped'] === true)

  expect(skippedErrors).toHaveLength(1)
})

test('runSttBatch backfills retryable provider failures within the same invocation', async () => {
  const items = await createBatchInputs('autoshow-stt-backfill-')

  process.env['SONIOX_API_KEY'] = 'soniox-test-key'
  process.env['SONIOX_BASE_URL'] = 'https://soniox.test'
  process.env['MISTRAL_API_KEY'] = 'mistral-test-key'
  process.env['MISTRAL_BASE_URL'] = 'https://mistral.test/v1'

  const fetchImpl = createSonioxSuccessFetch((callIndex) => {
    if (callIndex <= 4) {
      return new Response('<html><body><h1>502 Bad Gateway</h1></body></html>', {
        status: 502,
        headers: { 'content-type': 'text/html' }
      })
    }

    return new Response(JSON.stringify({
      text: 'Recovered Mistral transcript.',
      segments: [
        {
          start: 0,
          end: 1,
          text: 'Recovered Mistral transcript.',
          speaker_id: 1
        }
      ]
    }), {
      status: 200,
      headers: { 'content-type': 'application/json' }
    })
  })
  globalThis.fetch = fetchImpl
  ;(Bun as typeof Bun & { sleep: typeof Bun.sleep }).sleep = (async () => {}) as typeof Bun.sleep

  const opts = buildOptsFromFlags(false, {
    'mistral-stt': 'voxtral-mini-latest',
    'soniox-stt': 'stt-async-v4',
    'batch-concurrency': '2',
    'no-cache': true
  })

  const result = await runSttBatch(items, 'stt-batch-backfill', opts, {
    concurrency: opts.batchConcurrency
  })
  registerCleanupPath(result.batchDir)

  expect(fetchImpl.getMistralCalls()).toBe(6)
  expect(result.ok).toBe(2)
  expect(result.incomplete).toBe(0)
  expect(result.fail).toBe(0)
  expect(result.batchDir).toBeDefined()
  if (!result.batchDir) {
    return
  }

  const info = await Bun.file(join(result.batchDir, 'info.json')).json() as Array<Record<string, unknown>>
  for (const entry of info) {
    expect(entry['completionStatus']).toBe('full')
    expect(Array.isArray(entry['missingProviders'])).toBe(true)
    expect((entry['missingProviders'] as unknown[])).toHaveLength(0)
  }
})
