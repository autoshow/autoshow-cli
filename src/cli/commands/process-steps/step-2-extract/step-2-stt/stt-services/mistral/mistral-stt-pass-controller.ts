import type { MistralAvailabilityWaiter } from '~/types'

const wakeWaiters = (
  waiters: MistralAvailabilityWaiter[]
): void => {
  const pending = waiters.splice(0)
  for (const waiter of pending) {
    waiter.notify()
  }
}

const normalizeCooldownMs = (
  value: number | undefined
): number | undefined => {
  if (!Number.isFinite(value) || (value ?? 0) <= 0) {
    return undefined
  }

  return Math.round(value as number)
}

export class MistralSttPassController {
  #activeCount = 0
  #cooldownUntil: number | undefined
  #rateLimited = false
  #waiters: MistralAvailabilityWaiter[] = []

  #clearExpiredCooldown(): void {
    if (this.#cooldownUntil !== undefined && this.#cooldownUntil <= Date.now()) {
      this.#cooldownUntil = undefined
    }
  }

  get rateLimited(): boolean {
    return this.#rateLimited
  }

  noteRateLimit(cooldownMs: number | undefined): void {
    const normalizedCooldownMs = normalizeCooldownMs(cooldownMs)
    if (normalizedCooldownMs === undefined) {
      return
    }

    this.#rateLimited = true
    this.#cooldownUntil = Math.max(this.#cooldownUntil ?? 0, Date.now() + normalizedCooldownMs)
    wakeWaiters(this.#waiters)
  }

  async withRequestSlot<T>(
    fn: () => Promise<T>
  ): Promise<T> {
    await this.#acquire()
    try {
      return await fn()
    } finally {
      this.#release()
    }
  }

  async #acquire(): Promise<void> {
    while (true) {
      this.#clearExpiredCooldown()

      if (this.#activeCount === 0) {
        if (this.#cooldownUntil === undefined) {
          this.#activeCount = 1
          return
        }

        const targetCooldownAt = this.#cooldownUntil
        const cooldownMs = Math.max(0, targetCooldownAt - Date.now())
        await Bun.sleep(cooldownMs)
        if (this.#cooldownUntil !== undefined && this.#cooldownUntil <= targetCooldownAt) {
          this.#cooldownUntil = undefined
        }
        continue
      }

      await new Promise<void>((resolve) => {
        const waiter: MistralAvailabilityWaiter = {
          resolved: false,
          notify: () => {
            if (waiter.resolved) {
              return
            }

            waiter.resolved = true
            this.#waiters = this.#waiters.filter((entry) => entry !== waiter)
            resolve()
          }
        }

        this.#waiters.push(waiter)
      })
    }
  }

  #release(): void {
    if (this.#activeCount > 0) {
      this.#activeCount -= 1
    }

    wakeWaiters(this.#waiters)
  }
}

export const createMistralSttPassController = (): MistralSttPassController =>
  new MistralSttPassController()
