import { afterEach, expect, test } from 'bun:test'
import { mkdir, mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { discoverLatestResumableSttBatchDir, resumeSttMissingFromBatchDir } from '~/cli/commands/process-steps/step-2-stt/resume'
import { YOUTUBE_CAPTIONS_MODEL, YOUTUBE_CAPTIONS_SERVICE } from '~/cli/commands/process-steps/step-2-stt/youtube-captions'
import { buildOptsFromFlags } from '~/cli/commands/process-steps/step-1-download/targets/build-opts-from-flags'
import { l, type LogSink, type LogSinkEvent } from '~/logger'
import {
  readBatchItems,
  readProviderResultMetadata,
  readRunMetadata,
  writeBatchManifestFixture,
  writeProviderCheckpointFixture,
  writeProviderResultFixture,
  writeRunManifestFixture
} from '../../test-utils/manifest-helpers'
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

const withCapturedLogs = async <T>(run: (events: LogSinkEvent[]) => Promise<T>): Promise<T> => {
  const events: LogSinkEvent[] = []
  const sink: LogSink = (event) => {
    events.push(event)
  }
  const originalMinLevel = l.config.minLevel
  const originalSinks = [...l.config.sinks]

  l.config.minLevel = 'debug'
  l.config.sinks.length = 0
  l.config.sinks.push(sink)

  try {
    return await run(events)
  } finally {
    l.config.minLevel = originalMinLevel
    l.config.sinks.length = 0
    l.config.sinks.push(...originalSinks)
  }
}

const createResumeDiscoveryBatch = async (
  outputRoot: string,
  batchName: string,
  entry: Record<string, unknown>
): Promise<string> => {
  const batchDir = join(outputRoot, batchName)
  const outputDir = join(batchDir, '2026-04-13_partial-item')
  await mkdir(outputDir, { recursive: true })
  await writeBatchManifestFixture(batchDir, 'stt', [
    {
      ...entry,
      outputDir
    }
  ])
  return batchDir
}

test('discoverLatestResumableSttBatchDir picks the newest resumable STT batch, including single-provider failures', async () => {
  const outputRoot = await mkdtemp(join(tmpdir(), 'autoshow-stt-resume-discovery-'))
  tempDirs.push(outputRoot)

  const baseStep1 = {
    title: 'resume-discovery',
    duration: '00:00:10',
    author: 'Local',
    description: '',
    url: `file://${resolve(STABLE_LOCAL_AUDIO_PATH)}`,
    slug: 'resume-discovery',
    audioFileName: 'resume-discovery.mp3',
    audioFileSize: 1234
  }

  const expectedBatchDir = await createResumeDiscoveryBatch(outputRoot, '2026-04-16_09-00-00-000_files', {
    step1: baseStep1,
    step2: [],
    completionStatus: 'failed',
    requestedProviders: [
      { service: 'rev', model: 'machine', local: false, diarizationOptions: { enabled: true } }
    ],
    providerStates: [
      {
        service: 'rev',
        model: 'machine',
        local: false,
        status: 'failed',
        retryable: true
      }
    ],
    missingProviders: [
      { service: 'rev', model: 'machine', local: false, diarizationOptions: { enabled: true } }
    ]
  })

  await createResumeDiscoveryBatch(outputRoot, '2026-04-15_09-00-00-000_files', {
    step1: baseStep1,
    step2: [
      {
        transcriptionService: 'mistral',
        transcriptionModel: 'voxtral-mini-2602'
      },
      {
        transcriptionService: 'soniox',
        transcriptionModel: 'stt-async-v4'
      }
    ],
    completionStatus: 'full',
    requestedProviders: [
      { service: 'mistral', model: 'voxtral-mini-2602', local: false, diarizationOptions: { enabled: true } },
      { service: 'soniox', model: 'stt-async-v4', local: false, diarizationOptions: { enabled: true } }
    ],
    providerStates: [
      {
        service: 'mistral',
        model: 'voxtral-mini-2602',
        local: false,
        status: 'succeeded'
      },
      {
        service: 'soniox',
        model: 'stt-async-v4',
        local: false,
        status: 'succeeded'
      }
    ],
    missingProviders: []
  })

  await createResumeDiscoveryBatch(outputRoot, '2026-04-14_09-00-00-000_files', {
    step1: baseStep1,
    step2: [
      {
        transcriptionService: 'mistral',
        transcriptionModel: 'voxtral-mini-2602'
      }
    ],
    completionStatus: 'incomplete',
    requestedProviders: [
      { service: 'mistral', model: 'voxtral-mini-2602', local: false, diarizationOptions: { enabled: true } },
      { service: 'soniox', model: 'stt-async-v4', local: false, diarizationOptions: { enabled: true } }
    ],
    providerStates: [
      {
        service: 'mistral',
        model: 'voxtral-mini-2602',
        local: false,
        status: 'succeeded'
      },
      {
        service: 'soniox',
        model: 'stt-async-v4',
        local: false,
        status: 'failed',
        retryable: true
      }
    ],
    missingProviders: [
      { service: 'soniox', model: 'stt-async-v4', local: false, diarizationOptions: { enabled: true } }
    ]
  })

  expect(await discoverLatestResumableSttBatchDir(outputRoot)).toBe(expectedBatchDir)
})

test('discoverLatestResumableSttBatchDir skips newer incompatible batches when provider filters are supplied', async () => {
  const outputRoot = await mkdtemp(join(tmpdir(), 'autoshow-stt-resume-discovery-provider-'))
  tempDirs.push(outputRoot)

  const baseStep1 = {
    title: 'resume-discovery-provider',
    duration: '00:00:10',
    author: 'Local',
    description: '',
    url: `file://${resolve(STABLE_LOCAL_AUDIO_PATH)}`,
    slug: 'resume-discovery-provider',
    audioFileName: 'resume-discovery-provider.mp3',
    audioFileSize: 1234
  }

  await createResumeDiscoveryBatch(outputRoot, '2026-04-16_09-00-00-000_files', {
    step1: baseStep1,
    step2: [],
    completionStatus: 'failed',
    requestedProviders: [
      { service: 'deepgram', model: 'nova-3', local: false, diarizationOptions: { enabled: true } },
      { service: 'mistral', model: 'voxtral-mini-2602', local: false, diarizationOptions: { enabled: true } }
    ],
    providerStates: [
      {
        service: 'deepgram',
        model: 'nova-3',
        local: false,
        status: 'failed',
        retryable: true
      },
      {
        service: 'mistral',
        model: 'voxtral-mini-2602',
        local: false,
        status: 'missing',
        retryable: true
      }
    ],
    missingProviders: [
      { service: 'deepgram', model: 'nova-3', local: false, diarizationOptions: { enabled: true } },
      { service: 'mistral', model: 'voxtral-mini-2602', local: false, diarizationOptions: { enabled: true } }
    ]
  })

  const expectedBatchDir = await createResumeDiscoveryBatch(outputRoot, '2026-04-15_09-00-00-000_files', {
    step1: baseStep1,
    step2: [
      {
        transcriptionService: 'mistral',
        transcriptionModel: 'voxtral-mini-2602'
      }
    ],
    completionStatus: 'incomplete',
    requestedProviders: [
      { service: 'mistral', model: 'voxtral-mini-2602', local: false, diarizationOptions: { enabled: true } },
      { service: 'rev', model: 'machine', local: false, diarizationOptions: { enabled: true } }
    ],
    providerStates: [
      {
        service: 'mistral',
        model: 'voxtral-mini-2602',
        local: false,
        status: 'succeeded'
      },
      {
        service: 'rev',
        model: 'machine',
        local: false,
        status: 'failed',
        retryable: true
      }
    ],
    missingProviders: [
      { service: 'rev', model: 'machine', local: false, diarizationOptions: { enabled: true } }
    ]
  })

  expect(await discoverLatestResumableSttBatchDir(outputRoot, [
    { service: 'rev', model: 'machine', local: false, diarizationOptions: { enabled: true } }
  ])).toBe(expectedBatchDir)
})

test('discoverLatestResumableSttBatchDir treats caption-backed completion as complete when --youtube-captions is active', async () => {
  const outputRoot = await mkdtemp(join(tmpdir(), 'autoshow-stt-resume-youtube-captions-on-'))
  tempDirs.push(outputRoot)

  const batchDir = await createResumeDiscoveryBatch(outputRoot, '2026-04-16_09-00-00-000_files', {
    step1: {
      title: 'youtube-caption-complete',
      duration: '00:00:10',
      author: 'Local',
      description: '',
      url: 'https://www.youtube.com/watch?v=abc123',
      slug: 'youtube-caption-complete',
      audioFileName: 'youtube-caption-complete.mp3',
      audioFileSize: 1234
    },
    step2: [
      {
        transcriptionService: YOUTUBE_CAPTIONS_SERVICE,
        transcriptionModel: YOUTUBE_CAPTIONS_MODEL,
        processingTime: 100,
        tokenCount: 20,
        captionKind: 'manual',
        captionLanguage: 'en',
        captionFormat: 'vtt'
      }
    ],
    completionStatus: 'full',
    requestedProviders: [
      { service: YOUTUBE_CAPTIONS_SERVICE, model: YOUTUBE_CAPTIONS_MODEL, local: false }
    ],
    providerStates: [
      {
        service: YOUTUBE_CAPTIONS_SERVICE,
        model: YOUTUBE_CAPTIONS_MODEL,
        local: false,
        status: 'succeeded'
      }
    ],
    missingProviders: []
  })

  expect(await discoverLatestResumableSttBatchDir(outputRoot, undefined, {
    youtubeCaptions: true,
    currentTargets: []
  })).toBeUndefined()

  expect(batchDir).toContain('2026-04-16_09-00-00-000_files')
})

test('discoverLatestResumableSttBatchDir treats caption-backed completion as incomplete when --youtube-captions is disabled', async () => {
  const outputRoot = await mkdtemp(join(tmpdir(), 'autoshow-stt-resume-youtube-captions-off-'))
  tempDirs.push(outputRoot)

  const batchDir = await createResumeDiscoveryBatch(outputRoot, '2026-04-16_09-00-00-000_files', {
    step1: {
      title: 'youtube-caption-rerun',
      duration: '00:00:10',
      author: 'Local',
      description: '',
      url: 'https://www.youtube.com/watch?v=abc123',
      slug: 'youtube-caption-rerun',
      audioFileName: 'youtube-caption-rerun.mp3',
      audioFileSize: 1234
    },
    step2: [
      {
        transcriptionService: YOUTUBE_CAPTIONS_SERVICE,
        transcriptionModel: YOUTUBE_CAPTIONS_MODEL,
        processingTime: 100,
        tokenCount: 20,
        captionKind: 'manual',
        captionLanguage: 'en',
        captionFormat: 'vtt'
      }
    ],
    completionStatus: 'full',
    requestedProviders: [
      { service: YOUTUBE_CAPTIONS_SERVICE, model: YOUTUBE_CAPTIONS_MODEL, local: false }
    ],
    providerStates: [
      {
        service: YOUTUBE_CAPTIONS_SERVICE,
        model: YOUTUBE_CAPTIONS_MODEL,
        local: false,
        status: 'succeeded'
      }
    ],
    missingProviders: []
  })

  const currentTargets = [
    { service: 'deepgram' as const, model: 'nova-3', local: false, diarizationOptions: { enabled: true } }
  ]

  expect(await discoverLatestResumableSttBatchDir(outputRoot, currentTargets, {
    youtubeCaptions: false,
    currentTargets
  })).toBe(batchDir)
})

test('resumeSttMissingFromBatchDir reruns only missing providers into the existing outputDir', async () => {
  const batchDir = await mkdtemp(join(tmpdir(), 'autoshow-stt-resume-'))
  tempDirs.push(batchDir)

  const outputDir = join(batchDir, '2026-04-13_partial-item')
  const mistralDir = join(outputDir, 'providers', 'mistral-voxtral-mini-2602')
  await mkdir(mistralDir, { recursive: true })

  await Bun.write(join(mistralDir, 'transcription.txt'), '[00:00:00] [speaker-1] Existing Mistral transcript')
  await writeProviderResultFixture(mistralDir, 'mistral', 'voxtral-mini-2602', {
    transcriptionService: 'mistral',
    transcriptionModel: 'voxtral-mini-2602',
    processingTime: 100,
    tokenCount: 3
  }, {
    text: 'Existing Mistral transcript'
  })

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
        transcriptionModel: 'voxtral-mini-2602',
        processingTime: 100,
        tokenCount: 3
      }
    ],
    completionStatus: 'incomplete',
    requestedProviders: [
      { service: 'mistral', model: 'voxtral-mini-2602', local: false, diarizationOptions: { enabled: true } },
      { service: 'soniox', model: 'stt-async-v4', local: false, diarizationOptions: { enabled: true } }
    ],
    providerStates: [
      {
        service: 'mistral',
        model: 'voxtral-mini-2602',
        local: false,
        artifactDir: 'providers/mistral-voxtral-mini-2602',
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

  await writeRunManifestFixture(outputDir, 'stt', rootMetadata)
  await writeBatchManifestFixture(batchDir, 'stt', [
    {
      ...rootMetadata,
      outputDir
    }
  ])

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

  const events = await withCapturedLogs(async (captured) => {
    await resumeSttMissingFromBatchDir(batchDir, opts)
    return captured
  })

  expect(createCalls).toBe(1)
  expect(await Bun.file(join(outputDir, 'providers', 'soniox-stt-async-v4', 'transcription.txt')).exists()).toBe(true)

  const resumeItemEvents = events.filter((event) => event.message === 'Resume Item')
  expect(resumeItemEvents.map((event) => ({
    level: event.level,
    rows: event.humanTable?.rows
  }))).toEqual([
    {
      level: 'info',
      rows: [{
        item: '1/1',
        status: 'processing',
        outputDir,
        providers: 'soniox/stt-async-v4',
        detail: 'resuming missing providers'
      }]
    },
    {
      level: 'success',
      rows: [{
        item: '1/1',
        status: 'full',
        outputDir,
        providers: 'soniox/stt-async-v4',
        detail: 'resume complete'
      }]
    }
  ])
  const asyncJobEvent = events.find((event) => event.message === 'Async STT Job')
  expect(asyncJobEvent?.humanTable?.rows).toEqual([{
    provider: 'soniox/stt-async-v4',
    action: 'created',
    remoteId: 'tx-1',
    state: 'polling'
  }])

  const resumeSummaryEvent = events.find((event) => event.message === 'Resume Summary')
  expect(resumeSummaryEvent?.humanTable?.rows).toEqual([{
    full: 1,
    incomplete: 0,
    failed: 0
  }])

  const updatedMetadata = await readRunMetadata(outputDir)
  expect(updatedMetadata['completionStatus']).toBe('full')
  expect(Array.isArray(updatedMetadata['missingProviders'])).toBe(true)
  expect((updatedMetadata['missingProviders'] as unknown[])).toHaveLength(0)
  expect(Array.isArray(updatedMetadata['step2'])).toBe(true)
  expect((updatedMetadata['step2'] as unknown[])).toHaveLength(2)

  const info = await readBatchItems(batchDir)
  expect(info[0]).toEqual(expect.objectContaining({
    completionStatus: 'full',
    outputDir
  }))
})

test('resumeSttMissingFromBatchDir reuses persisted Soniox remote jobs before creating new work', async () => {
  const batchDir = await mkdtemp(join(tmpdir(), 'autoshow-stt-resume-runtime-'))
  tempDirs.push(batchDir)

  const outputDir = join(batchDir, '2026-04-13_partial-runtime-item')
  const mistralDir = join(outputDir, 'providers', 'mistral-voxtral-mini-2602')
  const sonioxDir = join(outputDir, 'providers', 'soniox-stt-async-v4')
  await mkdir(mistralDir, { recursive: true })
  await mkdir(sonioxDir, { recursive: true })

  await Bun.write(join(mistralDir, 'transcription.txt'), '[00:00:00] [speaker-1] Existing Mistral transcript')
  await writeProviderResultFixture(mistralDir, 'mistral', 'voxtral-mini-2602', {
    transcriptionService: 'mistral',
    transcriptionModel: 'voxtral-mini-2602',
    processingTime: 100,
    tokenCount: 3
  }, {
    text: 'Existing Mistral transcript'
  })

  await writeProviderCheckpointFixture(sonioxDir, 'soniox', 'stt-async-v4', {
    transcriptionService: 'soniox',
    transcriptionModel: 'stt-async-v4',
    processingTime: 10,
    tokenCount: 0,
    timings: {
      createMs: 10,
      createCount: 1
    },
    runtime: {
      mode: 'fresh',
      stage: 'polling',
      remoteJobId: 'tx-existing',
      remoteAssetId: 'file-existing',
      createCompletedAt: '2026-04-13T00:00:00.000Z'
    }
  })

  const rootMetadata = {
    step1: {
      title: 'resume-runtime-test',
      duration: '00:00:10',
      author: 'Local',
      description: '',
      url: `file://${resolve(STABLE_LOCAL_AUDIO_PATH)}`,
      slug: 'resume-runtime-test',
      audioFileName: 'resume-runtime-test.mp3',
      audioFileSize: 1234
    },
    step2: [
      {
        transcriptionService: 'mistral',
        transcriptionModel: 'voxtral-mini-2602',
        processingTime: 100,
        tokenCount: 3
      }
    ],
    completionStatus: 'incomplete',
    requestedProviders: [
      { service: 'mistral', model: 'voxtral-mini-2602', local: false, diarizationOptions: { enabled: true } },
      { service: 'soniox', model: 'stt-async-v4', local: false, diarizationOptions: { enabled: true } }
    ],
    providerStates: [
      {
        service: 'mistral',
        model: 'voxtral-mini-2602',
        local: false,
        artifactDir: 'providers/mistral-voxtral-mini-2602',
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
          message: 'timed out waiting for completion',
          retryable: true
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
        message: 'timed out waiting for completion',
        retryable: true
      }
    ]
  }

  await writeRunManifestFixture(outputDir, 'stt', rootMetadata)
  await writeBatchManifestFixture(batchDir, 'stt', [
    {
      ...rootMetadata,
      outputDir
    }
  ])

  process.env['SONIOX_API_KEY'] = 'soniox-test-key'
  process.env['SONIOX_BASE_URL'] = 'https://soniox.test'

  let uploadCalls = 0
  let createCalls = 0
  let statusCalls = 0
  globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input)
    const method = init?.method ?? 'GET'

    if (url === 'https://soniox.test/v1/files' && method === 'POST') {
      uploadCalls += 1
      return new Response(JSON.stringify({ id: 'file-new' }), {
        status: 200,
        headers: { 'content-type': 'application/json' }
      })
    }

    if (url === 'https://soniox.test/v1/transcriptions' && method === 'POST') {
      createCalls += 1
      return new Response(JSON.stringify({ id: 'tx-new', status: 'queued' }), {
        status: 201,
        headers: { 'content-type': 'application/json' }
      })
    }

    if (url === 'https://soniox.test/v1/transcriptions/tx-existing' && method === 'GET') {
      statusCalls += 1
      return new Response(JSON.stringify({
        id: 'tx-existing',
        status: 'completed'
      }), {
        status: 200,
        headers: { 'content-type': 'application/json' }
      })
    }

    if (url === 'https://soniox.test/v1/transcriptions/tx-existing/transcript' && method === 'GET') {
      return new Response(JSON.stringify({
        id: 'tx-existing',
        text: 'Resumed Soniox transcript.',
        tokens: [
          { text: 'Resumed Soniox transcript.', start_ms: 0, end_ms: 1000, speaker: 0 }
        ]
      }), {
        status: 200,
        headers: { 'content-type': 'application/json' }
      })
    }

    if (url === 'https://soniox.test/v1/transcriptions/tx-existing' && method === 'DELETE') {
      return new Response(null, { status: 204 })
    }

    if (url === 'https://soniox.test/v1/files/file-existing' && method === 'DELETE') {
      return new Response(null, { status: 204 })
    }

    throw new Error(`Unexpected request: ${method} ${url}`)
  }) as unknown as typeof fetch

  const opts = buildOptsFromFlags(false, {
    'no-cache': true
  })

  await resumeSttMissingFromBatchDir(batchDir, opts)

  expect(uploadCalls).toBe(0)
  expect(createCalls).toBe(0)
  expect(statusCalls).toBeGreaterThanOrEqual(1)
  expect(await Bun.file(join(outputDir, 'providers', 'soniox-stt-async-v4', 'transcription.txt')).exists()).toBe(true)

  const updatedProviderMetadata = await readProviderResultMetadata(join(outputDir, 'providers', 'soniox-stt-async-v4'))
  expect(updatedProviderMetadata['runtime']).toEqual(expect.objectContaining({
    mode: 'resumed',
    remoteJobId: 'tx-existing'
  }))

  const updatedMetadata = await readRunMetadata(outputDir)
  expect(updatedMetadata['completionStatus']).toBe('full')
  expect(Array.isArray(updatedMetadata['step2'])).toBe(true)
  expect((updatedMetadata['step2'] as unknown[])).toHaveLength(2)
})
