import { join } from 'node:path'
import type {
  ExistingSttRun,
  Step2Metadata,
  SttCompletionStatus,
  SttProviderFailureSummary,
  SttProviderState,
  SttProviderSuccess,
  SttRecordedProviderError,
  SttRequestedProvider,
  SttTarget,
  TranscriptionResult
} from '~/types'
import { parseStep2RuntimeMetadata } from '../async-lifecycle'
import { parseStoredStep2TimingMetadata } from '../stt-timing-metadata'
import { getSttTargetDirectoryName, getSttTargetKey } from '../stt-targets'
import { readSttRunManifestEntry } from '../manifest'
import { readProviderResultEntry } from '../../../manifest-utils'

const TRANSCRIPT_LINE_PATTERN = /^\[(\d{2}:\d{2}:\d{2})\]\s+(?:\[([^\]]+)\]\s+)?(.*)$/

const STT_SERVICES = new Set<SttTarget['service']>([
  'whisper',
  'reverb',
  'gcloud',
  'aws',
  'deepgram',
  'deepinfra',
  'deapi',
  'elevenlabs',
  'soniox',
  'speechmatics',
  'rev',
  'groq',
  'mistral',
  'assemblyai',
  'gladia',
  'happyscribe',
  'supadata',
  'openai-stt',
  'gemini-stt',
  'glm-stt',
  'together',
  'cloudflare',
  'youtube-captions'
])

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const isSttService = (value: unknown): value is SttTarget['service'] =>
  typeof value === 'string' && STT_SERVICES.has(value as SttTarget['service'])

const parseTranscriptText = (text: string): TranscriptionResult => {
  const segments: TranscriptionResult['segments'] = []
  for (const rawLine of text.split('\n')) {
    const line = rawLine.trim()
    if (line.length === 0) {
      continue
    }

    const match = line.match(TRANSCRIPT_LINE_PATTERN)
    if (!match) {
      continue
    }

    const segmentText = (match[3] ?? '').trim()
    if (segmentText.length === 0) {
      continue
    }

    segments.push({
      start: match[1] as string,
      end: match[1] as string,
      text: segmentText,
      ...(typeof match[2] === 'string' && match[2].trim().length > 0
        ? { speaker: match[2].trim() }
        : {})
    })
  }

  if (segments.length === 0) {
    const trimmed = text.trim()
    return {
      text: trimmed,
      segments: trimmed.length > 0
        ? [{ start: '00:00:00', end: '00:00:00', text: trimmed }]
        : []
    }
  }

  return {
    text: segments.map((segment) => segment.text).join(' ').trim(),
    segments
  }
}

const parseStoredStep2Metadata = (value: unknown): Step2Metadata | undefined => {
  if (!isRecord(value) || !isSttService(value['transcriptionService']) || typeof value['transcriptionModel'] !== 'string') {
    return undefined
  }

  if (typeof value['processingTime'] !== 'number' || typeof value['tokenCount'] !== 'number') {
    return undefined
  }

  const timings = parseStoredStep2TimingMetadata(value['timings'])
  const runtime = parseStep2RuntimeMetadata(value['runtime'])
  let billing: Step2Metadata['billing'] | undefined
  if (isRecord(value['billing'])) {
    const parsedBilling: NonNullable<Step2Metadata['billing']> = {}
    if (typeof value['billing']['creditsUsed'] === 'number') {
      parsedBilling.creditsUsed = value['billing']['creditsUsed']
    }
    if (typeof value['billing']['creditRateCents'] === 'number') {
      parsedBilling.creditRateCents = value['billing']['creditRateCents']
    }
    if (typeof value['billing']['totalCost'] === 'number') {
      parsedBilling.totalCost = value['billing']['totalCost']
    }
    if (
      value['billing']['source'] === 'response-header'
      || value['billing']['source'] === 'fallback-estimate'
      || value['billing']['source'] === 'provider_quote'
      || value['billing']['source'] === 'registry_fallback'
    ) {
      parsedBilling.source = value['billing']['source']
    }
    if (
      value['billing']['mode'] === 'url'
      || value['billing']['mode'] === 'duration'
      || value['billing']['mode'] === 'order'
      || value['billing']['mode'] === 'segment_sum'
    ) {
      parsedBilling.mode = value['billing']['mode']
    }
    billing = Object.keys(parsedBilling).length > 0 ? parsedBilling : undefined
  }

  return {
    transcriptionService: value['transcriptionService'],
    transcriptionModel: value['transcriptionModel'],
    processingTime: value['processingTime'],
    tokenCount: value['tokenCount'],
    ...(value['captionKind'] === 'manual' || value['captionKind'] === 'auto'
      ? { captionKind: value['captionKind'] }
      : {}),
    ...(typeof value['captionLanguage'] === 'string' ? { captionLanguage: value['captionLanguage'] } : {}),
    ...(value['captionFormat'] === 'vtt' ? { captionFormat: value['captionFormat'] } : {}),
    ...(timings ? { timings } : {}),
    ...(runtime ? { runtime } : {}),
    ...(billing && Object.keys(billing).length > 0 ? { billing } : {})
  }
}

export const getSttProviderArtifactDir = (
  target: Pick<SttTarget, 'service' | 'model'>
): string => `providers/${getSttTargetDirectoryName(target)}`

export const toRequestedProvider = (target: SttTarget): SttRequestedProvider => ({
  service: target.service,
  model: target.model,
  local: target.local,
  ...(target.awsRegion ? { awsRegion: target.awsRegion } : {}),
  ...(target.awsBucket ? { awsBucket: target.awsBucket } : {}),
  ...(target.diarizationOptions ? { diarizationOptions: target.diarizationOptions } : {})
})

export const toRecordedProviderError = (
  failure: SttProviderFailureSummary
): SttRecordedProviderError => ({
  message: failure.message,
  retryable: failure.retryable,
  ...(failure.skipped === true ? { skipped: true } : {}),
  ...(failure.stage ? { stage: failure.stage } : {}),
  ...(typeof failure.status === 'number' ? { status: failure.status } : {}),
  ...(typeof failure.retryAfterMs === 'number' ? { retryAfterMs: failure.retryAfterMs } : {}),
  ...(failure.errorFile ? { errorFile: failure.errorFile } : {}),
  ...(failure.rawResponseFile ? { rawResponseFile: failure.rawResponseFile } : {})
})

export const parseStoredRequestedTarget = (value: unknown): SttTarget | undefined => {
  if (!isRecord(value) || !isSttService(value['service']) || typeof value['model'] !== 'string') {
    return undefined
  }

  return {
    service: value['service'],
    model: value['model'],
    local: value['local'] === true,
    ...(typeof value['awsRegion'] === 'string' ? { awsRegion: value['awsRegion'] } : {}),
    ...(typeof value['awsBucket'] === 'string' ? { awsBucket: value['awsBucket'] } : {}),
    ...(isRecord(value['diarizationOptions']) ? { diarizationOptions: value['diarizationOptions'] as SttTarget['diarizationOptions'] } : {})
  }
}

export const parseStoredRequestedTargets = (
  entry: Record<string, unknown>
): SttTarget[] =>
  Array.isArray(entry['requestedProviders'])
    ? entry['requestedProviders'].map(parseStoredRequestedTarget).filter((target): target is SttTarget => target !== undefined)
    : []

export const parseStoredProviderState = (value: unknown): SttProviderState | undefined => {
  if (!isRecord(value) || !isSttService(value['service']) || typeof value['model'] !== 'string') {
    return undefined
  }

  if (value['status'] !== 'succeeded' && value['status'] !== 'missing' && value['status'] !== 'failed' && value['status'] !== 'skipped') {
    return undefined
  }

  if (typeof value['artifactDir'] !== 'string' || typeof value['attempts'] !== 'number') {
    return undefined
  }

  const lastError = isRecord(value['lastError']) && typeof value['lastError']['message'] === 'string'
    ? {
        message: value['lastError']['message'],
        retryable: value['lastError']['retryable'] === true,
        ...(value['lastError']['skipped'] === true ? { skipped: true } : {}),
        ...(typeof value['lastError']['stage'] === 'string' ? { stage: value['lastError']['stage'] } : {}),
        ...(typeof value['lastError']['status'] === 'number' ? { status: value['lastError']['status'] } : {}),
        ...(typeof value['lastError']['retryAfterMs'] === 'number' ? { retryAfterMs: value['lastError']['retryAfterMs'] } : {}),
        ...(typeof value['lastError']['errorFile'] === 'string' ? { errorFile: value['lastError']['errorFile'] } : {}),
        ...(typeof value['lastError']['rawResponseFile'] === 'string' ? { rawResponseFile: value['lastError']['rawResponseFile'] } : {})
      } satisfies SttRecordedProviderError
    : undefined

  return {
    service: value['service'],
    model: value['model'],
    local: value['local'] === true,
    artifactDir: value['artifactDir'],
    status: value['status'],
    attempts: value['attempts'],
    ...(typeof value['retryable'] === 'boolean' ? { retryable: value['retryable'] } : {}),
    ...(lastError ? { lastError } : {})
  }
}

export const parseStoredProviderStateMap = (
  entry: Record<string, unknown>
): Map<string, SttProviderState> => {
  const states = new Map<string, SttProviderState>()
  const values = Array.isArray(entry['providerStates']) ? entry['providerStates'] : []
  for (const value of values) {
    const parsed = parseStoredProviderState(value)
    if (!parsed) {
      continue
    }
    states.set(getSttTargetKey(parsed), parsed)
  }
  return states
}

export const parseSuccessfulProviderKeys = (
  entry: Record<string, unknown>
): Set<string> => {
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

    keys.add(`${value['transcriptionService']}:${value['transcriptionModel']}`)
  }
  return keys
}

const isSkippedProviderState = (
  state: Pick<SttProviderState, 'status' | 'lastError'> | undefined
): boolean =>
  state?.status === 'skipped' || state?.lastError?.skipped === true

const resolveCompletionStatusFromState = (
  requestedTargets: SttTarget[],
  successKeys: Set<string>,
  providerStates: Map<string, SttProviderState>
): SttCompletionStatus => {
  let succeeded = 0
  let incomplete = 0

  for (const target of requestedTargets) {
    const key = getSttTargetKey(target)
    const state = providerStates.get(key)
    if (isSkippedProviderState(state)) {
      continue
    }

    if (successKeys.has(key) || state?.status === 'succeeded') {
      succeeded += 1
      continue
    }

    incomplete += 1
  }

  if (succeeded === 0) {
    return 'failed'
  }

  return incomplete === 0 ? 'full' : 'incomplete'
}

export const summarizeSttProviderStates = (
  providerStates: SttProviderState[]
): {
  requested: number
  applicable: number
  succeeded: number
  failed: number
  missing: number
  skipped: number
} => {
  const summary = {
    requested: providerStates.length,
    applicable: 0,
    succeeded: 0,
    failed: 0,
    missing: 0,
    skipped: 0
  }

  for (const state of providerStates) {
    if (state.status === 'skipped') {
      summary.skipped += 1
      continue
    }

    summary.applicable += 1
    if (state.status === 'succeeded') {
      summary.succeeded += 1
      continue
    }

    if (state.status === 'failed') {
      summary.failed += 1
      continue
    }

    summary.missing += 1
  }

  return summary
}

export const inferStoredCompletionStatus = (
  entry: Record<string, unknown>,
  requestedTargets: SttTarget[]
): SttCompletionStatus => {
  const successKeys = parseSuccessfulProviderKeys(entry)
  const providerStates = parseStoredProviderStateMap(entry)
  if (providerStates.size > 0) {
    return resolveCompletionStatusFromState(requestedTargets, successKeys, providerStates)
  }

  if (entry['completionStatus'] === 'full' || entry['completionStatus'] === 'incomplete' || entry['completionStatus'] === 'failed') {
    return entry['completionStatus']
  }

  return resolveCompletionStatusFromState(requestedTargets, successKeys, providerStates)
}

export const buildMissingTargetsFromEntry = (
  entry: Record<string, unknown>,
  requestedTargets: SttTarget[],
  retryableOnly: boolean
): SttTarget[] => {
  const explicitMissing = Array.isArray(entry['missingProviders'])
    ? entry['missingProviders'].map(parseStoredRequestedTarget).filter((target): target is SttTarget => target !== undefined)
    : []
  const providerStates = parseStoredProviderStateMap(entry)
  const successKeys = parseSuccessfulProviderKeys(entry)

  const missingTargets = explicitMissing.length > 0
    ? explicitMissing.filter((target) => !isSkippedProviderState(providerStates.get(getSttTargetKey(target))))
    : requestedTargets.filter((target) => {
        const key = getSttTargetKey(target)
        return !successKeys.has(key) && !isSkippedProviderState(providerStates.get(key))
      })

  if (!retryableOnly) {
    return missingTargets
  }

  return missingTargets.filter((target) => providerStates.get(getSttTargetKey(target))?.retryable === true)
}

export const readExistingSttRun = async (
  outputDir: string,
  requestedTargets: SttTarget[]
): Promise<ExistingSttRun> => {
  const providerStates = new Map<string, SttProviderState>()
  const successes: Array<SttProviderSuccess | undefined> = new Array(requestedTargets.length)
  const raw = await readSttRunManifestEntry(outputDir)
  if (!isRecord(raw)) {
    return { successes, providerStates }
  }

  const storedProviderStates = parseStoredProviderStateMap(raw)
  for (const [key, value] of storedProviderStates) {
    providerStates.set(key, value)
  }

  await Promise.all(requestedTargets.map(async (target, index) => {
    const providerDir = join(outputDir, getSttProviderArtifactDir(target))
    const providerResult = await readProviderResultEntry(providerDir)
    if (!providerResult) {
      return
    }

    const metadata = parseStoredStep2Metadata(providerResult.metadata)
    if (!metadata) {
      return
    }

    const transcriptPath = join(outputDir, getSttProviderArtifactDir(target), 'transcription.txt')
    const transcriptText = await Bun.file(transcriptPath).text().catch(() => '')
    successes[index] = {
      target,
      metadata,
      result: parseTranscriptText(transcriptText),
      relativeDir: getSttProviderArtifactDir(target)
    }
  }))

  return {
    successes,
    providerStates
  }
}

export const buildProviderStates = <
  SuccessLike extends SttProviderSuccess,
  FailureLike extends SttProviderFailureSummary
>(
  requestedTargets: SttTarget[],
  successes: Array<SuccessLike | undefined>,
  failuresByIndex: Map<number, FailureLike>,
  existingStates: Map<string, SttProviderState>
): SttProviderState[] =>
  requestedTargets.map((target, index) => {
    const key = getSttTargetKey(target)
    const existing = existingStates.get(key)
    const failure = failuresByIndex.get(index)
    const success = successes[index]

    if (success) {
      return {
        service: target.service,
        model: target.model,
        local: target.local,
        artifactDir: getSttProviderArtifactDir(target),
        status: 'succeeded',
        attempts: existing?.attempts ?? 0
      }
    }

    if (failure) {
      return {
        service: target.service,
        model: target.model,
        local: target.local,
        artifactDir: getSttProviderArtifactDir(target),
        status: failure.skipped === true ? 'skipped' : 'failed',
        attempts: existing?.attempts ?? 0,
        retryable: failure.retryable,
        lastError: toRecordedProviderError({
          message: failure.message,
          retryable: failure.retryable,
          ...(failure.skipped === true ? { skipped: true } : {}),
          ...(failure.stage ? { stage: failure.stage } : {}),
          ...(typeof failure.status === 'number' ? { status: failure.status } : {}),
          ...(typeof failure.retryAfterMs === 'number' ? { retryAfterMs: failure.retryAfterMs } : {}),
          ...(failure.errorFile ? { errorFile: `${getSttProviderArtifactDir(target)}/${failure.errorFile}` } : {}),
          ...(failure.rawResponseFile ? { rawResponseFile: `${getSttProviderArtifactDir(target)}/${failure.rawResponseFile}` } : {})
        })
      }
    }

    return {
      service: target.service,
      model: target.model,
      local: target.local,
      artifactDir: getSttProviderArtifactDir(target),
      status: existing?.status ?? 'missing',
      attempts: existing?.attempts ?? 0,
      ...(existing?.retryable !== undefined ? { retryable: existing.retryable } : {}),
      ...(existing?.lastError ? { lastError: existing.lastError } : {})
    }
  })

export const resolveCompletionStatus = (
  providerStates: SttProviderState[]
): SttCompletionStatus => {
  const summary = summarizeSttProviderStates(providerStates)
  if (summary.succeeded === 0) {
    return 'failed'
  }
  return summary.failed === 0 && summary.missing === 0 ? 'full' : 'incomplete'
}

export const buildMissingProviders = (
  providerStates: SttProviderState[],
  requestedTargets: SttTarget[]
): SttRequestedProvider[] => {
  const missingKeys = new Set(providerStates
    .filter((state) => state.status === 'failed' || state.status === 'missing')
    .map((state) => getSttTargetKey(state)))

  return requestedTargets
    .filter((target) => missingKeys.has(getSttTargetKey(target)))
    .map(toRequestedProvider)
}

export const buildMetadataErrorEntries = (
  providerStates: SttProviderState[]
): Array<Record<string, unknown>> =>
  providerStates
    .filter((state) => state.lastError !== undefined)
    .map((state) => ({
      service: state.service,
      model: state.model,
      message: state.lastError?.message,
      ...(state.status === 'skipped' || state.lastError?.skipped === true ? { skipped: true } : {}),
      ...(state.lastError?.stage ? { stage: state.lastError.stage } : {}),
      ...(typeof state.lastError?.status === 'number' ? { status: state.lastError.status } : {}),
      ...(typeof state.lastError?.retryAfterMs === 'number' ? { retryAfterMs: state.lastError.retryAfterMs } : {}),
      retryable: state.lastError?.retryable === true,
      ...(state.lastError?.errorFile ? { errorFile: state.lastError.errorFile } : {}),
      ...(state.lastError?.rawResponseFile ? { rawResponseFile: state.lastError.rawResponseFile } : {})
    }))

export class SttPartialCompletionError extends Error {
  outputDir: string
  completionStatus: SttCompletionStatus
  missingProviders: SttRequestedProvider[]
  exitCode: number

  constructor(
    outputDir: string,
    completionStatus: SttCompletionStatus,
    missingProviders: SttRequestedProvider[],
    message: string
  ) {
    super(message)
    this.name = 'SttPartialCompletionError'
    this.outputDir = outputDir
    this.completionStatus = completionStatus
    this.missingProviders = missingProviders
    this.exitCode = 2
  }
}

export const isSttPartialCompletionError = (
  error: unknown
): error is SttPartialCompletionError => error instanceof SttPartialCompletionError
