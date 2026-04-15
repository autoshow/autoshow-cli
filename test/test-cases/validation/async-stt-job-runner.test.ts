import { afterEach, expect, test } from 'bun:test'
import {
  ASYNC_STT_RESUME_PROBE_DELAYS_MS,
  pollAsyncSttJobUntilComplete,
  resolveAsyncSttPollDeadlineMs
} from '~/cli/commands/process-steps/step-2-stt/stt-utils/async-stt-job-runner'

const originalBunSleep = Bun.sleep
const originalPollDeadlineOverride = process.env['AUTOSHOW_STT_POLL_DEADLINE_MS_TEST']

afterEach(() => {
  ;(Bun as typeof Bun & { sleep: typeof Bun.sleep }).sleep = originalBunSleep

  if (originalPollDeadlineOverride === undefined) {
    delete process.env['AUTOSHOW_STT_POLL_DEADLINE_MS_TEST']
  } else {
    process.env['AUTOSHOW_STT_POLL_DEADLINE_MS_TEST'] = originalPollDeadlineOverride
  }
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
  const totalWaitMs = ASYNC_STT_RESUME_PROBE_DELAYS_MS.reduce((sum, delayMs) => sum + delayMs, 0)

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
