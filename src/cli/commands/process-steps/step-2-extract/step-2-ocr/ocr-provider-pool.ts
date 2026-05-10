import type { OcrTarget } from '~/types'
import { runProviderTargetScheduler } from '~/cli/commands/process-steps/provider-target-scheduler'
import { getOcrTargetKey } from './ocr-run-state'

export type OcrProviderPoolConcurrency = {
  provider: number
  local: number
}

type IndexedOcrTarget = {
  index: number
  target: OcrTarget
}

export const isLocalOcrTarget = (
  target: Pick<OcrTarget, 'service'>
): boolean =>
  target.service === 'tesseract'
  || target.service === 'ocrmypdf'
  || target.service === 'paddle-ocr'

const getHostedOcrExecutionPriority = (target: OcrTarget): number => {
  if (target.service === 'deepinfra' && /paddleocr|paddle/i.test(target.model)) return 100
  if (target.service === 'kimi') return 90
  if (target.service === 'deepinfra') return 85
  if (target.service === 'anthropic') return 80
  if (target.service === 'gemini') return 75
  if (target.service === 'openai') return 70
  if (target.service === 'aws-textract' || target.service === 'gcloud-docai') return 65
  if (target.service === 'mistral') return 60
  if (target.service === 'glm') return 55
  return 0
}

const buildIndexedOcrTargetsToRun = (
  requestedTargets: OcrTarget[],
  targetsToRun: OcrTarget[]
): IndexedOcrTarget[] => {
  const availableIndicesByKey = new Map<string, number[]>()
  requestedTargets.forEach((target, index) => {
    const key = getOcrTargetKey(target)
    const indices = availableIndicesByKey.get(key) ?? []
    indices.push(index)
    availableIndicesByKey.set(key, indices)
  })

  return targetsToRun.flatMap((target) => {
    const indices = availableIndicesByKey.get(getOcrTargetKey(target))
    const index = indices?.shift()
    return index === undefined ? [] : [{ index, target }]
  })
}

export const runOcrProviderTargetPools = async (
  requestedTargets: OcrTarget[],
  targetsToRun: OcrTarget[],
  concurrency: OcrProviderPoolConcurrency,
  worker: (index: number, target: OcrTarget) => Promise<void>
): Promise<void> => {
  const indexedTargets = buildIndexedOcrTargetsToRun(requestedTargets, targetsToRun)
  const scheduled = await runProviderTargetScheduler<IndexedOcrTarget, void>({
    entries: indexedTargets.map((entry) => ({
      index: entry.index,
      target: entry,
      priority: isLocalOcrTarget(entry.target) ? 0 : getHostedOcrExecutionPriority(entry.target)
    })),
    concurrency,
    getPool: (entry) => isLocalOcrTarget(entry.target) ? 'local' : 'hosted',
    runTarget: async (_index, entry) => {
      await worker(entry.index, entry.target)
    }
  })
  if (scheduled.failures.length > 0) {
    throw new Error(scheduled.failures.map(({ target, message }) =>
      `${target.target.service}/${target.target.model}: ${message}`
    ).join('; '))
  }
}
