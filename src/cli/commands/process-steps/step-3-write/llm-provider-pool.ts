import type { LLMTarget } from '~/types'
import { runProviderTargetScheduler } from '~/cli/commands/process-steps/provider-target-scheduler'

type LlmProviderPoolConcurrency = {
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

const isHostedLlmTarget = (
  target: Pick<LLMTarget, 'service'>
): boolean =>
  target.service === 'openai'
  || target.service === 'groq'
  || target.service === 'gemini'
  || target.service === 'anthropic'
  || target.service === 'minimax'
  || target.service === 'grok'
  || target.service === 'glm'
  || target.service === 'kimi'

export const runLlmProviderTargetPools = async (
  targets: LLMTarget[],
  concurrency: LlmProviderPoolConcurrency,
  worker: (index: number, target: LLMTarget) => Promise<void>
): Promise<void> => {
  const indexedTargets: IndexedLlmTarget[] = targets.map((target, index) => ({ index, target }))
  const scheduled = await runProviderTargetScheduler<IndexedLlmTarget, void>({
    entries: indexedTargets.map((entry) => ({
      index: entry.index,
      target: entry
    })),
    concurrency,
    getPool: (entry) => isLocalLlmTarget(entry.target) ? 'local' : 'hosted',
    runTarget: async (_index, entry) => {
      if (!isLocalLlmTarget(entry.target) && !isHostedLlmTarget(entry.target)) {
        return
      }
      await worker(entry.index, entry.target)
    }
  })
  if (scheduled.failures.length > 0) {
    throw new Error(scheduled.failures.map(({ target, message }) =>
      `${target.target.service}/${target.target.model}: ${message}`
    ).join('; '))
  }
}
