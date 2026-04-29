import { join } from 'node:path'
import {
  ExtractionMetadataSchema,
  ExtractionResultSchema,
  type RetryClass,
  type OcrTarget
} from '~/types'
import { validateData } from '~/utils/validate/validation'
import { classifyFetchRetry } from '~/utils/retries'
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
  retryable?: unknown
  retryClass?: unknown
}

const CONTENT_POLICY_PATTERN = /content (?:filter|filtering|policy)|blocked by content|safety|policy violation|invalid_request_error/i
const TRANSIENT_MESSAGE_PATTERN = /timed out|timeout|temporar(?:y|ily)|network|connection|socket|ECONNRESET|ETIMEDOUT|EAI_AGAIN|ENOTFOUND|rate limit|too many requests/i
const LEGACY_PADDLE_LOG_ONLY_FAILURE_PATTERN = /Checking connectivity to the model hosters|Creating model:|Model files already exist|Resized image size/i
const PADDLE_NATIVE_CRASH_PATTERN = /PaddleOCR .*exited with code \d+ \((?:SIGBUS|SIGKILL|SIGSEGV)\)|PaddleOCR failed .*after attempts: .*?(?:SIGBUS|SIGKILL|SIGSEGV)/i
const LOCAL_ERROR_PATTERN = /Traceback|Exception|Error:|No such file|not found|failed/i
const ANSI_PATTERN = /\x1B(?:[@-Z\\-_]|\[[0-?]*[ -/]*[@-~])/g
const RETRY_CLASSES = new Set<RetryClass>([
  'setup_download',
  'runtime_subprocess_transient',
  'runtime_http_read',
  'runtime_http_create_conservative',
  'runtime_poll_loop'
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
  return stripAnsi(deepest.message || outer.message)
}

export const stripAnsi = (value: string): string => value.replace(ANSI_PATTERN, '')

export const classifyOcrProviderFailure = (
  error: unknown
): OcrProviderFailureSummary => {
  const chain = collectErrorChain(error)
  const message = resolveFailureMessage(chain, error)
  const explicitRetryableValue = chain.find((entry) => typeof entry.retryable === 'boolean')?.retryable
  const explicitRetryable = typeof explicitRetryableValue === 'boolean'
    ? explicitRetryableValue
    : undefined
  const retryClass = chain.find((entry) => typeof entry.retryClass === 'string')?.retryClass
  const status = chain.find((entry) => typeof entry.status === 'number')?.status
  const headers = chain.find((entry) => entry.headers instanceof Headers)?.headers

  let retryable = false
  if (explicitRetryable !== undefined) {
    retryable = explicitRetryable
  } else if (CONTENT_POLICY_PATTERN.test(message)) {
    retryable = false
  } else if (PADDLE_NATIVE_CRASH_PATTERN.test(message)) {
    retryable = true
  } else if (LEGACY_PADDLE_LOG_ONLY_FAILURE_PATTERN.test(message) && !LOCAL_ERROR_PATTERN.test(message)) {
    retryable = true
  } else if (typeof status === 'number' || retryClass) {
    const normalizedRetryClass = typeof retryClass === 'string' && RETRY_CLASSES.has(retryClass as RetryClass)
      ? retryClass as RetryClass
      : 'runtime_http_read'
    retryable = classifyFetchRetry(
      Object.assign(new Error(message), {
        ...(typeof status === 'number' ? { status } : {}),
        ...(headers instanceof Headers ? { headers } : {})
      }),
      normalizedRetryClass,
      { retryAbortOnConservative: true }
    ).shouldRetry
  } else if (TRANSIENT_MESSAGE_PATTERN.test(message)) {
    retryable = true
  }

  return { message, retryable }
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
    && value['service'] !== 'openai'
    && value['service'] !== 'anthropic'
    && value['service'] !== 'gemini'
    && value['service'] !== 'deepinfra'
    && value['service'] !== 'aws-textract'
    && value['service'] !== 'gcloud-docai'
    && value['service'] !== 'deapi'
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
    const providerStates = parseStoredProviderStateMap(entry)
    return explicitMissing.filter((target) => {
      const state = providerStates.get(getOcrTargetKey(target))
      return isResumableProviderState(state)
    })
  }

  const successfulKeys = parseSuccessfulProviderKeys(entry)
  const providerStates = parseStoredProviderStateMap(entry)
  return requestedTargets.filter((target) => {
    const key = getOcrTargetKey(target)
    if (successfulKeys.has(key)) {
      return false
    }

    const state = providerStates.get(key)
    return isResumableProviderState(state)
  })
}

const isResumableProviderState = (
  state: OcrProviderState | undefined
): boolean => {
  if (state === undefined || state.status === 'missing') {
    return true
  }
  if (state.status !== 'failed') {
    return false
  }
  if (state.retryable === true || state.lastError?.retryable === true) {
    return true
  }
  const message = state.lastError?.message ?? ''
  return state.service === 'paddle-ocr'
    && LEGACY_PADDLE_LOG_ONLY_FAILURE_PATTERN.test(message)
    && !LOCAL_ERROR_PATTERN.test(message)
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
      .filter(isResumableProviderState)
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
