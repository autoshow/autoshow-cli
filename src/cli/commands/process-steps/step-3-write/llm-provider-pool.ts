import type { LLMTarget } from '~/types'

export type LlmProviderPoolConcurrency = {
  provider: number
  local: number
}

type IndexedLlmTarget = {
  index: number
  target: LLMTarget
}

export const isLocalLlmTarget = (
  target: Pick<LLMTarget, 'service'>
): boolean => target.service === 'llama.cpp'

export const isHostedLlmTarget = (
  target: Pick<LLMTarget, 'service'>
): boolean =>
  target.service === 'openai'
  || target.service === 'groq'
  || target.service === 'gemini'
  || target.service === 'anthropic'
  || target.service === 'minimax'
  || target.service === 'grok'

const runIndexedTargetPool = async (
  targets: IndexedLlmTarget[],
  concurrency: number,
  worker: (index: number, target: LLMTarget) => Promise<void>
): Promise<void> => {
  const normalizedConcurrency = Number.isFinite(concurrency)
    ? Math.max(1, Math.floor(concurrency))
    : 1
  let next = 0

  const runWorker = async (): Promise<void> => {
    while (true) {
      const current = next
      next += 1
      if (current >= targets.length) {
        return
      }
      const entry = targets[current] as IndexedLlmTarget
      await worker(entry.index, entry.target)
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(normalizedConcurrency, targets.length) }, async () => {
      await runWorker()
    })
  )
}

export const runLlmProviderTargetPools = async (
  targets: LLMTarget[],
  concurrency: LlmProviderPoolConcurrency,
  worker: (index: number, target: LLMTarget) => Promise<void>
): Promise<void> => {
  const indexedTargets = targets.map((target, index) => ({ index, target }))
  const localTargets = indexedTargets.filter(({ target }) => isLocalLlmTarget(target))
  const hostedTargets = indexedTargets.filter(({ target }) => isHostedLlmTarget(target))

  await Promise.all([
    runIndexedTargetPool(hostedTargets, concurrency.provider, worker),
    runIndexedTargetPool(localTargets, concurrency.local, worker)
  ])
}
