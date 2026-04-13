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

type AvailabilityWaiter = {
  resolved: boolean
  notify: () => void
}

type ProviderState = {
  activeCount: number
  blockedReason?: SttBatchBlockedProviderReason | undefined
  waiters: AvailabilityWaiter[]
}

const PROVIDER_SLOT_LIMIT = 1

const getTargetKey = (target: Pick<SttTarget, 'service' | 'model'>): string =>
  `${target.service}:${target.model}`

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

  tryReserveProvider(target: SttTarget): SttBatchAttemptDecision {
    if (target.local) {
      return { action: 'run' }
    }

    const state = this.#getState(target)
    if (state.blockedReason) {
      return {
        action: 'skip',
        reason: cloneBlockedReason(state.blockedReason)
      }
    }

    if (state.activeCount < PROVIDER_SLOT_LIMIT) {
      state.activeCount += 1
      return { action: 'run' }
    }

    return { action: 'defer' }
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

    for (const target of uniqueTargets) {
      const state = this.#getState(target)
      if (state.blockedReason || state.activeCount < PROVIDER_SLOT_LIMIT) {
        return
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
          for (const target of uniqueTargets) {
            const state = this.#getState(target)
            state.waiters = state.waiters.filter((entry) => entry !== waiter)
          }
          resolve()
        }
      }

      for (const target of uniqueTargets) {
        this.#getState(target).waiters.push(waiter)
      }
    })
  }

  reportProviderResult(
    target: SttTarget,
    blockedReason?: SttBatchBlockedProviderReason | undefined
  ): void {
    if (target.local) {
      return
    }

    const state = this.#getState(target)
    if (state.activeCount > 0) {
      state.activeCount -= 1
    }

    if (blockedReason && !state.blockedReason) {
      state.blockedReason = cloneBlockedReason(blockedReason)
    }

    wakeWaiters(state)
  }
}
