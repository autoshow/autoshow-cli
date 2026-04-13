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

type ProviderState = {
  cleared: boolean
  probeInFlight: boolean
  blockedReason?: SttBatchBlockedProviderReason | undefined
  waiters: Array<() => void>
}

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
    waiter()
  }
}

export class SttBatchCoordinator {
  readonly #providerStates = new Map<string, ProviderState>()

  #getState(target: Pick<SttTarget, 'service' | 'model'>): ProviderState {
    const key = getTargetKey(target)
    let state = this.#providerStates.get(key)
    if (!state) {
      state = {
        cleared: false,
        probeInFlight: false,
        waiters: []
      }
      this.#providerStates.set(key, state)
    }
    return state
  }

  async beforeProviderAttempt(target: SttTarget): Promise<SttBatchAttemptDecision> {
    const state = this.#getState(target)

    while (true) {
      if (state.blockedReason) {
        return {
          action: 'skip',
          reason: cloneBlockedReason(state.blockedReason)
        }
      }

      if (target.local || state.cleared) {
        return { action: 'run' }
      }

      if (!state.probeInFlight) {
        state.probeInFlight = true
        return { action: 'run' }
      }

      await new Promise<void>((resolve) => {
        state.waiters.push(resolve)
      })
    }
  }

  reportProviderResult(
    target: SttTarget,
    blockedReason?: SttBatchBlockedProviderReason | undefined
  ): void {
    const state = this.#getState(target)

    if (blockedReason && !state.blockedReason) {
      state.blockedReason = cloneBlockedReason(blockedReason)
    } else if (!state.blockedReason) {
      state.cleared = true
    }

    if (state.probeInFlight) {
      state.probeInFlight = false
      wakeWaiters(state)
      return
    }

    if (blockedReason) {
      wakeWaiters(state)
    }
  }
}
