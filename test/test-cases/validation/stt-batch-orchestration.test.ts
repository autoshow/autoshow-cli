import { afterEach, expect, test } from 'bun:test'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { buildOptsFromFlags } from '~/cli/commands/process-steps/step-1-download/targets/build-opts-from-flags'
import { runSttBatch } from '~/cli/commands/process-steps/step-2-stt/stt-batch'
import { STABLE_LOCAL_AUDIO_PATH } from '../../test-utils/test-helpers'

const originalFetch = globalThis.fetch
const originalDeepgramApiKey = process.env['DEEPGRAM_API_KEY']
const originalDeepgramBaseUrl = process.env['DEEPGRAM_BASE_URL']
const originalSonioxApiKey = process.env['SONIOX_API_KEY']
const originalSonioxBaseUrl = process.env['SONIOX_BASE_URL']
const originalMistralApiKey = process.env['MISTRAL_API_KEY']
const originalMistralBaseUrl = process.env['MISTRAL_BASE_URL']
const originalAssemblyAiApiKey = process.env['ASSEMBLYAI_API_KEY']
const originalAssemblyAiBaseUrl = process.env['ASSEMBLYAI_BASE_URL']
const originalAssemblyAiPollDeadline = process.env['AUTOSHOW_STT_POLL_DEADLINE_MS_ASSEMBLYAI']
const originalProviderSlotLimit = process.env['AUTOSHOW_STT_PROVIDER_SLOT_LIMIT']
const originalSonioxProviderSlotLimit = process.env['AUTOSHOW_STT_PROVIDER_SLOT_LIMIT_SONIOX']
const originalBunSleep = Bun.sleep
const cleanupPaths: string[] = []
type FetchWithMistralCalls = typeof fetch & { getMistralCalls: () => number }
type CoordinatedProviderFetch = typeof fetch & {
  getCallCounts: () => { deepgram: number, sonioxUploads: number, mistral: number }
  releaseSlowProviders: () => void
}
type AsyncCreateReleaseFetch = typeof fetch & {
  getCallCounts: () => { sonioxCreates: number, sonioxPolls: number, mistral: number }
  releasePolls: () => void
}

const registerCleanupPath = (path: string | undefined): void => {
  if (path) {
    cleanupPaths.push(path)
  }
}

const createBatchInputs = async (label: string, count = 2): Promise<string[]> => {
  const dir = await mkdtemp(join(tmpdir(), label))
  registerCleanupPath(dir)
  const bytes = await Bun.file(STABLE_LOCAL_AUDIO_PATH).bytes()
  const files = Array.from({ length: count }, (_entry, index) =>
    join(dir, `item-${String.fromCharCode('a'.charCodeAt(0) + index)}.mp3`)
  )

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

const createCoordinatedProviderFetch = (): CoordinatedProviderFetch => {
  let nextFileId = 1
  let nextTranscriptId = 1
  let deepgramCalls = 0
  let sonioxUploads = 0
  let mistralCalls = 0
  let releaseSlowProviders!: () => void
  const slowProvidersReady = new Promise<void>((resolve) => {
    releaseSlowProviders = resolve
  })
  let released = false

  const waitForSlowProviders = async (): Promise<void> => {
    if (!released) {
      await slowProvidersReady
    }
  }

  const fetchImpl = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input)
    const method = init?.method ?? 'GET'

    if (url.startsWith('https://deepgram.test/v1/listen') && method === 'POST') {
      deepgramCalls += 1
      await waitForSlowProviders()
      return new Response(JSON.stringify({
        results: {
          channels: [{
            alternatives: [{
              transcript: `Deepgram transcript ${deepgramCalls}`,
              words: [
                { word: `Deepgram`, punctuated_word: `Deepgram`, start: 0, end: 0.5, speaker: 0 },
                { word: `transcript`, punctuated_word: `transcript.`, start: 0.5, end: 1, speaker: 0 }
              ]
            }]
          }],
          utterances: [
            { start: 0, end: 1, transcript: `Deepgram transcript ${deepgramCalls}`, speaker: 0 }
          ]
        }
      }), {
        status: 200,
        headers: { 'content-type': 'application/json' }
      })
    }

    if (url === 'https://soniox.test/v1/files' && method === 'POST') {
      sonioxUploads += 1
      await waitForSlowProviders()
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
        text: `Soniox transcript ${transcriptMatch[1]}.`,
        tokens: [
          { text: `Soniox transcript ${transcriptMatch[1]}.`, start_ms: 0, end_ms: 1000, speaker: 0 }
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
      return new Response(JSON.stringify({
        text: `Mistral transcript ${mistralCalls}.`,
        segments: [
          {
            start: 0,
            end: 1,
            text: `Mistral transcript ${mistralCalls}.`,
            speaker_id: 1
          }
        ]
      }), {
        status: 200,
        headers: { 'content-type': 'application/json' }
      })
    }

    throw new Error(`Unexpected request: ${method} ${url}`)
  }) as unknown as CoordinatedProviderFetch

  Object.assign(fetchImpl, {
    getCallCounts: () => ({
      deepgram: deepgramCalls,
      sonioxUploads,
      mistral: mistralCalls
    }),
    releaseSlowProviders: () => {
      if (released) {
        return
      }
      released = true
      releaseSlowProviders()
    }
  })

  return fetchImpl
}

const createAsyncCreateReleaseFetch = (): AsyncCreateReleaseFetch => {
  let nextFileId = 1
  let nextTranscriptId = 1
  let sonioxCreates = 0
  let sonioxPolls = 0
  let mistralCalls = 0
  let releasePolls!: () => void
  let pollsReleased = false
  const pollsReady = new Promise<void>((resolve) => {
    releasePolls = resolve
  })

  const waitForPolls = async (): Promise<void> => {
    if (!pollsReleased) {
      await pollsReady
    }
  }

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
      sonioxCreates += 1
      return new Response(JSON.stringify({ id: `tx-${nextTranscriptId++}`, status: 'queued' }), {
        status: 201,
        headers: { 'content-type': 'application/json' }
      })
    }

    const transcriptionStatusMatch = url.match(/^https:\/\/soniox\.test\/v1\/transcriptions\/([^/]+)$/)
    if (transcriptionStatusMatch && method === 'GET') {
      sonioxPolls += 1
      await waitForPolls()
      return new Response(JSON.stringify({
        id: transcriptionStatusMatch[1],
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
        text: `Async Soniox transcript ${transcriptMatch[1]}.`,
        tokens: [
          { text: `Async Soniox transcript ${transcriptMatch[1]}.`, start_ms: 0, end_ms: 1000, speaker: 0 }
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
      return new Response(JSON.stringify({
        text: `Mistral transcript ${mistralCalls}.`,
        segments: [
          {
            start: 0,
            end: 1,
            text: `Mistral transcript ${mistralCalls}.`,
            speaker_id: 1
          }
        ]
      }), {
        status: 200,
        headers: { 'content-type': 'application/json' }
      })
    }

    throw new Error(`Unexpected request: ${method} ${url}`)
  }) as unknown as AsyncCreateReleaseFetch

  Object.assign(fetchImpl, {
    getCallCounts: () => ({
      sonioxCreates,
      sonioxPolls,
      mistral: mistralCalls
    }),
    releasePolls: () => {
      if (pollsReleased) {
        return
      }
      pollsReleased = true
      releasePolls()
    }
  })

  return fetchImpl
}

const waitFor = async (predicate: () => boolean, timeoutMs = 2000): Promise<void> => {
  const startedAt = Date.now()
  while (!predicate()) {
    if (Date.now() - startedAt > timeoutMs) {
      throw new Error('Timed out waiting for test condition')
    }
    await Bun.sleep(10)
  }
}

afterEach(async () => {
  globalThis.fetch = originalFetch

  if (originalDeepgramApiKey === undefined) {
    delete process.env['DEEPGRAM_API_KEY']
  } else {
    process.env['DEEPGRAM_API_KEY'] = originalDeepgramApiKey
  }

  if (originalDeepgramBaseUrl === undefined) {
    delete process.env['DEEPGRAM_BASE_URL']
  } else {
    process.env['DEEPGRAM_BASE_URL'] = originalDeepgramBaseUrl
  }

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

  if (originalAssemblyAiApiKey === undefined) {
    delete process.env['ASSEMBLYAI_API_KEY']
  } else {
    process.env['ASSEMBLYAI_API_KEY'] = originalAssemblyAiApiKey
  }

  if (originalAssemblyAiBaseUrl === undefined) {
    delete process.env['ASSEMBLYAI_BASE_URL']
  } else {
    process.env['ASSEMBLYAI_BASE_URL'] = originalAssemblyAiBaseUrl
  }

  if (originalAssemblyAiPollDeadline === undefined) {
    delete process.env['AUTOSHOW_STT_POLL_DEADLINE_MS_ASSEMBLYAI']
  } else {
    process.env['AUTOSHOW_STT_POLL_DEADLINE_MS_ASSEMBLYAI'] = originalAssemblyAiPollDeadline
  }

  if (originalProviderSlotLimit === undefined) {
    delete process.env['AUTOSHOW_STT_PROVIDER_SLOT_LIMIT']
  } else {
    process.env['AUTOSHOW_STT_PROVIDER_SLOT_LIMIT'] = originalProviderSlotLimit
  }

  if (originalSonioxProviderSlotLimit === undefined) {
    delete process.env['AUTOSHOW_STT_PROVIDER_SLOT_LIMIT_SONIOX']
  } else {
    process.env['AUTOSHOW_STT_PROVIDER_SLOT_LIMIT_SONIOX'] = originalSonioxProviderSlotLimit
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
  process.env['AUTOSHOW_STT_PROVIDER_SLOT_LIMIT'] = '1'

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

test('runSttBatch uses free provider slots on later items instead of waiting behind slow providers', async () => {
  const items = await createBatchInputs('autoshow-stt-coordinated-')

  process.env['DEEPGRAM_API_KEY'] = 'deepgram-test-key'
  process.env['DEEPGRAM_BASE_URL'] = 'https://deepgram.test'
  process.env['SONIOX_API_KEY'] = 'soniox-test-key'
  process.env['SONIOX_BASE_URL'] = 'https://soniox.test'
  process.env['MISTRAL_API_KEY'] = 'mistral-test-key'
  process.env['MISTRAL_BASE_URL'] = 'https://mistral.test/v1'

  const fetchImpl = createCoordinatedProviderFetch()
  globalThis.fetch = fetchImpl

  const opts = buildOptsFromFlags(false, {
    'deepgram-stt': 'nova-3',
    'soniox-stt': 'stt-async-v4',
    'mistral-stt': 'voxtral-mini-latest',
    'batch-concurrency': '2',
    'stt-provider-concurrency': '2',
    'no-cache': true
  })

  const batchPromise = runSttBatch(items, 'stt-batch-coordinated', opts, {
    concurrency: opts.batchConcurrency
  })

  await waitFor(() => {
    const counts = fetchImpl.getCallCounts()
    return counts.deepgram >= 1
      && counts.sonioxUploads >= 1
      && counts.mistral >= 1
  })

  const earlyCounts = fetchImpl.getCallCounts()
  expect(earlyCounts.deepgram).toBeGreaterThanOrEqual(1)
  expect(earlyCounts.sonioxUploads).toBeGreaterThanOrEqual(1)
  expect(earlyCounts.mistral).toBeGreaterThanOrEqual(1)

  fetchImpl.releaseSlowProviders()

  const result = await batchPromise
  registerCleanupPath(result.batchDir)

  expect(result.ok).toBe(2)
  expect(result.incomplete).toBe(0)
  expect(result.fail).toBe(0)
  expect(fetchImpl.getCallCounts()).toEqual({
    deepgram: 2,
    sonioxUploads: 2,
    mistral: 2
  })
})

test('runSttBatch releases async create slots after remote job creation', async () => {
  const items = await createBatchInputs('autoshow-stt-async-create-', 3)

  process.env['SONIOX_API_KEY'] = 'soniox-test-key'
  process.env['SONIOX_BASE_URL'] = 'https://soniox.test'
  process.env['MISTRAL_API_KEY'] = 'mistral-test-key'
  process.env['MISTRAL_BASE_URL'] = 'https://mistral.test/v1'
  process.env['AUTOSHOW_STT_PROVIDER_SLOT_LIMIT_SONIOX'] = '1'

  const fetchImpl = createAsyncCreateReleaseFetch()
  globalThis.fetch = fetchImpl

  const opts = buildOptsFromFlags(false, {
    'soniox-stt': 'stt-async-v4',
    'mistral-stt': 'voxtral-mini-latest',
    'batch-concurrency': '3',
    'no-cache': true
  })

  const batchPromise = runSttBatch(items, 'stt-batch-async-create', opts, {
    concurrency: opts.batchConcurrency
  })

  await waitFor(() => fetchImpl.getCallCounts().sonioxCreates === 3)

  const earlyCounts = fetchImpl.getCallCounts()
  expect(earlyCounts.sonioxCreates).toBe(3)

  fetchImpl.releasePolls()

  const result = await batchPromise
  registerCleanupPath(result.batchDir)

  expect(result.ok).toBe(3)
  expect(result.incomplete).toBe(0)
  expect(result.fail).toBe(0)
  expect(fetchImpl.getCallCounts().sonioxCreates).toBe(3)
})

test('runSttBatch backfills retryable provider failures within the same invocation', async () => {
  const items = await createBatchInputs('autoshow-stt-backfill-')

  process.env['SONIOX_API_KEY'] = 'soniox-test-key'
  process.env['SONIOX_BASE_URL'] = 'https://soniox.test'
  process.env['MISTRAL_API_KEY'] = 'mistral-test-key'
  process.env['MISTRAL_BASE_URL'] = 'https://mistral.test/v1'

  const fetchImpl = createSonioxSuccessFetch((callIndex) => {
    if (callIndex <= 2) {
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

  expect(fetchImpl.getMistralCalls()).toBe(4)
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

test('runSttBatch performs a single automatic backfill sweep for retryable async provider failures', { timeout: 35_000 }, async () => {
  const items = await createBatchInputs('autoshow-stt-assemblyai-backfill-')

  process.env['ASSEMBLYAI_API_KEY'] = 'assemblyai-test-key'
  process.env['ASSEMBLYAI_BASE_URL'] = 'https://assemblyai.test'
  process.env['MISTRAL_API_KEY'] = 'mistral-test-key'
  process.env['MISTRAL_BASE_URL'] = 'https://mistral.test/v1'

  let nextTranscriptId = 1
  let assemblyAiCreates = 0
  let assemblyAiPolls = 0
  let mistralCalls = 0
  globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input)
    const method = init?.method ?? 'GET'

    if (url === 'https://assemblyai.test/v2/upload' && method === 'POST') {
      return new Response(JSON.stringify({
        upload_url: `https://cdn.assemblyai.test/audio-${nextTranscriptId}.wav`
      }), {
        status: 200,
        headers: { 'content-type': 'application/json' }
      })
    }

    if (url === 'https://assemblyai.test/v2/transcript' && method === 'POST') {
      assemblyAiCreates += 1
      return new Response(JSON.stringify({ id: `tx-${nextTranscriptId++}` }), {
        status: 200,
        headers: { 'content-type': 'application/json' }
      })
    }

    if (url.startsWith('https://assemblyai.test/v2/transcript/')) {
      assemblyAiPolls += 1
      return new Response('temporary outage', {
        status: 503,
        headers: {
          'content-type': 'text/plain',
          'retry-after': '0'
        }
      })
    }

    if (url === 'https://mistral.test/v1/audio/transcriptions' && method === 'POST') {
      mistralCalls += 1
      return new Response(JSON.stringify({
        text: `Mistral transcript ${mistralCalls}.`,
        segments: [
          {
            start: 0,
            end: 1,
            text: `Mistral transcript ${mistralCalls}.`,
            speaker_id: 1
          }
        ]
      }), {
        status: 200,
        headers: { 'content-type': 'application/json' }
      })
    }

    throw new Error(`Unexpected request: ${method} ${url}`)
  }) as unknown as typeof fetch
  ;(Bun as typeof Bun & { sleep: typeof Bun.sleep }).sleep = (async () => {}) as typeof Bun.sleep

  const opts = buildOptsFromFlags(false, {
    'assemblyai-stt': 'universal-3-pro',
    'mistral-stt': 'voxtral-mini-latest',
    'batch-concurrency': '2',
    'no-cache': true
  })

  const result = await runSttBatch(items, 'stt-batch-assemblyai-backfill', opts, {
    concurrency: opts.batchConcurrency
  })
  registerCleanupPath(result.batchDir)

  expect(result.ok).toBe(0)
  expect(result.incomplete).toBe(2)
  expect(result.fail).toBe(0)
  expect(assemblyAiCreates).toBe(2)
  expect(assemblyAiPolls).toBe(24)
  expect(mistralCalls).toBe(2)
  expect(result.batchDir).toBeDefined()
  if (!result.batchDir) {
    return
  }

  const info = await Bun.file(join(result.batchDir, 'info.json')).json() as Array<Record<string, unknown>>
  for (const entry of info) {
    expect(entry['completionStatus']).toBe('incomplete')
    const assemblyAiState = Array.isArray(entry['providerStates'])
      ? entry['providerStates'].find((state): state is Record<string, unknown> =>
        typeof state === 'object'
        && state !== null
        && state['service'] === 'assemblyai')
      : undefined

    expect(assemblyAiState).toEqual(expect.objectContaining({
      status: 'failed',
      attempts: 2,
      retryable: true
    }))
  }
})
