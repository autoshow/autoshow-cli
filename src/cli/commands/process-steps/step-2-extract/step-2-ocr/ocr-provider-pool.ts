import type { OcrTarget } from '~/types'
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

const runIndexedTargetPool = async (
  targets: IndexedOcrTarget[],
  concurrency: number,
  worker: (index: number, target: OcrTarget) => Promise<void>
): Promise<void> => {
  const normalizedConcurrency = Math.max(1, concurrency)
  let next = 0

  const runWorker = async (): Promise<void> => {
    while (true) {
      const current = next
      next += 1
      if (current >= targets.length) {
        return
      }
      const entry = targets[current] as IndexedOcrTarget
      await worker(entry.index, entry.target)
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(normalizedConcurrency, targets.length) }, async () => {
      await runWorker()
    })
  )
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
  const localTargets = indexedTargets.filter(({ target }) => isLocalOcrTarget(target))
  const hostedTargets = indexedTargets.filter(({ target }) => !isLocalOcrTarget(target))

  await Promise.all([
    runIndexedTargetPool(localTargets, concurrency.local, worker),
    runIndexedTargetPool(hostedTargets, concurrency.provider, worker)
  ])
}
