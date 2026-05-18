import { join } from 'node:path'
import {
  ExtractionMetadataSchema,
  ExtractionResultSchema,
  type ExtractionMetadata,
  type ExtractionResult,
  type OcrProviderFailureCategory,
  type OcrTarget
} from '~/types'
import { validateData } from '~/utils/validate/validation'
import { getOcrTargetDirectoryName } from './ocr-targets'
import { readOcrRunManifestEntry } from './manifest'
import { readProviderResultEntry } from '../../manifest-utils'
import type {
  ExistingOcrRun,
  OcrCompletionStatus,
  OcrProviderFailureSummary,
  OcrProviderState,
  OcrProviderSuccess,
  OcrRecordedProviderError,
  OcrRequestedProvider
} from '~/types'

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

type ProviderErrorLike = Error & {
  cause?: unknown
  status?: unknown
  headers?: unknown
  category?: unknown
  stage?: unknown
}

const CONTENT_POLICY_PATTERN = /content (?:filter|filtering|policy)|blocked by content|safety|policy violation|invalid_request_error/i
const STRUCTURED_VALIDATION_PATTERN = /not valid json|malformed json|schema|expected page schema|returned \d+ pages|non-contiguous page numbers|returned no pages|returned no text output/i
const PDF_CHUNK_RENDER_PATTERN = /pdf chunk creation failed|mutool convert failed|stage=pdf_chunk_render/i
const AUTH_MESSAGE_PATTERN = /(?:api key|environment variable is required|auth(?:entication|orization)?|unauthori[sz]ed|forbidden|invalid api key|permission denied|access denied|credential|not configured)/i
const RATE_LIMIT_MESSAGE_PATTERN = /rate limit|too many requests|\b429\b/i
const TIMEOUT_MESSAGE_PATTERN = /timed out|timeout|deadline exceeded|abort\/timeout/i
const NETWORK_MESSAGE_PATTERN = /network|connection|socket|ECONNRESET|ECONNREFUSED|ETIMEDOUT|EAI_AGAIN|ENOTFOUND|fetch failed|unavailable|overloaded/i
const PROVIDER_LIMIT_MESSAGE_PATTERN = /exceeds|too large|supports .* up to|file upload limit|page(?:s)? .*limit|maximum|payload too large|\b413\b|split .*smaller chunks?|image input exceeds/i
const ANSI_PATTERN = /\x1B(?:[@-Z\\-_]|\[[0-?]*[ -/]*[@-~])/g
const OCR_PROVIDER_FAILURE_CATEGORIES = new Set<OcrProviderFailureCategory>([
  'structured_response',
  'pdf_chunk_render',
  'timeout',
  'network',
  'auth',
  'rate_limit',
  'content_policy',
  'provider_limit',
  'unknown'
])

const isProviderErrorLike = (value: unknown): value is ProviderErrorLike =>
  value instanceof Error

const collectErrorChain = (error: unknown): ProviderErrorLike[] => {
  const chain: ProviderErrorLike[] = []
  const seen = new Set<unknown>()
  let current: unknown = error

  while (isProviderErrorLike(current) && !seen.has(current)) {
    chain.push(current)
    seen.add(current)
    current = current.cause
  }

  return chain
}

const resolveFailureMessage = (
  chain: ProviderErrorLike[],
  error: unknown
): string => {
  if (chain.length === 0) {
    return stripAnsi(error instanceof Error ? error.message : String(error))
  }

  const outer = chain[0] as ProviderErrorLike
  const deepest = chain[chain.length - 1] as ProviderErrorLike
  if (deepest.name === 'AbortError' || deepest.name === 'TimeoutError') {
    const timeoutMessage = deepest.message || 'request timed out'
    return stripAnsi(outer.message ? `${outer.message}: ${timeoutMessage}` : timeoutMessage)
  }
  return stripAnsi(deepest.message || outer.message)
}

const resolveFailureCategory = (
  chain: ProviderErrorLike[],
  message: string,
  status: number | undefined
): OcrProviderFailureCategory => {
  const explicitCategory = chain.find((entry) =>
    typeof entry.category === 'string'
    && OCR_PROVIDER_FAILURE_CATEGORIES.has(entry.category as OcrProviderFailureCategory)
  )?.category
  if (typeof explicitCategory === 'string') {
    return explicitCategory as OcrProviderFailureCategory
  }

  if (chain.some((entry) => entry.stage === 'pdf_chunk_render') || PDF_CHUNK_RENDER_PATTERN.test(message)) {
    return 'pdf_chunk_render'
  }
  if (CONTENT_POLICY_PATTERN.test(message)) {
    return 'content_policy'
  }
  if (status === 401 || status === 403 || AUTH_MESSAGE_PATTERN.test(message)) {
    return 'auth'
  }
  if (status === 429 || RATE_LIMIT_MESSAGE_PATTERN.test(message)) {
    return 'rate_limit'
  }
  if (status === 413 || PROVIDER_LIMIT_MESSAGE_PATTERN.test(message)) {
    return 'provider_limit'
  }
  if (STRUCTURED_VALIDATION_PATTERN.test(message)) {
    return 'structured_response'
  }
  if (TIMEOUT_MESSAGE_PATTERN.test(message)) {
    return 'timeout'
  }
  if (NETWORK_MESSAGE_PATTERN.test(message) || (typeof status === 'number' && status >= 500)) {
    return 'network'
  }
  return 'unknown'
}

export const stripAnsi = (value: string): string => value.replace(ANSI_PATTERN, '')

export const classifyOcrProviderFailure = (
  error: unknown
): OcrProviderFailureSummary => {
  const chain = collectErrorChain(error)
  const message = resolveFailureMessage(chain, error)
  const status = chain.find((entry) => typeof entry.status === 'number')?.status as number | undefined
  const category = resolveFailureCategory(chain, message, status)

  return { message, category }
}

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
    && value['service'] !== 'kimi'
    && value['service'] !== 'openai'
    && value['service'] !== 'anthropic'
    && value['service'] !== 'gemini'
    && value['service'] !== 'deepinfra'
    && value['service'] !== 'aws-textract'
    && value['service'] !== 'gcloud-docai'
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
        ...(typeof value['lastError']['category'] === 'string' ? { category: value['lastError']['category'] as OcrProviderFailureCategory } : {}),
        ...(typeof value['lastError']['errorFile'] === 'string' ? { errorFile: value['lastError']['errorFile'] } : {})
      } satisfies OcrRecordedProviderError
    : undefined

  return {
    service: target.service,
    model: target.model,
    artifactDir: value['artifactDir'],
    status: value['status'],
    attempts: value['attempts'],
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

const metadataMatchesTarget = (
  metadata: ExtractionMetadata,
  target: OcrTarget
): boolean => {
  if (metadata.ocrService === target.service && metadata.ocrModel === target.model) {
    return true
  }

  if (target.service === 'tesseract') {
    return metadata.extractionMethod.includes('tesseract')
  }
  if (target.service === 'ocrmypdf') {
    return metadata.extractionMethod.includes('ocrmypdf')
  }
  if (target.service === 'paddle-ocr') {
    return metadata.extractionMethod.includes('paddle-ocr')
  }

  return false
}

const parseRootExtractionMetadata = (
  entry: Record<string, unknown>,
  target: OcrTarget
): ExtractionMetadata | undefined => {
  const values = Array.isArray(entry['step2'])
    ? entry['step2']
    : entry['step2'] === undefined
      ? []
      : [entry['step2']]

  for (const value of values) {
    try {
      const metadata = validateData(ExtractionMetadataSchema, value, 'stored OCR metadata')
      if (metadataMatchesTarget(metadata, target)) {
        return metadata
      }
    } catch {
      continue
    }
  }

  return undefined
}

const readRootExtractionResult = async (
  outputDir: string,
  metadata: ExtractionMetadata
): Promise<ExtractionResult | undefined> => {
  const resultPath = join(outputDir, 'result.json')
  if (await Bun.file(resultPath).exists()) {
    try {
      return validateData(ExtractionResultSchema, await Bun.file(resultPath).json(), 'stored OCR result')
    } catch {
      // Fall back to extraction.txt for text-only single-provider outputs.
    }
  }

  const textPath = join(outputDir, 'extraction.txt')
  const text = await Bun.file(textPath).text().catch(() => undefined)
  if (text === undefined) {
    return undefined
  }

  return {
    text,
    pages: [],
    totalPages: metadata.totalPages,
    ocrPages: metadata.ocrPages,
    textPages: metadata.textPages
  }
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
  const missingTargets = new Map<string, OcrTarget>()
  const providerStates = parseStoredProviderStateMap(entry)

  for (const target of explicitMissing) {
    const state = providerStates.get(getOcrTargetKey(target))
    if (isRerunnableProviderState(state)) {
      missingTargets.set(getOcrTargetKey(target), target)
    }
  }

  const successfulKeys = parseSuccessfulProviderKeys(entry)
  for (const target of requestedTargets) {
    const key = getOcrTargetKey(target)
    if (successfulKeys.has(key)) {
      continue
    }

    const state = providerStates.get(key)
    if (isRerunnableProviderState(state)) {
      missingTargets.set(key, target)
    }
  }

  return [...missingTargets.values()]
}

const isRerunnableProviderState = (
  state: OcrProviderState | undefined
): boolean => {
  if (state === undefined || state.status === 'missing' || state.status === 'failed') {
    return true
  }
  return false
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
    const key = getOcrTargetKey(target)
    const providerDir = join(outputDir, getOcrProviderArtifactDir(target))
    const providerResult = await readProviderResultEntry(providerDir)
    if (!providerResult) {
      if (storedProviderStates.get(key)?.artifactDir === '.') {
        const metadata = parseRootExtractionMetadata(raw, target)
        if (!metadata) {
          return
        }
        const result = await readRootExtractionResult(outputDir, metadata)
        if (!result) {
          return
        }
        successes[index] = {
          target,
          metadata,
          result,
          relativeDir: '.'
        }
      }
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
        lastError: {
          message: failure.message,
          category: failure.category,
          ...(failure.errorFile ? { errorFile: failure.errorFile } : {})
        }
      }
    }

    return {
      service: target.service,
      model: target.model,
      artifactDir: getOcrProviderArtifactDir(target),
      status: existing?.status ?? 'missing',
      attempts: existing?.attempts ?? 0,
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
      .filter(isRerunnableProviderState)
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
      category: state.lastError?.category,
      ...(state.lastError?.errorFile ? { errorFile: state.lastError.errorFile } : {})
    }))
