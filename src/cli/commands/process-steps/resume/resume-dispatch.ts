import { readdir } from 'node:fs/promises'
import { join, resolve as resolvePath } from 'node:path'
import * as l from '~/utils/logger'
import { logLocationsTable } from '~/utils/logger/human-table'
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
import type { BatchManifest, ExtractRoute, RunManifest, RuntimeOptions } from '~/types'
import { CLIUsageError } from '~/utils/error-handler'
import { getResumeHandler } from './resume-registry'
import { getOutputRoot } from '~/cli/commands/process-steps/output-root'
import type { ResumeTarget, ResumeTargetKind } from '~/types'

const SUPPORTED_RESUME_KINDS = new Set<ResumeTargetKind>(['extract', 'tts', 'image', 'video', 'music'])

const isExtractRoute = (value: unknown): value is ExtractRoute =>
  value === 'media' || value === 'document' || value === 'x-space'

const inferExtractRouteFromBatchManifest = (
  manifest: BatchManifest
): ExtractRoute | undefined => {
  if (manifest.kind !== 'extract') {
    return undefined
  }

  const routes = new Set<ExtractRoute>()
  for (const item of manifest.items) {
    if (isExtractRoute(item['extractRoute'])) {
      routes.add(item['extractRoute'])
    }
  }

  return routes.size === 1 ? [...routes][0] : undefined
}

const inferExtractRouteFromRunManifest = (
  manifest: RunManifest
): ExtractRoute | undefined =>
  manifest.kind === 'extract' && isExtractRoute(manifest.metadata['extractRoute'])
    ? manifest.metadata['extractRoute']
    : undefined

const toResumeTarget = (
  kind: string,
  scope: ResumeTarget['scope'],
  dir: string,
  manifestPath: string,
  extractRoute?: ExtractRoute | undefined
): ResumeTarget | undefined =>
  SUPPORTED_RESUME_KINDS.has(kind as ResumeTargetKind)
    ? {
        kind: kind as ResumeTargetKind,
        ...(extractRoute ? { extractRoute } : {}),
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
    const target = toResumeTarget(
      batchManifest.manifest.kind,
      'batch',
      dir,
      batchManifest.manifestPath,
      inferExtractRouteFromBatchManifest(batchManifest.manifest)
    )
    if (target) {
      return target
    }
    throw CLIUsageError(`Resume supports only extract, TTS, image, video, and music manifests. Found "${batchManifest.manifest.kind}" at ${batchManifest.manifestPath}.`)
  }

  const runManifest = await readRunManifest(dir)
  if (runManifest) {
    const target = toResumeTarget(
      runManifest.kind,
      'single',
      dir,
      join(dir, 'run.json'),
      inferExtractRouteFromRunManifest(runManifest)
    )
    if (target) {
      return target
    }
    throw CLIUsageError(`Resume supports only extract, TTS, image, video, and music manifests. Found "${runManifest.kind}" at ${join(dir, 'run.json')}.`)
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
      const target = toResumeTarget(
        batchManifest.manifest.kind,
        'batch',
        candidateDir,
        batchManifest.manifestPath,
        inferExtractRouteFromBatchManifest(batchManifest.manifest)
      )
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

    const target = toResumeTarget(
      runManifest.kind,
      'single',
      candidateDir,
      join(candidateDir, 'run.json'),
      inferExtractRouteFromRunManifest(runManifest)
    )
    if (!target) {
      continue
    }

    const handler = getResumeHandler(target.kind)
    if (handler && await handler.hasResumableWork(target, opts, explicitFlags)) {
      return target
    }
  }

  throw CLIUsageError(`Could not find a resumable output under ${outputRootInput}.`)
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
  const opts = {
    ...buildOptsFromFlags(false, mergedFlags, doubleDash, {}, explicitFlags, Bun.argv.slice(2)),
    configPath: resolvedConfigPath
  }
  const resolvedOutputDirInput = typeof outputDirInput === 'string' && outputDirInput.trim().length > 0
    ? outputDirInput
    : doubleDash.length === 1
      ? doubleDash[0]
      : undefined
  if ((!outputDirInput || outputDirInput.trim().length === 0) && doubleDash.length > 1) {
    throw CLIUsageError(`Too many positional outputs for "resume": ${doubleDash.join(' ')}. Run: bun as help resume`)
  }

  const target = typeof resolvedOutputDirInput === 'string' && resolvedOutputDirInput.trim().length > 0
    ? await resolveExplicitResumeTarget(resolvedOutputDirInput)
    : await discoverLatestResumeTarget(getOutputRoot(), opts, explicitFlags)

  if (typeof resolvedOutputDirInput !== 'string' || resolvedOutputDirInput.trim().length === 0) {
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
