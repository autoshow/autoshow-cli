import { mkdir, rename, rm } from 'node:fs/promises'
import * as l from '~/logger'

export const sanitizeModelName = (model: string): string =>
  model.replace(/[/\\:*?"<>|]/g, '-')

export type TargetBase = {
  service: string
  model: string
}

type SingleFileArtifactNameOptions = {
  singleFileName: string
  multiFilePrefix: string
  extension: string
}

type BuildSingleArtifactMapOptions<T> = {
  singleKey: string
  multiKeyPrefix: string
  getService: (item: T) => string
  getModel: (item: T) => string
  getFileName: (item: T) => string
}

type SingleFileRunResult<TMetadata> = {
  filePath: string
  metadata: TMetadata
}

type RunSingleFileTargetsOptions<TTarget extends TargetBase, TMetadata> = {
  targets: TTarget[]
  outputDir: string
  stepLabel: string
  noProviderMessage: string
  workspacePrefix: string
  runTarget: (target: TTarget, workspaceDir: string) => Promise<SingleFileRunResult<TMetadata>>
  getArtifactFileName: (target: TTarget, singleTarget: boolean) => string
  finalizeMetadata: (metadata: TMetadata, finalFileName: string, finalPath: string) => TMetadata
}

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

export type RunTargetsOptions<TTarget extends TargetBase, TResult> = {
  targets: TTarget[]
  outputDir: string
  stepLabel: string
  noProviderMessage: string
  getWorkspaceDir: (outputDir: string, target: TTarget) => string
  runTarget: (target: TTarget, workspaceDir: string) => Promise<TResult>
  finalizeTarget: (target: TTarget, result: TResult, singleTarget: boolean) => Promise<TResult>
}

export const runTargets = async <TTarget extends TargetBase, TResult>(
  opts: RunTargetsOptions<TTarget, TResult>
): Promise<TResult[]> => {
  const { targets, outputDir, stepLabel, noProviderMessage } = opts
  const successes: TResult[] = []
  const failedTargets: string[] = []
  const singleTarget = targets.length === 1

  for (const target of targets) {
    const workspaceDir = singleTarget ? outputDir : opts.getWorkspaceDir(outputDir, target)

    try {
      if (!singleTarget) {
        await mkdir(workspaceDir, { recursive: true })
      }

      const result = await opts.runTarget(target, workspaceDir)
      successes.push(await opts.finalizeTarget(target, result, singleTarget))
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      l.error(`Failed to run ${stepLabel} target ${target.service}/${target.model}: ${message}`)
      failedTargets.push(`${target.service}/${target.model}: ${message}`)
    } finally {
      if (!singleTarget) {
        await rm(workspaceDir, { recursive: true, force: true })
      }
    }
  }

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
