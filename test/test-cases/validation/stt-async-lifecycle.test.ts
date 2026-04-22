import { afterEach, describe, expect, test } from 'bun:test'
import {
  ASYNC_STT_RESUME_PROBE_DELAYS_MS,
  pollAsyncSttJobUntilComplete,
  resolveAsyncSttPollDeadlineMs
} from '~/cli/commands/process-steps/step-2-stt/async-lifecycle'
import { runAssemblyAiTranscribe } from '~/cli/commands/process-steps/step-2-stt/stt-services/assemblyai/run-assemblyai-stt'
import { runGladiaStt } from '~/cli/commands/process-steps/step-2-stt/stt-services/gladia/run-gladia-stt'
import { runHappyScribeStt } from '~/cli/commands/process-steps/step-2-stt/stt-services/happyscribe/run-happyscribe-stt'
import { runRevStt } from '~/cli/commands/process-steps/step-2-stt/stt-services/rev/run-rev-stt'
import { runSpeechmaticsStt } from '~/cli/commands/process-steps/step-2-stt/stt-services/speechmatics/run-speechmatics-stt'
import { readProviderCheckpointMetadata, writeProviderCheckpointFixture } from '../../test-utils/manifest-helpers'
import {
  createTempOutputTracker,
  restoreSleep,
  snapshotEnv
} from '../../test-utils/stt-runtime-helpers'

const originalFetch = globalThis.fetch
const originalBunSleep = Bun.sleep
const restoreEnv = snapshotEnv([
  'AUTOSHOW_STT_POLL_DEADLINE_MS_TEST',
  'ASSEMBLYAI_API_KEY',
  'ASSEMBLYAI_BASE_URL',
  'GLADIA_API_KEY',
  'GLADIA_BASE_URL',
  'HAPPYSCRIBE_API_KEY',
  'HAPPYSCRIBE_BASE_URL',
  'HAPPYSCRIBE_ORGANIZATION_ID',
  'REVAI_ACCESS_TOKEN',
  'REVAI_BASE_URL',
  'SPEECHMATICS_API_KEY',
  'SPEECHMATICS_BASE_URL'
] as const)
const tempOutput = createTempOutputTracker()

type ResumeProbeCounts = {
  uploadAttempts: number
  createAttempts: number
  pollAttempts: number
  deleteAttempts: number
}

type ResumeProbeCase = {
  name: string
  fixturePrefix: string
  service: 'assemblyai' | 'gladia' | 'happyscribe' | 'speechmatics' | 'rev'
  model: string
  runtime: Record<string, unknown>
  setupEnv: () => void
  installFetch: (counts: ResumeProbeCounts) => void
  invoke: (audioPath: string, outputDir: string) => Promise<unknown>
  assertCounts: (counts: ResumeProbeCounts) => void
  assertRuntime: (runtime: Record<string, unknown>) => void
}

const createResumeProbeCounts = (): ResumeProbeCounts => ({
  uploadAttempts: 0,
  createAttempts: 0,
  pollAttempts: 0,
  deleteAttempts: 0
})

afterEach(async () => {
  globalThis.fetch = originalFetch
  restoreSleep(originalBunSleep)
  restoreEnv()
  await tempOutput.cleanup()
})

test('resolveAsyncSttPollDeadlineMs keeps a 10 minute minimum by default', () => {
  expect(resolveAsyncSttPollDeadlineMs(undefined, 'AUTOSHOW_STT_POLL_DEADLINE_MS_TEST')).toBe(600_000)
  expect(resolveAsyncSttPollDeadlineMs(1_000, 'AUTOSHOW_STT_POLL_DEADLINE_MS_TEST')).toBe(600_000)
})

test('resolveAsyncSttPollDeadlineMs scales with duration and caps at 30 minutes', () => {
  expect(resolveAsyncSttPollDeadlineMs(3_000, 'AUTOSHOW_STT_POLL_DEADLINE_MS_TEST')).toBe(750_000)
  expect(resolveAsyncSttPollDeadlineMs(10_000, 'AUTOSHOW_STT_POLL_DEADLINE_MS_TEST')).toBe(1_800_000)
})

test('resolveAsyncSttPollDeadlineMs still honors explicit overrides', () => {
  process.env['AUTOSHOW_STT_POLL_DEADLINE_MS_TEST'] = '12345'
  expect(resolveAsyncSttPollDeadlineMs(10_000, 'AUTOSHOW_STT_POLL_DEADLINE_MS_TEST')).toBe(12345)
})

test('pollAsyncSttJobUntilComplete uses bounded resume probes for persisted async jobs', async () => {
  const slept: number[] = []
  ;(Bun as typeof Bun & { sleep: typeof Bun.sleep }).sleep = (async (ms: number) => {
    slept.push(ms)
  }) as typeof Bun.sleep

  let polls = 0
  const totalWaitMs = ASYNC_STT_RESUME_PROBE_DELAYS_MS.reduce<number>((sum, delayMs) => sum + delayMs, 0)

  await expect(
    pollAsyncSttJobUntilComplete({
      jobId: 'tx-pending',
      initialPollIntervalMs: 1_000,
      maxPollIntervalMs: 10_000,
      envSpecificDeadlineKey: 'AUTOSHOW_STT_POLL_DEADLINE_MS_TEST',
      pollMode: 'resume-probe',
      poll: async () => {
        polls += 1
        return {
          status: { status: 'processing' as const },
          retryAfterMs: null
        }
      },
      isComplete: () => false,
      isFailed: () => undefined,
      buildDeadlineError: (_jobId, pollDeadlineMs) => {
        throw new Error(`deadline ${pollDeadlineMs}`)
      },
      buildResumeProbeError: (_jobId, probeCount, waitMs) => {
        throw new Error(`resume-probe ${probeCount} ${waitMs}`)
      }
    })
  ).rejects.toThrow(`resume-probe ${ASYNC_STT_RESUME_PROBE_DELAYS_MS.length} ${totalWaitMs}`)

  expect(polls).toBe(ASYNC_STT_RESUME_PROBE_DELAYS_MS.length)
  expect(slept).toEqual(ASYNC_STT_RESUME_PROBE_DELAYS_MS.filter((delayMs) => delayMs > 0))
})

const RESUME_PROBE_CASES: ResumeProbeCase[] = [
  {
    name: 'AssemblyAI resumes a persisted job without uploading or creating a new transcript',
    fixturePrefix: 'autoshow-assemblyai-stt-',
    service: 'assemblyai',
    model: 'universal-3-pro',
    runtime: {
      mode: 'fresh',
      stage: 'polling',
      remoteJobId: 'tx-existing',
      remoteAssetUrl: 'https://cdn.assemblyai.test/audio.wav',
      createCompletedAt: '2026-04-14T00:00:00.000Z'
    },
    setupEnv: () => {
      process.env['ASSEMBLYAI_API_KEY'] = 'test-key'
      process.env['ASSEMBLYAI_BASE_URL'] = 'https://assemblyai.test'
    },
    installFetch: (counts) => {
      globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
        const url = String(input)

        if (url === 'https://assemblyai.test/v2/upload') {
          counts.uploadAttempts += 1
          throw new Error('unexpected upload')
        }

        if (url === 'https://assemblyai.test/v2/transcript' && init?.method === 'POST') {
          counts.createAttempts += 1
          throw new Error('unexpected create')
        }

        if (url === 'https://assemblyai.test/v2/transcript/tx-existing' && init?.method === 'GET') {
          counts.pollAttempts += 1
          return new Response(JSON.stringify({
            id: 'tx-existing',
            status: 'processing'
          }), {
            status: 200,
            headers: { 'content-type': 'application/json' }
          })
        }

        throw new Error(`Unexpected fetch: ${init?.method ?? 'GET'} ${url}`)
      }) as unknown as typeof fetch
    },
    invoke: async (audioPath, outputDir) => await runAssemblyAiTranscribe(audioPath, outputDir, {
      model: 'universal-3-pro',
      segmentOffsetMinutes: 0,
      runMode: 'backfill'
    }),
    assertCounts: (counts) => {
      expect(counts).toEqual({
        uploadAttempts: 0,
        createAttempts: 0,
        pollAttempts: 5,
        deleteAttempts: 0
      })
    },
    assertRuntime: (runtime) => {
      expect(runtime).toEqual(expect.objectContaining({
        mode: 'resumed',
        stage: 'polling',
        remoteJobId: 'tx-existing',
        remoteAssetUrl: 'https://cdn.assemblyai.test/audio.wav'
      }))
    }
  },
  {
    name: 'Gladia resumes a persisted job without uploading or creating a new transcript',
    fixturePrefix: 'autoshow-gladia-stt-',
    service: 'gladia',
    model: 'default',
    runtime: {
      mode: 'fresh',
      stage: 'polling',
      remoteJobId: 'tx-existing',
      remoteAssetId: 'asset-existing',
      remoteAssetUrl: 'https://cdn.gladia.test/audio.wav',
      createCompletedAt: '2026-04-14T00:00:00.000Z'
    },
    setupEnv: () => {
      process.env['GLADIA_API_KEY'] = 'test-key'
      process.env['GLADIA_BASE_URL'] = 'https://gladia.test'
    },
    installFetch: (counts) => {
      globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
        const url = String(input)

        if (url === 'https://gladia.test/v2/upload') {
          counts.uploadAttempts += 1
          throw new Error('unexpected upload')
        }

        if (url === 'https://gladia.test/v2/pre-recorded' && init?.method === 'POST') {
          counts.createAttempts += 1
          throw new Error('unexpected create')
        }

        if (url === 'https://gladia.test/v2/pre-recorded/tx-existing' && init?.method === 'GET') {
          counts.pollAttempts += 1
          return new Response(JSON.stringify({
            id: 'tx-existing',
            status: 'processing'
          }), {
            status: 200,
            headers: { 'content-type': 'application/json' }
          })
        }

        throw new Error(`Unexpected fetch: ${init?.method ?? 'GET'} ${url}`)
      }) as unknown as typeof fetch
    },
    invoke: async (audioPath, outputDir) => await runGladiaStt(audioPath, outputDir, {
      model: 'default',
      segmentOffsetMinutes: 0,
      runMode: 'backfill'
    }),
    assertCounts: (counts) => {
      expect(counts).toEqual({
        uploadAttempts: 0,
        createAttempts: 0,
        pollAttempts: 5,
        deleteAttempts: 0
      })
    },
    assertRuntime: (runtime) => {
      expect(runtime).toEqual(expect.objectContaining({
        mode: 'resumed',
        stage: 'polling',
        remoteJobId: 'tx-existing',
        remoteAssetId: 'asset-existing',
        remoteAssetUrl: 'https://cdn.gladia.test/audio.wav'
      }))
    }
  },
  {
    name: 'Happy Scribe resumes a persisted order without uploading or creating a new order',
    fixturePrefix: 'autoshow-happyscribe-stt-',
    service: 'happyscribe',
    model: 'auto',
    runtime: {
      mode: 'fresh',
      stage: 'polling',
      remoteJobId: 'order-existing',
      remoteAssetUrl: 'https://uploads.happyscribe.test/upload-existing',
      createCompletedAt: '2026-04-15T00:00:00.000Z'
    },
    setupEnv: () => {
      process.env['HAPPYSCRIBE_API_KEY'] = 'test-key'
      process.env['HAPPYSCRIBE_BASE_URL'] = 'https://happyscribe.test'
    },
    installFetch: (counts) => {
      globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
        const url = String(input)
        const method = init?.method ?? 'GET'

        if (url === 'https://happyscribe.test/organizations' && method === 'GET') {
          return new Response(JSON.stringify({
            organizations: [
              { id: 'org-existing', name: 'Existing Org', currency: 'usd' }
            ]
          }), {
            status: 200,
            headers: { 'content-type': 'application/json' }
          })
        }

        if (url.startsWith('https://happyscribe.test/uploads/new') && method === 'GET') {
          counts.uploadAttempts += 1
          throw new Error('unexpected upload-url request')
        }

        if (url === 'https://happyscribe.test/orders' && method === 'POST') {
          counts.createAttempts += 1
          throw new Error('unexpected create')
        }

        if (url === 'https://happyscribe.test/orders/order-existing' && method === 'GET') {
          counts.pollAttempts += 1
          return new Response(JSON.stringify({
            id: 'order-existing',
            state: 'submitted',
            outputsIds: ['tx-existing'],
            transcriptions: [
              { id: 'tx-existing', uuid: 'tx-existing', state: 'submitted' }
            ]
          }), {
            status: 200,
            headers: { 'content-type': 'application/json' }
          })
        }

        throw new Error(`Unexpected fetch: ${method} ${url}`)
      }) as unknown as typeof fetch
    },
    invoke: async (audioPath, outputDir) => await runHappyScribeStt(audioPath, outputDir, {
      model: 'auto',
      segmentOffsetMinutes: 0,
      runMode: 'backfill'
    }),
    assertCounts: (counts) => {
      expect(counts).toEqual({
        uploadAttempts: 0,
        createAttempts: 0,
        pollAttempts: 5,
        deleteAttempts: 0
      })
    },
    assertRuntime: (runtime) => {
      expect(runtime).toEqual(expect.objectContaining({
        mode: 'resumed',
        stage: 'polling',
        remoteJobId: 'order-existing',
        remoteAssetUrl: 'https://uploads.happyscribe.test/upload-existing'
      }))
    }
  },
  {
    name: 'Speechmatics resumes a persisted job without creating or deleting remote work',
    fixturePrefix: 'autoshow-speechmatics-stt-',
    service: 'speechmatics',
    model: 'standard',
    runtime: {
      mode: 'fresh',
      stage: 'polling',
      remoteJobId: 'job-existing',
      createCompletedAt: '2026-04-15T00:00:00.000Z'
    },
    setupEnv: () => {
      process.env['SPEECHMATICS_API_KEY'] = 'test-key'
      process.env['SPEECHMATICS_BASE_URL'] = 'https://speechmatics.test'
    },
    installFetch: (counts) => {
      globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
        const url = String(input)
        const method = init?.method ?? 'GET'

        if (url === 'https://speechmatics.test/v2/jobs' && method === 'POST') {
          counts.createAttempts += 1
          throw new Error('unexpected create')
        }

        if (url === 'https://speechmatics.test/v2/jobs/job-existing' && method === 'GET') {
          counts.pollAttempts += 1
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
          counts.deleteAttempts += 1
          return new Response(null, { status: 204 })
        }

        throw new Error(`Unexpected fetch: ${method} ${url}`)
      }) as unknown as typeof fetch
    },
    invoke: async (audioPath, outputDir) => await runSpeechmaticsStt(audioPath, outputDir, {
      model: 'standard',
      segmentOffsetMinutes: 0,
      runMode: 'backfill'
    }),
    assertCounts: (counts) => {
      expect(counts).toEqual({
        uploadAttempts: 0,
        createAttempts: 0,
        pollAttempts: 5,
        deleteAttempts: 0
      })
    },
    assertRuntime: (runtime) => {
      expect(runtime).toEqual(expect.objectContaining({
        mode: 'resumed',
        stage: 'polling',
        remoteJobId: 'job-existing'
      }))
    }
  },
  {
    name: 'Rev resumes a persisted job without creating a new remote job',
    fixturePrefix: 'autoshow-rev-stt-',
    service: 'rev',
    model: 'machine',
    runtime: {
      mode: 'fresh',
      stage: 'polling',
      remoteJobId: 'job-existing',
      createCompletedAt: '2026-04-15T00:00:00.000Z'
    },
    setupEnv: () => {
      process.env['REVAI_ACCESS_TOKEN'] = 'test-token'
      process.env['REVAI_BASE_URL'] = 'https://rev.test'
    },
    installFetch: (counts) => {
      globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
        const url = String(input)
        const method = init?.method ?? 'GET'

        if (url === 'https://rev.test/jobs' && method === 'POST') {
          counts.createAttempts += 1
          throw new Error('unexpected create')
        }

        if (url === 'https://rev.test/jobs/job-existing' && method === 'GET') {
          counts.pollAttempts += 1
          return new Response(JSON.stringify({
            id: 'job-existing',
            status: 'in_progress'
          }), {
            status: 200,
            headers: { 'content-type': 'application/json' }
          })
        }

        if (url === 'https://rev.test/jobs/job-existing' && method === 'DELETE') {
          counts.deleteAttempts += 1
          return new Response(null, { status: 204 })
        }

        throw new Error(`Unexpected fetch: ${method} ${url}`)
      }) as unknown as typeof fetch
    },
    invoke: async (audioPath, outputDir) => await runRevStt(audioPath, outputDir, {
      model: 'machine',
      segmentOffsetMinutes: 0,
      runMode: 'backfill'
    }),
    assertCounts: (counts) => {
      expect(counts).toEqual({
        uploadAttempts: 0,
        createAttempts: 0,
        pollAttempts: 5,
        deleteAttempts: 0
      })
    },
    assertRuntime: (runtime) => {
      expect(runtime).toEqual(expect.objectContaining({
        mode: 'resumed',
        stage: 'polling',
        remoteJobId: 'job-existing'
      }))
    }
  }
]

describe('async STT provider resume probe wiring', () => {
  for (const providerCase of RESUME_PROBE_CASES) {
    test(providerCase.name, async () => {
      const { audioPath, outputDir } = await tempOutput.createAudioFixture(providerCase.fixturePrefix)
      providerCase.setupEnv()

      await writeProviderCheckpointFixture(outputDir, providerCase.service, providerCase.model, {
        transcriptionService: providerCase.service,
        transcriptionModel: providerCase.model,
        processingTime: 10,
        tokenCount: 0,
        runtime: providerCase.runtime
      })

      const slept: number[] = []
      ;(Bun as typeof Bun & { sleep: typeof Bun.sleep }).sleep = (async (ms: number) => {
        slept.push(ms)
      }) as typeof Bun.sleep

      const counts = createResumeProbeCounts()
      providerCase.installFetch(counts)

      await expect(providerCase.invoke(audioPath, outputDir)).rejects.toThrow('still pending after 5 resume status checks')

      expect(slept).toEqual(ASYNC_STT_RESUME_PROBE_DELAYS_MS.filter((delayMs) => delayMs > 0))
      providerCase.assertCounts(counts)

      const metadata = await readProviderCheckpointMetadata(outputDir)
      providerCase.assertRuntime((metadata['runtime'] ?? {}) as Record<string, unknown>)
    })
  }
})
