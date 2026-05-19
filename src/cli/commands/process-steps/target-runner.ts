import { mkdir, rename, rm } from 'node:fs/promises'
import * as l from '~/utils/logger'
import type {
  BuildSingleArtifactMapOptions,
  RunSingleFileTargetsOptions,
  RunTargetsOptions,
  SingleFileArtifactNameOptions,
  SingleFileRunResult,
  TargetBase
} from '~/types'
import { runProviderTargetScheduler } from './provider-target-scheduler'

export const sanitizeModelName = (model: string): string =>
  model.replace(/[/\\:*?"<>|]/g, '-')

export const getSingleFileArtifactName = (
  target: TargetBase,
  singleTarget: boolean,
  options: SingleFileArtifactNameOptions
): string => {
  if (singleTarget) {
    return options.singleFileName
  }

  return `${options.multiFilePrefix}-${target.service}-${sanitizeModelName(target.model)}.${options.extension}`
}

export const buildSingleArtifactMap = <T,>(
  items: T[],
  options: BuildSingleArtifactMapOptions<T>
): Record<string, string> => {
  if (items.length === 1) {
    return { [options.singleKey]: options.getFileName(items[0] as T) }
  }

  return Object.fromEntries(
    items.map((item) => [
      `${options.multiKeyPrefix}-${options.getService(item)}-${sanitizeModelName(options.getModel(item))}`,
      options.getFileName(item)
    ])
  )
}

export const runTargets = async <TTarget extends TargetBase, TResult>(
  opts: RunTargetsOptions<TTarget, TResult>
): Promise<TResult[]> => {
  const { targets, outputDir, stepLabel, noProviderMessage } = opts
  const singleTarget = targets.length === 1
  const scheduled = await runProviderTargetScheduler<TTarget, TResult>({
    entries: targets.map((target, index) => ({
      index,
      target,
      priority: opts.getTargetPriority?.(target, index)
    })),
    concurrency: opts.concurrency ?? { provider: 2, local: 1 },
    getPool: opts.getTargetPool ?? (() => 'hosted'),
    runTarget: async (_index, target) => {
      const workspaceDir = singleTarget ? outputDir : opts.getWorkspaceDir(outputDir, target)

      if (!singleTarget) {
        await mkdir(workspaceDir, { recursive: true })
      }

      try {
        const result = await opts.runTarget(target, workspaceDir)
        return await opts.finalizeTarget(target, result, singleTarget)
      } finally {
        if (!singleTarget) {
          await rm(workspaceDir, { recursive: true, force: true })
        }
      }
    }
  })
  const successes = scheduled.results.filter((result): result is TResult => result !== undefined)
  const failedTargets = scheduled.failures.map(({ target, message }) => {
    l.error(`Failed to run ${stepLabel} target ${target.service}/${target.model}: ${message}`)
    return `${target.service}/${target.model}: ${message}`
  })

  if (successes.length === 0) {
    const details = failedTargets.length > 0 ? failedTargets.join('; ') : noProviderMessage
    throw new Error(`No ${stepLabel} outputs were generated. ${details}`)
  }

  if (failedTargets.length > 0) {
    l.warn(`${stepLabel} run completed with partial failures: ${failedTargets.join('; ')}`)
  }

  return successes
}

export const runSingleFileTargets = async <TTarget extends TargetBase, TMetadata>(
  opts: RunSingleFileTargetsOptions<TTarget, TMetadata>
): Promise<Array<SingleFileRunResult<TMetadata>>> =>
  runTargets<TTarget, SingleFileRunResult<TMetadata>>({
    targets: opts.targets,
    outputDir: opts.outputDir,
    stepLabel: opts.stepLabel,
    noProviderMessage: opts.noProviderMessage,
    getWorkspaceDir: (dir, target) =>
      `${dir}/${opts.workspacePrefix}-${target.service}-${sanitizeModelName(target.model)}`,
    concurrency: opts.concurrency,
    getTargetPool: opts.getTargetPool,
    getTargetPriority: opts.getTargetPriority,
    runTarget: opts.runTarget,
    finalizeTarget: async (target, result, singleTarget) => {
      if (singleTarget) {
        return result
      }

      const finalFileName = opts.getArtifactFileName(target, singleTarget)
      const finalPath = `${opts.outputDir}/${finalFileName}`
      await rename(result.filePath, finalPath)

      return {
        filePath: finalPath,
        metadata: opts.finalizeMetadata(result.metadata, finalFileName, finalPath)
      }
    }
  })

export const serializeOneOrMany = <T,>(items: T[]): T | T[] => items.length === 1 ? items[0] as T : items
