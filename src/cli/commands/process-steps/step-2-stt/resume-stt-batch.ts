import { readdir } from 'node:fs/promises'
import { resolve as resolvePath, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import * as l from '~/logger'
import type { BatchProcessResult, RuntimeOptions } from '~/types'
import { CLIUsageError } from '~/utils/error-handler'
import { processStt, type SttCompletionStatus, isSttPartialCompletionError } from '~/cli/commands/process-steps/process-stt'
import { SttBatchCoordinator } from './stt-batch-coordinator'
import type { SttTarget } from './stt-targets'

type ResumeBatchEntry = {
  outputDir: string
  source: { url?: string, filePath?: string }
  requestedTargets: SttTarget[]
  missingTargets: SttTarget[]
  completionStatus: SttCompletionStatus
  rawEntry: Record<string, unknown>
}

type ParsedProviderState = {
  service: SttTarget['service']
  model: string
  status: 'succeeded' | 'missing' | 'failed' | 'skipped'
  retryable?: boolean | undefined
}

type ResumeSttBatchRunOptions = {
  retryableOnly?: boolean | undefined
  maxPasses?: number | undefined
  ignoreUnresumableEntries?: boolean | undefined
}

type NormalizedResumeSttBatchRunOptions = {
  retryableOnly: boolean
  maxPasses: number
  ignoreUnresumableEntries: boolean
}

type ResumeSttBatchPassResult = BatchProcessResult & {
  attemptedEntries: number
}

const STT_SERVICES = new Set<SttTarget['service']>([
  'whisper',
  'reverb',
  'deepgram',
  'elevenlabs',
  'soniox',
  'groq',
  'openai',
  'mistral',
  'assemblyai'
])

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const isSttService = (value: unknown): value is SttTarget['service'] =>
  typeof value === 'string' && STT_SERVICES.has(value as SttTarget['service'])

const getTargetKey = (target: Pick<SttTarget, 'service' | 'model'>): string =>
  `${target.service}:${target.model}`

const formatTargetLabel = (target: Pick<SttTarget, 'service' | 'model'>): string =>
  `${target.service === 'whisper' ? 'whisper.cpp' : target.service}/${target.model}`

const parseRequestedProvider = (value: unknown): SttTarget | undefined => {
  if (!isRecord(value) || !isSttService(value['service']) || typeof value['model'] !== 'string') {
    return undefined
  }

  return {
    service: value['service'],
    model: value['model'],
    local: value['local'] === true,
    ...(isRecord(value['diarizationOptions']) ? { diarizationOptions: value['diarizationOptions'] as SttTarget['diarizationOptions'] } : {})
  }
}

const parseProviderState = (value: unknown): ParsedProviderState | undefined => {
  if (!isRecord(value) || !isSttService(value['service']) || typeof value['model'] !== 'string') {
    return undefined
  }

  if (value['status'] !== 'succeeded' && value['status'] !== 'missing' && value['status'] !== 'failed' && value['status'] !== 'skipped') {
    return undefined
  }

  return {
    service: value['service'],
    model: value['model'],
    status: value['status'],
    ...(typeof value['retryable'] === 'boolean' ? { retryable: value['retryable'] } : {})
  }
}

const parseProviderStateMap = (entry: Record<string, unknown>): Map<string, ParsedProviderState> => {
  const states = new Map<string, ParsedProviderState>()
  const values = Array.isArray(entry['providerStates']) ? entry['providerStates'] : []
  for (const value of values) {
    const parsed = parseProviderState(value)
    if (!parsed) {
      continue
    }
    states.set(getTargetKey(parsed), parsed)
  }
  return states
}

const parseSuccessfulProviderKeys = (entry: Record<string, unknown>): Set<string> => {
  const values = Array.isArray(entry['step2'])
    ? entry['step2']
    : entry['step2'] === undefined
      ? []
      : [entry['step2']]

  const keys = new Set<string>()
  for (const value of values) {
    if (!isRecord(value) || !isSttService(value['transcriptionService']) || typeof value['transcriptionModel'] !== 'string') {
      continue
    }

    const model = typeof value['transcriptionModelName'] === 'string'
      ? value['transcriptionModelName']
      : value['transcriptionModel']
    keys.add(`${value['transcriptionService']}:${model}`)
  }
  return keys
}

const inferCompletionStatus = (
  entry: Record<string, unknown>,
  requestedTargets: SttTarget[]
): SttCompletionStatus => {
  if (entry['completionStatus'] === 'full' || entry['completionStatus'] === 'incomplete' || entry['completionStatus'] === 'failed') {
    return entry['completionStatus']
  }

  const successCount = parseSuccessfulProviderKeys(entry).size
  if (successCount === 0) {
    return 'failed'
  }
  return successCount === requestedTargets.length ? 'full' : 'incomplete'
}

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
  batchDir: string,
  entry: Record<string, unknown>
): Promise<string | undefined> => {
  if (typeof entry['outputDir'] === 'string' && entry['outputDir'].length > 0) {
    return resolvePath(entry['outputDir'])
  }

  const batchEntries = await readdir(batchDir, { withFileTypes: true })
  const expectedSlug = isRecord(entry['step1']) && typeof entry['step1']['slug'] === 'string'
    ? entry['step1']['slug']
    : undefined

  for (const dirent of batchEntries) {
    if (!dirent.isDirectory()) {
      continue
    }

    const candidateDir = join(batchDir, dirent.name)
    const metadataPath = join(candidateDir, 'metadata.json')
    if (!await Bun.file(metadataPath).exists()) {
      continue
    }

    try {
      const metadata = await Bun.file(metadataPath).json() as unknown
      if (!isRecord(metadata) || !isRecord(metadata['step1'])) {
        continue
      }

      if (expectedSlug && metadata['step1']['slug'] === expectedSlug) {
        return candidateDir
      }
    } catch {
    }
  }

  return undefined
}

const buildMissingTargets = (
  entry: Record<string, unknown>,
  requestedTargets: SttTarget[],
  retryableOnly: boolean
): SttTarget[] => {
  const explicitMissing = Array.isArray(entry['missingProviders'])
    ? entry['missingProviders'].map(parseRequestedProvider).filter((target): target is SttTarget => target !== undefined)
    : []
  const providerStates = parseProviderStateMap(entry)

  const missingTargets = (explicitMissing.length > 0
    ? explicitMissing
    : requestedTargets.filter((target) => !parseSuccessfulProviderKeys(entry).has(getTargetKey(target))))

  if (!retryableOnly) {
    return missingTargets
  }

  return missingTargets.filter((target) => providerStates.get(getTargetKey(target))?.retryable === true)
}

const parseResumeEntry = async (
  batchDir: string,
  entry: unknown,
  selectedTargets: SttTarget[] | undefined,
  options: Pick<ResumeSttBatchRunOptions, 'retryableOnly' | 'ignoreUnresumableEntries'>
): Promise<ResumeBatchEntry | undefined> => {
  if (!isRecord(entry)) {
    return undefined
  }

  const outputDir = await resolveStoredOutputDir(batchDir, entry)
  if (!outputDir) {
    if (options.ignoreUnresumableEntries) {
      l.warn('Skipping STT batch entry with no resumable output directory')
      return undefined
    }
    throw CLIUsageError('Batch entry is missing outputDir and could not be matched to an STT output directory.')
  }

  const storedRequestedTargets = Array.isArray(entry['requestedProviders'])
    ? entry['requestedProviders'].map(parseRequestedProvider).filter((target): target is SttTarget => target !== undefined)
    : []

  const requestedTargets = storedRequestedTargets.length > 0
    ? storedRequestedTargets
    : selectedTargets

  if (!requestedTargets || requestedTargets.length === 0) {
    throw CLIUsageError('Could not determine the original STT provider set for this batch. Re-run with explicit provider flags.')
  }

  const selectedKeys = selectedTargets ? new Set(selectedTargets.map(getTargetKey)) : undefined
  if (selectedKeys) {
    const requestedKeys = new Set(requestedTargets.map(getTargetKey))
    const unexpected = [...selectedKeys].filter((key) => !requestedKeys.has(key))
    if (unexpected.length > 0) {
      throw CLIUsageError(`Requested resume providers are not a subset of the original batch providers: ${unexpected.join(', ')}`)
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

  const completionStatus = inferCompletionStatus(entry, requestedTargets)
  const missingTargets = buildMissingTargets(entry, requestedTargets, options.retryableOnly === true)
    .filter((target) => selectedKeys ? selectedKeys.has(getTargetKey(target)) : true)

  return {
    outputDir,
    source,
    requestedTargets,
    missingTargets,
    completionStatus,
    rawEntry: entry
  }
}

const formatResumeSummary = (
  full: number,
  incomplete: number,
  failed: number
): string => `Batch complete: ${full} full, ${incomplete} incomplete, ${failed} failed`

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
    const label = `${failure['service']}/${failure['model']}`
    partialFailureLabels.set(label, (partialFailureLabels.get(label) ?? 0) + 1)
  }
}

const runResumePass = async (
  batchDir: string,
  opts: RuntimeOptions,
  selectedTargets: SttTarget[] | undefined,
  options: NormalizedResumeSttBatchRunOptions,
  pass: number,
  totalPasses: number
): Promise<ResumeSttBatchPassResult> => {
  const infoPath = join(batchDir, 'info.json')
  if (!await Bun.file(infoPath).exists()) {
    throw CLIUsageError(`Could not find batch manifest at ${infoPath}`)
  }

  const rawInfo = await Bun.file(infoPath).json() as unknown
  if (!Array.isArray(rawInfo)) {
    throw CLIUsageError(`Invalid batch manifest at ${infoPath}`)
  }

  const parsedEntries = await Promise.all(rawInfo.map(async (entry) =>
    await parseResumeEntry(batchDir, entry, selectedTargets, options)
  ))

  const batchCoordinator = parsedEntries.filter((entry) => entry !== undefined).length > 1
    ? new SttBatchCoordinator()
    : undefined

  let full = 0
  let incomplete = 0
  let failed = 0
  let attemptedEntries = 0
  const updatedEntries: Record<string, unknown>[] = []
  const partialFailureLabels = new Map<string, number>()

  if (options.maxPasses > 1) {
    l.info(`STT batch backfill pass ${pass}/${totalPasses}`)
  }

  for (let index = 0; index < parsedEntries.length; index++) {
    const entry = parsedEntries[index]
    if (!entry) {
      const rawEntry = rawInfo[index]
      if (isRecord(rawEntry)) {
        updatedEntries.push(rawEntry)
      }
      continue
    }

    const entryLabel = `${index + 1}/${parsedEntries.length}`
    const wasComplete = entry.completionStatus === 'full' && entry.missingTargets.length === 0
    if (wasComplete) {
      l.success(`Resume ${entryLabel}: already full (${entry.outputDir})`)
      full += 1
      updatedEntries.push({
        ...entry.rawEntry,
        outputDir: entry.outputDir
      })
      continue
    }

    if (entry.missingTargets.length === 0) {
      l.warn(`Resume ${entryLabel}: no matching missing providers selected; keeping ${entry.completionStatus} state (${entry.outputDir})`)
      const metadata = await Bun.file(join(entry.outputDir, 'metadata.json')).json() as Record<string, unknown>
      updatedEntries.push({
        ...metadata,
        outputDir: entry.outputDir
      })
      collectPartialFailureLabels(metadata, partialFailureLabels)
      if (metadata['completionStatus'] === 'failed') {
        failed += 1
      } else {
        incomplete += 1
      }
      continue
    }

    attemptedEntries += 1
    l.info(`Resume ${entryLabel}: ${entry.outputDir} -> ${entry.missingTargets.map(formatTargetLabel).join(', ')}`)
    try {
      const outputDir = await processStt(entry.source, batchDir, opts, undefined, {
        outputDir: entry.outputDir,
        requestedTargets: entry.requestedTargets,
        targetsToRun: entry.missingTargets,
        batchCoordinator
      })

      const metadata = await Bun.file(join(outputDir, 'metadata.json')).json() as Record<string, unknown>
      updatedEntries.push({
        ...metadata,
        outputDir
      })
      full += 1
      l.success(`Resume ${entryLabel}: complete`)
    } catch (error) {
      if (!isSttPartialCompletionError(error)) {
        throw error
      }

      const metadata = await Bun.file(join(error.outputDir, 'metadata.json')).json() as Record<string, unknown>
      updatedEntries.push({
        ...metadata,
        outputDir: error.outputDir
      })

      if (error.completionStatus === 'failed') {
        failed += 1
      } else {
        incomplete += 1
      }

      collectPartialFailureLabels(metadata, partialFailureLabels)
      l.warn(`Resume ${entryLabel}: ${error.completionStatus} (${error.message})`)
    }
  }

  await Bun.write(infoPath, JSON.stringify(updatedEntries, null, 2))

  if (partialFailureLabels.size > 0) {
    l.warn(`Partial provider failures: ${[...partialFailureLabels.entries()]
      .sort((left, right) => left[0].localeCompare(right[0]))
      .map(([label, count]) => `${label} x${count}`)
      .join(', ')}`)
  }

  l.info(formatResumeSummary(full, incomplete, failed))

  return {
    ok: full,
    partial: 0,
    incomplete,
    fail: failed,
    batchDir,
    attemptedEntries,
    ...(incomplete > 0 || failed > 0 ? { failureExitCode: 2 } : {})
  }
}

export const runResumeSttMissingFromBatchDir = async (
  batchDirInput: string,
  opts: RuntimeOptions,
  selectedTargets?: SttTarget[],
  runOptions: ResumeSttBatchRunOptions = {}
): Promise<ResumeSttBatchPassResult> => {
  const batchDir = resolvePath(batchDirInput)
  const normalizedOptions: NormalizedResumeSttBatchRunOptions = {
    retryableOnly: runOptions.retryableOnly === true,
    maxPasses: Math.max(1, runOptions.maxPasses ?? 1),
    ignoreUnresumableEntries: runOptions.ignoreUnresumableEntries === true
  }

  let result = await runResumePass(batchDir, opts, selectedTargets, normalizedOptions, 1, normalizedOptions.maxPasses)
  for (let pass = 2; pass <= normalizedOptions.maxPasses; pass++) {
    if (result.incomplete === 0 && result.fail === 0) {
      break
    }
    if (result.attemptedEntries === 0) {
      break
    }
    result = await runResumePass(batchDir, opts, selectedTargets, normalizedOptions, pass, normalizedOptions.maxPasses)
  }

  return result
}

export const resumeSttMissingFromBatchDir = async (
  batchDirInput: string,
  opts: RuntimeOptions,
  selectedTargets?: SttTarget[]
): Promise<void> => {
  const result = await runResumeSttMissingFromBatchDir(batchDirInput, opts, selectedTargets)
  if (result.incomplete > 0 || result.fail > 0) {
    const error = new Error(`STT batch resume still has ${result.incomplete} incomplete and ${result.fail} failed item(s)`)
    ;(error as Error & { exitCode?: number }).exitCode = 2
    throw error
  }
}
