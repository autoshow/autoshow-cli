import { join } from 'node:path'
import {
  ExtractionMetadataSchema,
  ExtractionResultSchema,
  type ExtractionMetadata,
  type ExtractionResult,
  type OcrTarget
} from '~/types'
import { validateData } from '~/utils/validate/validation'
import { getOcrTargetDirectoryName } from './ocr-targets'
import { readOcrRunManifestEntry } from './manifest'
import { readProviderResultEntry } from '../manifest-utils'

export type OcrCompletionStatus = 'full' | 'incomplete' | 'failed'

export type OcrRequestedProvider = {
  service: OcrTarget['service']
  model: string
}

export type OcrRecordedProviderError = {
  message: string
  retryable: boolean
}

export type OcrProviderState = {
  service: OcrTarget['service']
  model: string
  artifactDir: string
  status: 'succeeded' | 'missing' | 'failed' | 'skipped'
  attempts: number
  retryable?: boolean | undefined
  lastError?: OcrRecordedProviderError | undefined
}

export type OcrProviderSuccess = {
  target: OcrTarget
  metadata: ExtractionMetadata
  result: ExtractionResult
  relativeDir?: string | undefined
}

export type ExistingOcrRun = {
  successes: Array<OcrProviderSuccess | undefined>
  providerStates: Map<string, OcrProviderState>
}

type OcrProviderFailureSummary = {
  message: string
  retryable?: boolean | undefined
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

export const getOcrTargetKey = (target: Pick<OcrTarget, 'service' | 'model'>): string =>
  `${target.service}:${target.model}`

export const getOcrProviderArtifactDir = (
  target: Pick<OcrTarget, 'service' | 'model'>
): string => `providers/${getOcrTargetDirectoryName(target)}`

export const toRequestedProvider = (target: OcrTarget): OcrRequestedProvider => ({
  service: target.service,
  model: target.model
})

export const parseStoredRequestedTarget = (value: unknown): OcrTarget | undefined => {
  if (!isRecord(value)) {
    return undefined
  }

  if (
    value['service'] !== 'tesseract'
    && value['service'] !== 'ocrmypdf'
    && value['service'] !== 'paddle-ocr'
    && value['service'] !== 'mistral'
    && value['service'] !== 'glm'
    && value['service'] !== 'openai'
  ) {
    return undefined
  }

  if (typeof value['model'] !== 'string') {
    return undefined
  }

  return {
    service: value['service'],
    model: value['model']
  }
}

export const parseStoredRequestedTargets = (
  entry: Record<string, unknown>
): OcrTarget[] =>
  Array.isArray(entry['requestedProviders'])
    ? entry['requestedProviders'].map(parseStoredRequestedTarget).filter((target): target is OcrTarget => target !== undefined)
    : []

export const parseStoredProviderState = (value: unknown): OcrProviderState | undefined => {
  if (!isRecord(value)) {
    return undefined
  }

  const target = parseStoredRequestedTarget(value)
  if (!target) {
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
        retryable: value['lastError']['retryable'] === true
      } satisfies OcrRecordedProviderError
    : undefined

  return {
    service: target.service,
    model: target.model,
    artifactDir: value['artifactDir'],
    status: value['status'],
    attempts: value['attempts'],
    ...(typeof value['retryable'] === 'boolean' ? { retryable: value['retryable'] } : {}),
    ...(lastError ? { lastError } : {})
  }
}

export const parseStoredProviderStateMap = (
  entry: Record<string, unknown>
): Map<string, OcrProviderState> => {
  const states = new Map<string, OcrProviderState>()
  const values = Array.isArray(entry['providerStates']) ? entry['providerStates'] : []
  for (const value of values) {
    const parsed = parseStoredProviderState(value)
    if (!parsed) {
      continue
    }
    states.set(getOcrTargetKey(parsed), parsed)
  }
  return states
}

const parseSuccessfulProviderKeys = (
  entry: Record<string, unknown>
): Set<string> => {
  const values = Array.isArray(entry['step2'])
    ? entry['step2']
    : entry['step2'] === undefined
      ? []
      : [entry['step2']]

  const keys = new Set<string>()
  for (const value of values) {
    if (!isRecord(value) || typeof value['ocrService'] !== 'string' || typeof value['ocrModel'] !== 'string') {
      continue
    }
    keys.add(`${value['ocrService']}:${value['ocrModel']}`)
  }

  return keys
}

export const inferStoredCompletionStatus = (
  entry: Record<string, unknown>,
  requestedTargets: OcrTarget[]
): OcrCompletionStatus => {
  if (entry['completionStatus'] === 'full' || entry['completionStatus'] === 'incomplete' || entry['completionStatus'] === 'failed') {
    return entry['completionStatus']
  }

  const successCount = parseSuccessfulProviderKeys(entry).size
  if (successCount === 0) {
    return 'failed'
  }
  return successCount === requestedTargets.length ? 'full' : 'incomplete'
}

export const buildMissingTargetsFromEntry = (
  entry: Record<string, unknown>,
  requestedTargets: OcrTarget[]
): OcrTarget[] => {
  const explicitMissing = Array.isArray(entry['missingProviders'])
    ? entry['missingProviders'].map(parseStoredRequestedTarget).filter((target): target is OcrTarget => target !== undefined)
    : []

  if (explicitMissing.length > 0) {
    return explicitMissing
  }

  const successfulKeys = parseSuccessfulProviderKeys(entry)
  return requestedTargets.filter((target) => !successfulKeys.has(getOcrTargetKey(target)))
}

export const readExistingOcrRun = async (
  outputDir: string,
  requestedTargets: OcrTarget[]
): Promise<ExistingOcrRun> => {
  const providerStates = new Map<string, OcrProviderState>()
  const successes: Array<OcrProviderSuccess | undefined> = new Array(requestedTargets.length)
  const raw = await readOcrRunManifestEntry(outputDir)
  if (!isRecord(raw)) {
    return { successes, providerStates }
  }

  const storedProviderStates = parseStoredProviderStateMap(raw)
  for (const [key, value] of storedProviderStates) {
    providerStates.set(key, value)
  }

  await Promise.all(requestedTargets.map(async (target, index) => {
    const providerDir = join(outputDir, getOcrProviderArtifactDir(target))
    const providerResult = await readProviderResultEntry(providerDir)
    if (!providerResult) {
      return
    }

    const metadata = validateData(ExtractionMetadataSchema, providerResult.metadata, 'stored OCR provider metadata')
    const result = validateData(ExtractionResultSchema, providerResult.result, 'stored OCR result')

    successes[index] = {
      target,
      metadata,
      result,
      relativeDir: getOcrProviderArtifactDir(target)
    }
  }))

  return {
    successes,
    providerStates
  }
}

export const buildProviderStates = (
  requestedTargets: OcrTarget[],
  successes: Array<OcrProviderSuccess | undefined>,
  failuresByIndex: Map<number, OcrProviderFailureSummary>,
  existingStates: Map<string, OcrProviderState>
): OcrProviderState[] =>
  requestedTargets.map((target, index) => {
    const key = getOcrTargetKey(target)
    const existing = existingStates.get(key)
    const success = successes[index]
    const failure = failuresByIndex.get(index)

    if (success) {
      return {
        service: target.service,
        model: target.model,
        artifactDir: getOcrProviderArtifactDir(target),
        status: 'succeeded',
        attempts: existing?.attempts ?? 1
      }
    }

    if (failure) {
      return {
        service: target.service,
        model: target.model,
        artifactDir: getOcrProviderArtifactDir(target),
        status: 'failed',
        attempts: (existing?.attempts ?? 0) + 1,
        retryable: failure.retryable === true,
        lastError: {
          message: failure.message,
          retryable: failure.retryable === true
        }
      }
    }

    return {
      service: target.service,
      model: target.model,
      artifactDir: getOcrProviderArtifactDir(target),
      status: existing?.status ?? 'missing',
      attempts: existing?.attempts ?? 0,
      ...(existing?.retryable !== undefined ? { retryable: existing.retryable } : {}),
      ...(existing?.lastError ? { lastError: existing.lastError } : {})
    }
  })

export const resolveCompletionStatus = (
  requestedTargets: OcrTarget[],
  successes: Array<OcrProviderSuccess | undefined>
): OcrCompletionStatus => {
  const successCount = successes.filter((entry) => entry !== undefined).length
  if (successCount === 0) {
    return 'failed'
  }

  return successCount === requestedTargets.length ? 'full' : 'incomplete'
}

export const buildMissingProviders = (
  providerStates: OcrProviderState[],
  requestedTargets: OcrTarget[]
): OcrRequestedProvider[] => {
  const missingKeys = new Set(
    providerStates
      .filter((state) => state.status !== 'succeeded')
      .map((state) => getOcrTargetKey(state))
  )

  return requestedTargets
    .filter((target) => missingKeys.has(getOcrTargetKey(target)))
    .map(toRequestedProvider)
}

export const buildMetadataErrorEntries = (
  providerStates: OcrProviderState[]
): Array<Record<string, unknown>> =>
  providerStates
    .filter((state) => state.lastError !== undefined)
    .map((state) => ({
      service: state.service,
      model: state.model,
      message: state.lastError?.message,
      retryable: state.lastError?.retryable === true
    }))

export const pickPrimarySuccess = (
  requestedTargets: OcrTarget[],
  successes: Array<OcrProviderSuccess | undefined>
): OcrProviderSuccess | undefined => {
  for (const target of requestedTargets) {
    const match = successes.find((entry) => entry?.target.service === target.service && entry?.target.model === target.model)
    if (match) {
      return match
    }
  }

  return undefined
}
