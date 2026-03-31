import { mkdir, rm } from 'node:fs/promises'
import * as l from '~/logger'

export const sanitizeModelName = (model: string): string =>
  model.replace(/[/\\:*?"<>|]/g, '-')

export type TargetBase = {
  service: string
  model: string
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
