import { readdir } from 'node:fs/promises'
import { join, resolve as resolvePath } from 'node:path'
import * as l from '~/logger'
import { logLocationsTable } from '~/logger/human-table'
import { buildOptsFromFlags } from '~/cli/commands/process-steps/step-1-download/targets/build-opts-from-flags'
import { readBatchManifest, readExtractBatchManifest, readRunManifest } from '~/cli/commands/process-steps/manifest-utils'
import {
  extractExplicitFlags,
  mergeConfigIntoRawFlags
} from '~/cli/commands/setup-and-utilities/config/config-merge'
import {
  loadConfig,
  resolveConfigPath
} from '~/cli/commands/setup-and-utilities/config/config-loader'
import type { RuntimeOptions } from '~/types'
import { CLIUsageError } from '~/utils/error-handler'
import { getResumeHandler } from './resume-registry'
import type { ResumeTarget, ResumeTargetKind } from './resume-types'

const SUPPORTED_RESUME_KINDS = new Set<ResumeTargetKind>(['stt', 'ocr', 'extract'])

const toResumeTarget = (
  kind: string,
  scope: ResumeTarget['scope'],
  dir: string,
  manifestPath: string
): ResumeTarget | undefined =>
  SUPPORTED_RESUME_KINDS.has(kind as ResumeTargetKind)
    ? {
        kind: kind as ResumeTargetKind,
        scope,
        dir,
        manifestPath
      }
    : undefined

const resolveExplicitResumeTarget = async (
  outputDirInput: string
): Promise<ResumeTarget> => {
  const dir = resolvePath(outputDirInput)
  const extractBatchManifest = await readExtractBatchManifest(dir)
  if (extractBatchManifest) {
    return {
      kind: 'extract',
      scope: 'batch',
      dir,
      manifestPath: extractBatchManifest.manifestPath
    }
  }

  const batchManifest = await readBatchManifest(dir)
  if (batchManifest) {
    const target = toResumeTarget(batchManifest.manifest.kind, 'batch', dir, batchManifest.manifestPath)
    if (target) {
      return target
    }
    throw CLIUsageError(`Resume supports only STT and OCR manifests. Found "${batchManifest.manifest.kind}" at ${batchManifest.manifestPath}.`)
  }

  const runManifest = await readRunManifest(dir)
  if (runManifest) {
    const target = toResumeTarget(runManifest.kind, 'single', dir, join(dir, 'run.json'))
    if (target) {
      return target
    }
    throw CLIUsageError(`Resume supports only STT and OCR manifests. Found "${runManifest.kind}" at ${join(dir, 'run.json')}.`)
  }

  throw CLIUsageError(`Could not find extract-batch.json, batch.json, or run.json under ${dir}.`)
}

const discoverLatestResumeTarget = async (
  outputRootInput: string,
  opts: RuntimeOptions,
  explicitFlags: Set<string>
): Promise<ResumeTarget> => {
  const outputRoot = resolvePath(outputRootInput)
  let dirNames: string[]

  try {
    const entries = await readdir(outputRoot, { withFileTypes: true })
    dirNames = entries
      .filter((dirent) => dirent.isDirectory())
      .map((dirent) => dirent.name)
      .sort((left, right) => right.localeCompare(left))
  } catch {
    dirNames = []
  }

  for (const dirName of dirNames) {
    const candidateDir = join(outputRoot, dirName)
    const extractBatchManifest = await readExtractBatchManifest(candidateDir)
    if (extractBatchManifest) {
      const target: ResumeTarget = {
        kind: 'extract',
        scope: 'batch',
        dir: candidateDir,
        manifestPath: extractBatchManifest.manifestPath
      }
      const handler = getResumeHandler(target.kind)
      if (handler && await handler.hasResumableWork(target, opts, explicitFlags)) {
        return target
      }
      continue
    }

    const batchManifest = await readBatchManifest(candidateDir)
    if (batchManifest) {
      const target = toResumeTarget(batchManifest.manifest.kind, 'batch', candidateDir, batchManifest.manifestPath)
      if (!target) {
        continue
      }

      const handler = getResumeHandler(target.kind)
      if (handler && await handler.hasResumableWork(target, opts, explicitFlags)) {
        return target
      }
      continue
    }

    const runManifest = await readRunManifest(candidateDir)
    if (!runManifest) {
      continue
    }

    const target = toResumeTarget(runManifest.kind, 'single', candidateDir, join(candidateDir, 'run.json'))
    if (!target) {
      continue
    }

    const handler = getResumeHandler(target.kind)
    if (handler && await handler.hasResumableWork(target, opts, explicitFlags)) {
      return target
    }
  }

  throw CLIUsageError(`Could not find a resumable STT, OCR, or extract output under ${outputRootInput}.`)
}

export const dispatchResume = async (
  outputDirInput: string | undefined,
  rawFlags: Record<string, unknown>,
  doubleDash: string[] = []
): Promise<void> => {
  const configPathOverride = typeof rawFlags['config-path'] === 'string' ? rawFlags['config-path'] : undefined
  const resolvedConfigPath = await resolveConfigPath(configPathOverride)
  const config = await loadConfig(resolvedConfigPath)
  const explicitFlags = extractExplicitFlags(Bun.argv.slice(2))
  const mergedFlags = mergeConfigIntoRawFlags(rawFlags, config, explicitFlags)
  const opts = buildOptsFromFlags(false, mergedFlags, doubleDash, {}, explicitFlags, Bun.argv.slice(2))

  const target = typeof outputDirInput === 'string' && outputDirInput.trim().length > 0
    ? await resolveExplicitResumeTarget(outputDirInput)
    : await discoverLatestResumeTarget('./output', opts, explicitFlags)

  if (typeof outputDirInput !== 'string' || outputDirInput.trim().length === 0) {
    l.write('info', `Auto-discovered resumable ${target.kind.toUpperCase()} ${target.scope === 'batch' ? 'batch' : 'output'}`)
    logLocationsTable(l, [{
      artifact: target.scope === 'batch' ? 'resumeBatch' : 'resumeOutput',
      path: target.dir
    }])
  }

  const handler = getResumeHandler(target.kind)
  if (!handler) {
    throw CLIUsageError(`Resume is not supported for "${target.kind}".`)
  }

  await handler.resume(target, opts, explicitFlags)
}
