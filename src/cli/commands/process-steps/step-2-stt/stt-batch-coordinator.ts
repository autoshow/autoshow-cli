import type { SttTarget } from './stt-targets'

export type SttBatchBlockedProviderReason = {
  service: SttTarget['service']
  model: string
  local: boolean
  message: string
  retryable: boolean
  stage?: string | undefined
  status?: number | undefined
  degraded?: boolean | undefined
}

export type SttBatchAttemptDecision =
  | { action: 'run' }
  | { action: 'skip', reason: SttBatchBlockedProviderReason }
  | { action: 'defer' }

export type SttBatchProviderAvailability =
  | { action: 'run', activeCount: number, slotLimit: number }
  | { action: 'skip', reason: SttBatchBlockedProviderReason, activeCount: number, slotLimit: number }
  | { action: 'defer', activeCount: number, slotLimit: number, cooldownMs?: number | undefined }

export type SttBatchProviderStatsSnapshot = {
  service: SttTarget['service']
  model: string
  kind: 'sync' | 'async'
  launchSlotLimit: number
  pollSlotLimit: number
  launchedCount: number
  completedCount: number
  blockedCount: number
  degradedCount: number
  queueWaitMs: number
  pollCount: number
  backfillCount: number
  warmupComplete: boolean
}

export type SttBatchSchedulerSnapshot = {
  providers: SttBatchProviderStatsSnapshot[]
}

type AvailabilityWaiter = {
  resolved: boolean
  notify: () => void
  timer?: ReturnType<typeof setTimeout> | undefined
}

type ProviderStats = {
  launchedCount: number
  completedCount: number
  blockedCount: number
  degradedCount: number
  queueWaitMs: number
  pollCount: number
  backfillCount: number
}

type ProviderState = {
  activeCount: number
  pollActiveCount: number
  blockedReason?: SttBatchBlockedProviderReason | undefined
  waiters: AvailabilityWaiter[]
  pollWaiters: AvailabilityWaiter[]
  cooldownUntil?: number | undefined
  warmupComplete: boolean
  consecutiveRetryableFailures: number
  stats: ProviderStats
}

type ProviderFailureSummary = {
  message: string
  retryable: boolean
  stage?: string | undefined
  status?: number | undefined
}

type ProviderProfile = {
  kind: 'sync' | 'async'
  launchSlotLimit: number
  pollSlotLimit: number
}

const DEFAULT_PROVIDER_SLOT_LIMIT = 2
const DEFAULT_DEEPGRAM_SLOT_LIMIT = 4
const DEFAULT_ELEVENLABS_SLOT_LIMIT = 2
const DEFAULT_ASYNC_CREATE_SLOT_LIMIT = 2
const MAX_PROVIDER_SLOT_LIMIT = 8
const MAX_PROVIDER_COOLDOWN_MS = 5 * 60 * 1000
const MAX_POLL_SLOT_LIMIT = 8
const RETRYABLE_FAILURE_DEGRADE_THRESHOLD = 2

const getTargetKey = (target: Pick<SttTarget, 'service' | 'model'>): string =>
  `${target.service}:${target.model}`

const formatTargetLabel = (target: Pick<SttTarget, 'service' | 'model'>): string =>
  `${target.service === 'whisper' ? 'whisper.cpp' : target.service}/${target.model}`

const isAsyncBatchProvider = (target: Pick<SttTarget, 'service'>): boolean =>
  target.service === 'assemblyai' || target.service === 'soniox'

const cloneBlockedReason = (
  reason: SttBatchBlockedProviderReason
): SttBatchBlockedProviderReason => ({
  service: reason.service,
  model: reason.model,
  local: reason.local,
  message: reason.message,
  retryable: reason.retryable,
  ...(reason.stage ? { stage: reason.stage } : {}),
  ...(typeof reason.status === 'number' ? { status: reason.status } : {}),
  ...(reason.degraded === true ? { degraded: true } : {})
})

const wakeWaiters = (waiters: AvailabilityWaiter[]): void => {
  const pending = waiters.splice(0)
  for (const waiter of pending) {
    waiter.notify()
  }
}

const normalizeEnvSegment = (value: string): string =>
  value.replace(/[^a-zA-Z0-9]+/g, '_').replace(/^_+|_+$/g, '').toUpperCase()

const parsePositiveIntegerEnv = (key: string): number | undefined => {
  const raw = process.env[key]?.trim()
  if (!raw) {
    return undefined
  }

  const parsed = Number.parseInt(raw, 10)
  if (!Number.isFinite(parsed) || parsed < 1) {
    return undefined
  }

  return Math.min(MAX_PROVIDER_SLOT_LIMIT, parsed)
}

const normalizeCooldownMs = (value: number | undefined): number | undefined => {
  if (!Number.isFinite(value) || (value ?? 0) <= 0) {
    return undefined
  }

  return Math.min(MAX_PROVIDER_COOLDOWN_MS, Math.round(value as number))
}

const getDefaultProviderSlotLimit = (
  target: Pick<SttTarget, 'service' | 'local'>
): number => {
  if (target.local) {
    return 1
  }

  if (target.service === 'deepgram') {
    return DEFAULT_DEEPGRAM_SLOT_LIMIT
  }

  if (target.service === 'elevenlabs') {
    return DEFAULT_ELEVENLABS_SLOT_LIMIT
  }

  if (isAsyncBatchProvider(target)) {
    return DEFAULT_ASYNC_CREATE_SLOT_LIMIT
  }

  return DEFAULT_PROVIDER_SLOT_LIMIT
}

export const resolveSttBatchProviderSlotLimit = (
  target: Pick<SttTarget, 'service' | 'model' | 'local'>
): number => {
  if (target.local) {
    return 1
  }

  const serviceKey = normalizeEnvSegment(target.service)
  const modelKey = normalizeEnvSegment(target.model)
  const modelScoped = parsePositiveIntegerEnv(`AUTOSHOW_STT_PROVIDER_SLOT_LIMIT_${serviceKey}_${modelKey}`)
  if (modelScoped !== undefined) {
    return modelScoped
  }

  const serviceScoped = parsePositiveIntegerEnv(`AUTOSHOW_STT_PROVIDER_SLOT_LIMIT_${serviceKey}`)
  if (serviceScoped !== undefined) {
    return serviceScoped
  }

  const globalScoped = parsePositiveIntegerEnv('AUTOSHOW_STT_PROVIDER_SLOT_LIMIT')
  if (globalScoped !== undefined) {
    return globalScoped
  }

  return getDefaultProviderSlotLimit(target)
}

export const resolveSttBatchPollSlotLimit = (
  target: Pick<SttTarget, 'service' | 'local'>,
  batchConcurrency: number
): number => {
  if (target.local || !isAsyncBatchProvider(target)) {
    return 0
  }

  return Math.min(MAX_POLL_SLOT_LIMIT, Math.max(1, batchConcurrency))
}

export const describeSttBatchProviderSlotLimits = (
  targets: Array<Pick<SttTarget, 'service' | 'model' | 'local'>>,
  batchConcurrency = 1
): string => {
  const seen = new Set<string>()
  return targets
    .filter((target) => !target.local)
    .filter((target) => {
      const key = getTargetKey(target)
      if (seen.has(key)) {
        return false
      }
      seen.add(key)
      return true
    })
    .map((target) => {
      const launchSlotLimit = resolveSttBatchProviderSlotLimit(target)
      if (!isAsyncBatchProvider(target)) {
        return `${formatTargetLabel(target)}:launch=${launchSlotLimit}`
      }

      const pollSlotLimit = resolveSttBatchPollSlotLimit(target, batchConcurrency)
      return `${formatTargetLabel(target)}:create=${launchSlotLimit},poll=${pollSlotLimit}`
    })
    .join(', ')
}

export const formatSttBatchSchedulerSummary = (
  snapshot: SttBatchSchedulerSnapshot
): string | undefined => {
  if (snapshot.providers.length === 0) {
    return undefined
  }

  return snapshot.providers
    .map((provider) => {
      const parts = [
        `${formatTargetLabel(provider)}`,
        provider.kind === 'async'
          ? `create=${provider.launchSlotLimit},poll=${provider.pollSlotLimit}`
          : `launch=${provider.launchSlotLimit}`,
        `launched=${provider.launchedCount}`,
        `completed=${provider.completedCount}`,
        `queueWait=${provider.queueWaitMs}ms`,
        provider.kind === 'async' ? `polls=${provider.pollCount}` : undefined,
        provider.blockedCount > 0 ? `blocked=${provider.blockedCount}` : undefined,
        provider.degradedCount > 0 ? `degraded=${provider.degradedCount}` : undefined,
        provider.backfillCount > 0 ? `backfill=${provider.backfillCount}` : undefined,
        provider.warmupComplete ? 'warm=true' : 'warm=false'
      ].filter((entry): entry is string => typeof entry === 'string')

      return parts.join(' ')
    })
    .join(' | ')
}

export class SttBatchCoordinator {
  readonly #providerStates = new Map<string, ProviderState>()
  readonly #batchConcurrency: number

  constructor(options: { batchConcurrency?: number | undefined } = {}) {
    this.#batchConcurrency = Math.max(1, options.batchConcurrency ?? 1)
  }

  #getState(target: Pick<SttTarget, 'service' | 'model'>): ProviderState {
    const key = getTargetKey(target)
    let state = this.#providerStates.get(key)
    if (!state) {
      state = {
        activeCount: 0,
        pollActiveCount: 0,
        waiters: [],
        pollWaiters: [],
        warmupComplete: false,
        consecutiveRetryableFailures: 0,
        stats: {
          launchedCount: 0,
          completedCount: 0,
          blockedCount: 0,
          degradedCount: 0,
          queueWaitMs: 0,
          pollCount: 0,
          backfillCount: 0
        }
      }
      this.#providerStates.set(key, state)
    }
    return state
  }

  #getProfile(target: Pick<SttTarget, 'service' | 'model' | 'local'>): ProviderProfile {
    return {
      kind: isAsyncBatchProvider(target) ? 'async' : 'sync',
      launchSlotLimit: resolveSttBatchProviderSlotLimit(target),
      pollSlotLimit: resolveSttBatchPollSlotLimit(target, this.#batchConcurrency)
    }
  }

  #clearExpiredCooldown(state: ProviderState): void {
    if (state.cooldownUntil !== undefined && state.cooldownUntil <= Date.now()) {
      state.cooldownUntil = undefined
    }
  }

  #getEffectiveLaunchSlotLimit(
    target: Pick<SttTarget, 'service' | 'model' | 'local'>,
    state: ProviderState
  ): number {
    const launchSlotLimit = this.#getProfile(target).launchSlotLimit
    return state.warmupComplete
      ? launchSlotLimit
      : Math.min(1, launchSlotLimit)
  }

  #buildDegradedReason(
    target: SttTarget,
    failure: ProviderFailureSummary
  ): SttBatchBlockedProviderReason {
    return {
      service: target.service,
      model: target.model,
      local: target.local,
      message: `Deferred remaining live-batch work after repeated retryable failures: ${failure.message}`,
      retryable: true,
      ...(failure.stage ? { stage: failure.stage } : {}),
      ...(typeof failure.status === 'number' ? { status: failure.status } : {}),
      degraded: true
    }
  }

  peekProviderAvailability(target: SttTarget): SttBatchProviderAvailability {
    if (target.local) {
      return { action: 'run', activeCount: 0, slotLimit: 1 }
    }

    const state = this.#getState(target)
    this.#clearExpiredCooldown(state)
    const slotLimit = this.#getEffectiveLaunchSlotLimit(target, state)

    if (state.blockedReason) {
      return {
        action: 'skip',
        reason: cloneBlockedReason(state.blockedReason),
        activeCount: state.activeCount,
        slotLimit
      }
    }

    if (state.cooldownUntil !== undefined) {
      return {
        action: 'defer',
        activeCount: state.activeCount,
        slotLimit,
        cooldownMs: Math.max(0, state.cooldownUntil - Date.now())
      }
    }

    if (state.activeCount < slotLimit) {
      return {
        action: 'run',
        activeCount: state.activeCount,
        slotLimit
      }
    }

    return {
      action: 'defer',
      activeCount: state.activeCount,
      slotLimit
    }
  }

  tryReserveProvider(target: SttTarget): SttBatchAttemptDecision {
    const availability = this.peekProviderAvailability(target)
    if (availability.action !== 'run') {
      return availability.action === 'skip'
        ? { action: 'skip', reason: availability.reason }
        : { action: 'defer' }
    }

    const state = this.#getState(target)
    state.activeCount += 1
    state.stats.launchedCount += 1
    return { action: 'run' }
  }

  releaseProviderSlot(
    target: SttTarget,
    options: { warmupSuccess?: boolean | undefined } = {}
  ): void {
    if (target.local) {
      return
    }

    const state = this.#getState(target)
    if (state.activeCount > 0) {
      state.activeCount -= 1
    }

    if (options.warmupSuccess) {
      state.warmupComplete = true
      state.consecutiveRetryableFailures = 0
      state.cooldownUntil = undefined
    }

    wakeWaiters(state.waiters)
  }

  noteProviderQueueWait(target: SttTarget, queueWaitMs: number): void {
    if (target.local || queueWaitMs <= 0) {
      return
    }

    const state = this.#getState(target)
    state.stats.queueWaitMs += Math.max(0, Math.round(queueWaitMs))
  }

  noteBackfill(target: SttTarget): void {
    if (target.local) {
      return
    }

    const state = this.#getState(target)
    state.stats.backfillCount += 1
  }

  async withPollSlot<T>(
    target: SttTarget,
    fn: () => Promise<T>
  ): Promise<T> {
    if (target.local) {
      return await fn()
    }

    const profile = this.#getProfile(target)
    if (profile.kind !== 'async' || profile.pollSlotLimit <= 0) {
      return await fn()
    }

    const state = this.#getState(target)
    while (state.pollActiveCount >= profile.pollSlotLimit) {
      await new Promise<void>((resolve) => {
        const waiter: AvailabilityWaiter = {
          resolved: false,
          notify: () => {
            if (waiter.resolved) {
              return
            }
            waiter.resolved = true
            state.pollWaiters = state.pollWaiters.filter((entry) => entry !== waiter)
            resolve()
          }
        }

        state.pollWaiters.push(waiter)
      })
    }

    state.pollActiveCount += 1
    state.stats.pollCount += 1
    try {
      return await fn()
    } finally {
      state.pollActiveCount = Math.max(0, state.pollActiveCount - 1)
      wakeWaiters(state.pollWaiters)
    }
  }

  async waitForAvailability(targets: SttTarget[]): Promise<void> {
    const uniqueTargets = targets.filter((target, index) =>
      targets.findIndex((candidate) =>
        candidate.service === target.service && candidate.model === target.model
      ) === index
    )

    if (uniqueTargets.length === 0) {
      return
    }

    let nearestCooldownMs: number | undefined
    for (const target of uniqueTargets) {
      const availability = this.peekProviderAvailability(target)
      if (availability.action !== 'defer') {
        return
      }

      if (availability.cooldownMs !== undefined) {
        nearestCooldownMs = nearestCooldownMs === undefined
          ? availability.cooldownMs
          : Math.min(nearestCooldownMs, availability.cooldownMs)
      }
    }

    await new Promise<void>((resolve) => {
      const waiter: AvailabilityWaiter = {
        resolved: false,
        notify: () => {
          if (waiter.resolved) {
            return
          }
          waiter.resolved = true
          if (waiter.timer) {
            clearTimeout(waiter.timer)
          }
          for (const target of uniqueTargets) {
            const state = this.#getState(target)
            state.waiters = state.waiters.filter((entry) => entry !== waiter)
          }
          resolve()
        }
      }

      if (nearestCooldownMs !== undefined && nearestCooldownMs > 0) {
        waiter.timer = setTimeout(waiter.notify, nearestCooldownMs)
      }

      for (const target of uniqueTargets) {
        this.#getState(target).waiters.push(waiter)
      }
    })
  }

  reportProviderSuccess(target: SttTarget): void {
    if (target.local) {
      return
    }

    const state = this.#getState(target)
    if (state.activeCount > 0) {
      state.activeCount -= 1
    }

    state.warmupComplete = true
    state.cooldownUntil = undefined
    state.consecutiveRetryableFailures = 0
    state.stats.completedCount += 1
    wakeWaiters(state.waiters)
  }

  reportProviderFailure(
    target: SttTarget,
    failure: ProviderFailureSummary,
    options: {
      blockedReason?: SttBatchBlockedProviderReason | undefined
      cooldownMs?: number | undefined
    } = {}
  ): void {
    if (target.local) {
      return
    }

    const state = this.#getState(target)
    if (state.activeCount > 0) {
      state.activeCount -= 1
    }

    if (options.blockedReason && !state.blockedReason) {
      state.blockedReason = cloneBlockedReason(options.blockedReason)
      state.cooldownUntil = undefined
      if (options.blockedReason.degraded) {
        state.stats.degradedCount += 1
      } else {
        state.stats.blockedCount += 1
      }
      wakeWaiters(state.waiters)
      return
    }

    if (failure.retryable) {
      state.consecutiveRetryableFailures += 1
      if (state.consecutiveRetryableFailures >= RETRYABLE_FAILURE_DEGRADE_THRESHOLD && !state.blockedReason) {
        state.blockedReason = this.#buildDegradedReason(target, failure)
        state.cooldownUntil = undefined
        state.stats.degradedCount += 1
        wakeWaiters(state.waiters)
        return
      }
    } else {
      state.consecutiveRetryableFailures = 0
    }

    if (!state.blockedReason) {
      const cooldownMs = normalizeCooldownMs(options.cooldownMs)
      if (cooldownMs !== undefined) {
        state.cooldownUntil = Math.max(state.cooldownUntil ?? 0, Date.now() + cooldownMs)
      } else {
        this.#clearExpiredCooldown(state)
      }
    }

    wakeWaiters(state.waiters)
  }

  getSchedulerSnapshot(): SttBatchSchedulerSnapshot {
    return {
      providers: [...this.#providerStates.entries()]
        .map(([key, state]) => {
          const [service, ...modelParts] = key.split(':')
          const model = modelParts.join(':')
          const target = {
            service: service as SttTarget['service'],
            model,
            local: false
          }
          const profile = this.#getProfile(target)

          return {
            service: target.service,
            model: target.model,
            kind: profile.kind,
            launchSlotLimit: profile.launchSlotLimit,
            pollSlotLimit: profile.pollSlotLimit,
            launchedCount: state.stats.launchedCount,
            completedCount: state.stats.completedCount,
            blockedCount: state.stats.blockedCount,
            degradedCount: state.stats.degradedCount,
            queueWaitMs: state.stats.queueWaitMs,
            pollCount: state.stats.pollCount,
            backfillCount: state.stats.backfillCount,
            warmupComplete: state.warmupComplete
          } satisfies SttBatchProviderStatsSnapshot
        })
        .sort((left, right) =>
          formatTargetLabel(left).localeCompare(formatTargetLabel(right))
        )
    }
  }
}
