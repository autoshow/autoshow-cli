import { readdir } from 'node:fs/promises'
import { join, resolve as resolvePath } from 'node:path'
import { fileURLToPath } from 'node:url'
import * as l from '~/logger'
import { createHumanTable } from '~/logger/human-table'
import type {
  BatchManifestEntry,
  NormalizedResumeSttBatchRunOptions,
  ResumeBatchEntry,
  ResumeBatchManifest,
  ResumeSttBatchPassResult,
  ResumeSttBatchRunOptions,
  RuntimeOptions,
  SttTarget
} from '~/types'
import { CLIUsageError } from '~/utils/error-handler'
import { processStt } from '~/cli/commands/process-steps/process-stt'
import { logSttBatchFinalSummary } from '../step-1-download/targets/target-utils'
import { buildSttBatchSchedulerRows, formatSttBatchSchedulerSummary } from './stt-batch/stt-batch-policy'
import { SttBatchCoordinator } from './stt-batch/stt-batch-coordinator'
import {
  buildMissingTargetsFromEntry,
  inferStoredCompletionStatus,
  isSttPartialCompletionError,
  parseStoredRequestedTargets
} from './stt-batch/stt-run-state'
import { collectSttTargets, formatSttTargetLabel, getSttTargetKey } from './stt-targets'
import { readSttRunManifestEntry, writeSttBatchManifest, writeSttRunManifest } from './manifest'
import { readBatchManifest } from '../manifest-utils'
import { YOUTUBE_CAPTIONS_SERVICE } from './youtube-captions'
import type { ResumeTarget } from '../resume/resume-types'

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const toSourceFromStep1 = (entry: Record<string, unknown>): { url?: string, filePath?: string } => {
  const step1 = isRecord(entry['step1']) ? entry['step1'] : undefined
  const rawUrl = typeof step1?.['url'] === 'string' ? step1['url'] : undefined
  if (!rawUrl) {
    throw CLIUsageError('Batch entry is missing step1.url and cannot be resumed.')
  }

  if (rawUrl.startsWith('file://')) {
    try {
      return { filePath: fileURLToPath(rawUrl) }
    } catch {
      return { filePath: decodeURIComponent(rawUrl.replace(/^file:\/\/+/, '/')) }
    }
  }

  return { url: rawUrl }
}

const resolveStoredOutputDir = async (
  entry: Record<string, unknown>
): Promise<string | undefined> => {
  if (typeof entry['outputDir'] === 'string' && entry['outputDir'].length > 0) {
    return resolvePath(entry['outputDir'])
  }
  return undefined
}

const parseResumeEntry = async (
  entry: unknown,
  selectedTargets: SttTarget[] | undefined,
  options: Pick<ResumeSttBatchRunOptions, 'retryableOnly' | 'ignoreUnresumableEntries'>
    & { youtubeCaptions: boolean, currentTargets: SttTarget[] }
): Promise<ResumeBatchEntry | undefined> => {
  if (!isRecord(entry)) {
    return undefined
  }

  const outputDir = await resolveStoredOutputDir(entry)
  if (!outputDir) {
    if (options.ignoreUnresumableEntries) {
      l.warn('Skipping STT entry with no resumable output directory')
      return undefined
    }
    throw CLIUsageError('Run entry is missing outputDir and could not be matched to an STT output directory.')
  }

  const storedRequestedTargets = parseStoredRequestedTargets(entry)
  const storedCaptionOnly = storedRequestedTargets.length === 1
    && storedRequestedTargets[0]?.service === YOUTUBE_CAPTIONS_SERVICE

  const requestedTargets = storedCaptionOnly && !options.youtubeCaptions
    ? (selectedTargets && selectedTargets.length > 0 ? selectedTargets : options.currentTargets)
    : storedRequestedTargets.length > 0
      ? storedRequestedTargets
      : selectedTargets

  if (!requestedTargets || requestedTargets.length === 0) {
    throw CLIUsageError('Could not determine the original STT provider set for this output. Re-run with explicit provider flags.')
  }

  const selectedKeys = selectedTargets ? new Set(selectedTargets.map(getSttTargetKey)) : undefined
  if (selectedKeys && !(storedCaptionOnly && options.youtubeCaptions)) {
    const requestedKeys = new Set(requestedTargets.map(getSttTargetKey))
    const unexpected = [...selectedKeys].filter((key) => !requestedKeys.has(key))
    if (unexpected.length > 0) {
      throw CLIUsageError(`Requested resume providers are not a subset of the original providers: ${unexpected.join(', ')}`)
    }
  }

  let source: { url?: string, filePath?: string }
  try {
    source = toSourceFromStep1(entry)
  } catch (error) {
    if (options.ignoreUnresumableEntries) {
      l.warn(error instanceof Error ? error.message : String(error))
      return undefined
    }
    throw error
  }

  const completionStatus = inferStoredCompletionStatus(entry, requestedTargets)
  const missingTargets = buildMissingTargetsFromEntry(entry, requestedTargets, options.retryableOnly === true)
    .filter((target) => selectedKeys ? selectedKeys.has(getSttTargetKey(target)) : true)

  return {
    outputDir,
    source,
    requestedTargets,
    missingTargets,
    completionStatus,
    rawEntry: entry
  }
}

const readOutputMetadata = async (outputDir: string): Promise<BatchManifestEntry> => {
  const metadata = await readSttRunManifestEntry(outputDir)
  if (!isRecord(metadata)) {
    throw CLIUsageError(`Invalid STT manifest at ${outputDir}/run.json`)
  }

  return metadata
}

const withOutputDir = (
  metadata: BatchManifestEntry,
  outputDir: string
): BatchManifestEntry => ({
  ...metadata,
  outputDir
})

const stripOutputDir = (
  metadata: BatchManifestEntry
): Record<string, unknown> => {
  const { outputDir: _outputDir, ...rest } = metadata
  return rest
}

const readResumeTargetManifest = async (
  target: ResumeTarget
): Promise<(ResumeBatchManifest & { source?: Record<string, unknown> }) | undefined> => {
  if (target.scope === 'batch') {
    const manifest = await readBatchManifest(target.dir, 'stt')
    if (!manifest) {
      return undefined
    }

    return {
      infoPath: manifest.manifestPath,
      entries: manifest.manifest.items,
      ...(manifest.manifest.source ? { source: manifest.manifest.source } : {})
    }
  }

  const metadata = await readOutputMetadata(target.dir)
  return {
    infoPath: target.manifestPath,
    entries: [withOutputDir(metadata, target.dir)]
  }
}

const parseResumeEntries = async (
  entries: BatchManifestEntry[],
  selectedTargets: SttTarget[] | undefined,
  options: Pick<ResumeSttBatchRunOptions, 'retryableOnly' | 'ignoreUnresumableEntries'>
    & { youtubeCaptions: boolean, currentTargets: SttTarget[] }
): Promise<Array<ResumeBatchEntry | undefined>> =>
  await Promise.all(entries.map(async (entry) =>
    await parseResumeEntry(entry, selectedTargets, options)
  ))

export const hasResumableSttTargetWork = async (
  target: ResumeTarget,
  selectedTargets: SttTarget[] | undefined,
  options: { youtubeCaptions: boolean, currentTargets: SttTarget[] }
): Promise<boolean> => {
  const manifest = await readResumeTargetManifest(target)
  if (!manifest) {
    return false
  }

  for (const entry of manifest.entries) {
    try {
      const parsedEntry = await parseResumeEntry(entry, selectedTargets, {
        retryableOnly: false,
        ignoreUnresumableEntries: true,
        ...options
      })
      if (parsedEntry && parsedEntry.missingTargets.length > 0) {
        return true
      }
    } catch {
      continue
    }
  }

  return false
}

const batchHasResumableWork = async (
  batchDir: string,
  selectedTargets: SttTarget[] | undefined,
  options: { youtubeCaptions: boolean, currentTargets: SttTarget[] }
): Promise<boolean> =>
  await hasResumableSttTargetWork({
    kind: 'stt',
    scope: 'batch',
    dir: resolvePath(batchDir),
    manifestPath: join(resolvePath(batchDir), 'batch.json')
  }, selectedTargets, options)

export const discoverLatestResumableSttBatchDir = async (
  outputRootInput: string,
  selectedTargets?: SttTarget[],
  options: { youtubeCaptions?: boolean, currentTargets?: SttTarget[] } = {}
): Promise<string | undefined> => {
  const outputRoot = resolvePath(outputRootInput)

  let batchNames: string[]
  try {
    const entries = await readdir(outputRoot, { withFileTypes: true })
    batchNames = entries
      .filter((dirent) => dirent.isDirectory())
      .map((dirent) => dirent.name)
      .sort((left, right) => right.localeCompare(left))
  } catch {
    return undefined
  }

  for (const batchName of batchNames) {
    const batchDir = join(outputRoot, batchName)
    if (await batchHasResumableWork(batchDir, selectedTargets, {
      youtubeCaptions: options.youtubeCaptions === true,
      currentTargets: options.currentTargets ?? []
    })) {
      return batchDir
    }
  }

  return undefined
}

export const resolveResumeSttBatchDir = async (
  batchDirInput: string | undefined,
  selectedTargets?: SttTarget[],
  options: { youtubeCaptions?: boolean, currentTargets?: SttTarget[] } = {},
  outputRootInput = './output'
): Promise<string> => {
  if (typeof batchDirInput === 'string' && batchDirInput.trim().length > 0) {
    return batchDirInput
  }

  const discoveredBatchDir = await discoverLatestResumableSttBatchDir(outputRootInput, selectedTargets, options)
  if (discoveredBatchDir) {
    return discoveredBatchDir
  }

  if (selectedTargets && selectedTargets.length > 0) {
    throw CLIUsageError(`Could not find a resumable STT batch under ${outputRootInput} that matches the selected provider flags. Pass a batch directory explicitly.`)
  }

  throw CLIUsageError(`Could not find a resumable STT batch under ${outputRootInput}. Pass a batch directory explicitly.`)
}

const formatResumeSummary = (
  full: number,
  incomplete: number,
  failed: number
): string => `Resume complete: ${full} full, ${incomplete} incomplete, ${failed} failed`

const collectPartialFailureLabels = (
  metadata: Record<string, unknown>,
  partialFailureLabels: Map<string, number>
): void => {
  const errors = Array.isArray(metadata['errors'])
    ? metadata['errors'].filter((value): value is Record<string, unknown> => isRecord(value))
    : []
  for (const failure of errors) {
    if (typeof failure['service'] !== 'string' || typeof failure['model'] !== 'string') {
      continue
    }
    const label = formatSttTargetLabel({
      service: failure['service'] as SttTarget['service'],
      model: failure['model']
    })
    partialFailureLabels.set(label, (partialFailureLabels.get(label) ?? 0) + 1)
  }
}

const runResumePass = async (
  target: ResumeTarget,
  opts: RuntimeOptions,
  selectedTargets: SttTarget[] | undefined,
  options: NormalizedResumeSttBatchRunOptions & { youtubeCaptions: boolean, currentTargets: SttTarget[] },
  pass: number,
  totalPasses: number
): Promise<ResumeSttBatchPassResult> => {
  const manifest = await readResumeTargetManifest(target)
  if (!manifest) {
    throw CLIUsageError(
      target.scope === 'batch'
        ? `Invalid batch manifest at ${join(target.dir, 'batch.json')}`
        : `Invalid STT manifest at ${join(target.dir, 'run.json')}`
    )
  }

  const parsedEntries = await parseResumeEntries(manifest.entries, selectedTargets, options)

  const batchCoordinator = parsedEntries.filter((entry) => entry !== undefined).length > 1
    ? new SttBatchCoordinator({ batchConcurrency: opts.batchConcurrency })
    : undefined

  let full = 0
  let incomplete = 0
  let failed = 0
  let attemptedEntries = 0
  const updatedEntries: BatchManifestEntry[] = []
  const partialFailureLabels = new Map<string, number>()

  if (options.maxPasses > 1) {
    l.info(`STT resume pass ${pass}/${totalPasses}`)
  }

  for (let index = 0; index < parsedEntries.length; index++) {
    const entry = parsedEntries[index]
    if (!entry) {
      const rawEntry = manifest.entries[index]
      if (rawEntry) {
        updatedEntries.push(rawEntry)
      }
      continue
    }

    const entryLabel = `${index + 1}/${parsedEntries.length}`
    const wasComplete = entry.completionStatus === 'full' && entry.missingTargets.length === 0
    if (wasComplete) {
      l.success(`Resume ${entryLabel}: already full (${entry.outputDir})`)
      full += 1
      updatedEntries.push(withOutputDir(entry.rawEntry, entry.outputDir))
      continue
    }

    if (entry.missingTargets.length === 0) {
      l.warn(`Resume ${entryLabel}: no matching missing providers selected; keeping ${entry.completionStatus} state (${entry.outputDir})`)
      const metadata = await readOutputMetadata(entry.outputDir)
      updatedEntries.push(withOutputDir(metadata, entry.outputDir))
      collectPartialFailureLabels(metadata, partialFailureLabels)
      if (metadata['completionStatus'] === 'failed') {
        failed += 1
      } else {
        incomplete += 1
      }
      continue
    }

    attemptedEntries += 1
    l.info(`Resume ${entryLabel}: ${entry.outputDir} -> ${entry.missingTargets.map(formatSttTargetLabel).join(', ')}`)
    try {
      const outputDir = await processStt(entry.source, target.dir, opts, undefined, {
        outputDir: entry.outputDir,
        requestedTargets: entry.requestedTargets,
        targetsToRun: entry.missingTargets,
        batchCoordinator
      })

      const metadata = await readOutputMetadata(outputDir)
      updatedEntries.push(withOutputDir(metadata, outputDir))
      full += 1
      l.success(`Resume ${entryLabel}: complete`)
    } catch (error) {
      if (!isSttPartialCompletionError(error)) {
        throw error
      }

      const metadata = await readOutputMetadata(error.outputDir)
      updatedEntries.push(withOutputDir(metadata, error.outputDir))

      if (error.completionStatus === 'failed') {
        failed += 1
      } else {
        incomplete += 1
      }

      collectPartialFailureLabels(metadata, partialFailureLabels)
      l.warn(`Resume ${entryLabel}: ${error.completionStatus} (${error.message})`)
    }
  }

  if (target.scope === 'batch') {
    await writeSttBatchManifest(target.dir, updatedEntries, manifest.source)
  } else if (updatedEntries[0]) {
    await writeSttRunManifest(target.dir, stripOutputDir(updatedEntries[0]))
  }

  if (partialFailureLabels.size > 0) {
    l.warn(`Partial provider failures: ${[...partialFailureLabels.entries()]
      .sort((left, right) => left[0].localeCompare(right[0]))
      .map(([label, count]) => `${label} x${count}`)
      .join(', ')}`)
  }

  if (batchCoordinator) {
    const snapshot = batchCoordinator.getSchedulerSnapshot()
    const summary = formatSttBatchSchedulerSummary(snapshot)
    if (summary) {
      l.info(`STT batch backfill scheduler summary: ${summary}`)
      l.write('info', 'STT batch backfill scheduler summary', {
        category: 'pipeline',
        humanTable: createHumanTable(
          buildSttBatchSchedulerRows(snapshot),
          ['provider', 'kind', 'launchSlots', 'pollSlots', 'launched', 'completed', 'queueWaitMs', 'polls', 'blocked', 'degraded', 'backfill', 'warm']
        )
      })
    }
  }

  l.info(formatResumeSummary(full, incomplete, failed))

  return {
    ok: full,
    partial: 0,
    incomplete,
    fail: failed,
    ...(target.scope === 'batch' ? { batchDir: target.dir } : {}),
    attemptedEntries,
    ...(incomplete > 0 || failed > 0 ? { failureExitCode: 2 } : {})
  }
}

const runResumeSttTarget = async (
  target: ResumeTarget,
  opts: RuntimeOptions,
  selectedTargets?: SttTarget[],
  runOptions: ResumeSttBatchRunOptions = {}
): Promise<ResumeSttBatchPassResult> => {
  const currentTargets = selectedTargets && selectedTargets.length > 0 ? selectedTargets : collectSttTargets(opts)
  const normalizedOptions: NormalizedResumeSttBatchRunOptions = {
    retryableOnly: runOptions.retryableOnly === true,
    maxPasses: Math.max(1, runOptions.maxPasses ?? 1),
    ignoreUnresumableEntries: runOptions.ignoreUnresumableEntries === true
  }

  let result = await runResumePass(target, opts, selectedTargets, {
    ...normalizedOptions,
    youtubeCaptions: opts.youtubeCaptions,
    currentTargets
  }, 1, normalizedOptions.maxPasses)

  for (let pass = 2; pass <= normalizedOptions.maxPasses; pass++) {
    if (result.incomplete === 0 && result.fail === 0) {
      break
    }
    if (result.attemptedEntries === 0) {
      break
    }
    result = await runResumePass(target, opts, selectedTargets, {
      ...normalizedOptions,
      youtubeCaptions: opts.youtubeCaptions,
      currentTargets
    }, pass, normalizedOptions.maxPasses)
  }

  return result
}

export const runResumeSttMissingFromBatchDir = async (
  batchDirInput: string,
  opts: RuntimeOptions,
  selectedTargets?: SttTarget[],
  runOptions: ResumeSttBatchRunOptions = {}
): Promise<ResumeSttBatchPassResult> =>
  await runResumeSttTarget({
    kind: 'stt',
    scope: 'batch',
    dir: resolvePath(batchDirInput),
    manifestPath: join(resolvePath(batchDirInput), 'batch.json')
  }, opts, selectedTargets, runOptions)

export const resumeSttTarget = async (
  target: ResumeTarget,
  opts: RuntimeOptions,
  selectedTargets?: SttTarget[]
): Promise<void> => {
  const result = await runResumeSttTarget(target, opts, selectedTargets)
  if (target.scope === 'batch' && result.batchDir) {
    await logSttBatchFinalSummary(result.batchDir)
  }
  if (result.incomplete > 0 || result.fail > 0) {
    const error = new Error(`STT resume still has ${result.incomplete} incomplete and ${result.fail} failed item(s)`)
    ;(error as Error & { exitCode?: number }).exitCode = 2
    throw error
  }
}

export const resumeSttMissingFromBatchDir = async (
  batchDirInput: string,
  opts: RuntimeOptions,
  selectedTargets?: SttTarget[]
): Promise<void> => {
  await resumeSttTarget({
    kind: 'stt',
    scope: 'batch',
    dir: resolvePath(batchDirInput),
    manifestPath: join(resolvePath(batchDirInput), 'batch.json')
  }, opts, selectedTargets)
}
