import type { SttTarget } from './stt-targets'

export type SttBatchBlockedProviderReason = {
  service: SttTarget['service']
  model: string
  local: boolean
  message: string
  retryable: boolean
  stage?: string | undefined
  status?: number | undefined
}

export type SttBatchAttemptDecision =
  | { action: 'run' }
  | { action: 'skip', reason: SttBatchBlockedProviderReason }
  | { action: 'defer' }

export type SttBatchProviderAvailability =
  | { action: 'run', activeCount: number, slotLimit: number }
  | { action: 'skip', reason: SttBatchBlockedProviderReason, activeCount: number, slotLimit: number }
  | { action: 'defer', activeCount: number, slotLimit: number, cooldownMs?: number | undefined }

type AvailabilityWaiter = {
  resolved: boolean
  notify: () => void
  timer?: ReturnType<typeof setTimeout> | undefined
}

type ProviderState = {
  activeCount: number
  blockedReason?: SttBatchBlockedProviderReason | undefined
  waiters: AvailabilityWaiter[]
  cooldownUntil?: number | undefined
}

const DEFAULT_PROVIDER_SLOT_LIMIT = 2
const MAX_PROVIDER_SLOT_LIMIT = 8
const MAX_PROVIDER_COOLDOWN_MS = 5 * 60 * 1000

const getTargetKey = (target: Pick<SttTarget, 'service' | 'model'>): string =>
  `${target.service}:${target.model}`

const formatTargetLabel = (target: Pick<SttTarget, 'service' | 'model'>): string =>
  `${target.service === 'whisper' ? 'whisper.cpp' : target.service}/${target.model}`

const cloneBlockedReason = (
  reason: SttBatchBlockedProviderReason
): SttBatchBlockedProviderReason => ({
  service: reason.service,
  model: reason.model,
  local: reason.local,
  message: reason.message,
  retryable: reason.retryable,
  ...(reason.stage ? { stage: reason.stage } : {}),
  ...(typeof reason.status === 'number' ? { status: reason.status } : {})
})

const wakeWaiters = (state: ProviderState): void => {
  const waiters = state.waiters.splice(0)
  for (const waiter of waiters) {
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

  return DEFAULT_PROVIDER_SLOT_LIMIT
}

export const describeSttBatchProviderSlotLimits = (
  targets: Array<Pick<SttTarget, 'service' | 'model' | 'local'>>
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
    .map((target) => `${formatTargetLabel(target)}:${resolveSttBatchProviderSlotLimit(target)}`)
    .join(', ')
}

export class SttBatchCoordinator {
  readonly #providerStates = new Map<string, ProviderState>()

  #getState(target: Pick<SttTarget, 'service' | 'model'>): ProviderState {
    const key = getTargetKey(target)
    let state = this.#providerStates.get(key)
    if (!state) {
      state = {
        activeCount: 0,
        waiters: []
      }
      this.#providerStates.set(key, state)
    }
    return state
  }

  #clearExpiredCooldown(state: ProviderState): void {
    if (state.cooldownUntil !== undefined && state.cooldownUntil <= Date.now()) {
      state.cooldownUntil = undefined
    }
  }

  peekProviderAvailability(target: SttTarget): SttBatchProviderAvailability {
    if (target.local) {
      return { action: 'run', activeCount: 0, slotLimit: 1 }
    }

    const state = this.#getState(target)
    this.#clearExpiredCooldown(state)
    const slotLimit = resolveSttBatchProviderSlotLimit(target)

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
    return { action: 'run' }
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

  reportProviderResult(
    target: SttTarget,
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
    } else if (!state.blockedReason) {
      const cooldownMs = normalizeCooldownMs(options.cooldownMs)
      if (cooldownMs !== undefined) {
        state.cooldownUntil = Math.max(state.cooldownUntil ?? 0, Date.now() + cooldownMs)
      } else {
        this.#clearExpiredCooldown(state)
      }
    }

    wakeWaiters(state)
  }
}
