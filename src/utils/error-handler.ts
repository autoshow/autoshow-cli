import { isNativeUsageError, nativeUsageMessage } from '~/cli/native/errors'
import { sanitizeLogMetadata, sanitizeLogText } from '~/utils/logger/redaction'
import type { RetryClass } from '~/types'

export type AppErrorKind =
  | 'usage'
  | 'provider_http'
  | 'retry_exhausted'
  | 'validation'
  | 'infrastructure'

export type AppErrorOptions = {
  kind: AppErrorKind
  hints?: string[]
  exitCode?: number
  cause?: Error
  status?: number
  stage?: string
  retryClass?: RetryClass
  retryable?: boolean
  metadata?: Record<string, unknown>
}

const DEFAULT_EXIT_CODE_BY_KIND: Readonly<Record<AppErrorKind, number>> = {
  usage: 2,
  provider_http: 1,
  retry_exhausted: 1,
  validation: 1,
  infrastructure: 1
}

const normalizePositiveExitCode = (value: unknown): number | undefined =>
  typeof value === 'number' && Number.isFinite(value) && value > 0
    ? Math.floor(value)
    : undefined

export class AppError extends Error {
  readonly kind: AppErrorKind
  readonly hints: string[]
  readonly exitCode: number
  readonly status?: number
  readonly stage?: string
  readonly retryClass?: RetryClass
  readonly retryable?: boolean
  readonly metadata: Record<string, unknown>
  override cause?: Error

  constructor(message: string, options: AppErrorOptions) {
    super(message, options.cause ? { cause: options.cause } : undefined)
    this.name = 'AppError'
    this.kind = options.kind
    this.hints = [...(options.hints ?? [])]
    this.exitCode = normalizePositiveExitCode(options.exitCode) ?? DEFAULT_EXIT_CODE_BY_KIND[options.kind]
    this.metadata = { ...(options.metadata ?? {}) }

    if (options.cause) this.cause = options.cause
    if (typeof options.status === 'number') this.status = options.status
    if (options.stage !== undefined) this.stage = options.stage
    if (options.retryClass !== undefined) this.retryClass = options.retryClass
    if (typeof options.retryable === 'boolean') this.retryable = options.retryable
  }
}

export class AppUsageError extends AppError {
  constructor(message: string, hints?: string[]) {
    super(message, { kind: 'usage', exitCode: 2, ...(hints ? { hints } : {}) })
    this.name = 'CLIUsageError'
  }
}

type CliUsageHintOptions = {
  hint?: string | undefined
  hints?: string[] | undefined
}

const normalizeHints = (hintOrOptions?: string | string[] | CliUsageHintOptions): string[] | undefined => {
  if (hintOrOptions === undefined) {
    return undefined
  }
  if (typeof hintOrOptions === 'string') {
    return [hintOrOptions]
  }
  if (Array.isArray(hintOrOptions)) {
    return hintOrOptions
  }

  const hints = [
    ...(hintOrOptions.hint ? [hintOrOptions.hint] : []),
    ...(hintOrOptions.hints ?? [])
  ]
  return hints.length > 0 ? hints : undefined
}

export const CLIUsageError = (
  message: string,
  hintOrOptions?: string | string[] | CliUsageHintOptions
): Error => new AppUsageError(message, normalizeHints(hintOrOptions))

export const isAppError = (error: unknown): error is AppError =>
  error instanceof AppError

export const isCLIUsageError = (error: unknown): boolean =>
  error instanceof Error && error.name === 'CLIUsageError'

export const isUsageError = (error: unknown): boolean => {
  return (
    isCLIUsageError(error) ||
    isNativeUsageError(error)
  )
}

export const normalizeExitCode = (error: unknown): number => {
  if (isAppError(error)) {
    return error.exitCode
  }

  if (error instanceof Error && 'exitCode' in error) {
    const exitCode = (error as Error & { exitCode?: unknown }).exitCode
    const normalized = normalizePositiveExitCode(exitCode)
    if (normalized !== undefined) {
      return normalized
    }
  }
  return isUsageError(error) ? 2 : 1
}

export const usageMessage = (error: unknown): string => {
  if (isCLIUsageError(error)) {
    return (error as Error).message
  }
  const nativeMessage = nativeUsageMessage(error)
  if (nativeMessage !== undefined) return nativeMessage
  return 'Invalid command usage. Run: bun as --help'
}

export type ErrorChainEntry = Error & Record<string, unknown>

export const collectErrorChain = (error: unknown): ErrorChainEntry[] => {
  const chain: ErrorChainEntry[] = []
  const seen = new Set<unknown>()
  let current: unknown = error

  while (current instanceof Error && !seen.has(current)) {
    chain.push(current as ErrorChainEntry)
    seen.add(current)
    current = current.cause
  }

  return chain
}

const PROVIDER_METADATA_KEYS = [
  'status',
  'stage',
  'retryClass',
  'retryable',
  'category',
  'headers',
  'body',
  'rawResponse',
  'rawResponseFile',
  'errorFile',
  'code',
  'param',
  'type',
  'error',
  'errorType',
  'responseType'
] as const

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const addMetadataValue = (
  out: Record<string, unknown>,
  key: string,
  value: unknown
): void => {
  if (value !== undefined && out[key] === undefined) {
    out[key] = value
  }
}

export const extractErrorMetadata = (error: unknown): Record<string, unknown> => {
  const metadata: Record<string, unknown> = {}

  for (const entry of collectErrorChain(error)) {
    if (isAppError(entry)) {
      for (const [key, value] of Object.entries(entry.metadata)) {
        addMetadataValue(metadata, key, value)
      }
    }

    for (const key of PROVIDER_METADATA_KEYS) {
      addMetadataValue(metadata, key, entry[key])
    }

    for (const [key, value] of Object.entries(entry)) {
      if (
        key === 'name'
        || key === 'message'
        || key === 'stack'
        || key === 'cause'
        || key === 'kind'
        || key === 'hints'
        || key === 'exitCode'
        || key === 'metadata'
      ) {
        continue
      }
      addMetadataValue(metadata, key, value)
    }
  }

  return metadata
}

const LEGACY_ERROR_HINTS: ReadonlyArray<[needle: string, hint: string]> = [
  ['yt-dlp', "Run 'bun as setup' to install yt-dlp and other dependencies"],
  ['Google Cloud CLI is required for Google transcription', "Run 'bun as setup --gcloud' to verify gcloud installation, auth, project, billing, and Speech-to-Text API access"],
  ['Google Cloud CLI auth is required for Google transcription', "Run 'bun as setup --gcloud' to verify gcloud installation, auth, project, billing, and Speech-to-Text API access"],
  ['Google Cloud project is required for Google transcription', "Run 'bun as setup --gcloud' to verify gcloud installation, auth, project, billing, and Speech-to-Text API access"],
  ['Google Cloud billing must be linked', "Run 'bun as setup --gcloud --gcloud-project PROJECT_ID' to create or select a project, link billing, and enable Speech-to-Text"],
  ['Google Cloud Speech-to-Text API must be enabled', "Run 'bun as setup --gcloud' to verify gcloud installation, auth, project, billing, and Speech-to-Text API access"],
  ['AWS CLI is required for AWS transcription', "Run 'bun as setup --aws' to verify AWS CLI installation, auth, region, and Transcribe access"],
  ['AWS CLI credentials are required for AWS transcription', "Run 'bun as setup --aws' to verify AWS CLI installation, auth, region, and Transcribe access"],
  ['AWS region is required for AWS transcription', "Run 'bun as setup --aws' to verify AWS CLI installation, auth, region, and Transcribe access"],
  ['AWS S3 bucket is required for AWS transcription', "Run 'bun as setup --aws --aws-create-bucket' to provision a staging bucket shared by Transcribe and Textract, then pass --aws-region/--aws-bucket or save them with 'bun as config --aws-region ... --aws-bucket ... --aws-stt standard'"],
  ['OPENAI_API_KEY', 'Set OPENAI_API_KEY environment variable to use OpenAI models'],
  ['GEMINI_API_KEY', 'Set GEMINI_API_KEY environment variable to use Gemini models'],
  ['GROQ_API_KEY', 'Set GROQ_API_KEY environment variable to use Groq models'],
  ['GLM_API_KEY', 'Set GLM_API_KEY environment variable to use GLM models'],
  ['DEEPINFRA_API_KEY', 'Set DEEPINFRA_API_KEY environment variable to use DeepInfra transcription'],
  ['UNSTRUCTURED_API_KEY', 'Set UNSTRUCTURED_API_KEY environment variable to use Unstructured OCR'],
  ['DEAPI_API_KEY', 'Set DEAPI_API_KEY environment variable to use deAPI transcription and exact STT pricing'],
  ['ANTHROPIC_API_KEY', 'Set ANTHROPIC_API_KEY environment variable to use Anthropic Claude models'],
  ['MINIMAX_API_KEY', 'Set MINIMAX_API_KEY environment variable to use MiniMax models'],
  ['ELEVENLABS_API_KEY', 'Set ELEVENLABS_API_KEY environment variable to use ElevenLabs transcription/TTS/music'],
  ['SPEECHMATICS_API_KEY', 'Set SPEECHMATICS_API_KEY environment variable to use Speechmatics transcription'],
  ['REVAI_ACCESS_TOKEN', 'Set REVAI_ACCESS_TOKEN environment variable to use Rev transcription'],
  ['GLADIA_API_KEY', 'Set GLADIA_API_KEY environment variable to use Gladia transcription'],
  ['HAPPYSCRIBE_API_KEY', 'Set HAPPYSCRIBE_API_KEY environment variable to use Happy Scribe transcription'],
  ['SUPADATA_API_KEY', 'Set SUPADATA_API_KEY environment variable to use Supadata transcription'],
  ['SCRAPECREATORS_API_KEY', 'Set SCRAPECREATORS_API_KEY environment variable to use ScrapeCreators YouTube transcript retrieval']
]

const keyedHintsFor = (error: unknown, metadata: Record<string, unknown>): string[] => {
  const hints: string[] = []
  const status = typeof metadata['status'] === 'number' ? metadata['status'] : undefined
  const category = typeof metadata['category'] === 'string' ? metadata['category'] : undefined

  if (isAppError(error)) {
    if (error.kind === 'usage') {
      hints.push(...error.hints)
    }
    if (error.kind === 'provider_http' && status === 429) {
      hints.push('The provider rate-limited the request. Retry later or reduce provider concurrency.')
    }
    if (error.kind === 'retry_exhausted') {
      hints.push('Retry attempts were exhausted. Check the provider diagnostics for the final failure.')
    }
  }

  if (status === 401 || status === 403 || category === 'auth') {
    hints.push('Check the provider credentials and setup for the selected service.')
  }
  if (status === 429 || category === 'rate_limit') {
    hints.push('The provider is rate limiting requests. Retry later or lower concurrency.')
  }

  return hints
}

export const extractErrorHints = (error: unknown): string[] => {
  const hints: string[] = []
  const emitted = new Set<string>()
  const addHint = (hint: string | undefined): void => {
    if (hint && !emitted.has(hint)) {
      emitted.add(hint)
      hints.push(hint)
    }
  }

  if (isAppError(error)) {
    for (const hint of error.hints) {
      addHint(hint)
    }
  }

  const metadata = extractErrorMetadata(error)
  for (const hint of keyedHintsFor(error, metadata)) {
    addHint(hint)
  }

  const messages = collectErrorChain(error).map(entry => entry.message)
  if (messages.length === 0 && error !== undefined && error !== null) {
    messages.push(String(error))
  }

  for (const message of messages) {
    for (const [needle, hint] of LEGACY_ERROR_HINTS) {
      if (message.includes(needle)) {
        addHint(hint)
      }
    }
  }

  return hints
}

const toDiagnosticValue = (
  value: unknown,
  depth = 0,
  seen = new WeakSet<object>()
): unknown => {
  if (
    value === null
    || value === undefined
    || typeof value === 'string'
    || typeof value === 'number'
    || typeof value === 'boolean'
  ) {
    return value
  }

  if (typeof value === 'bigint') {
    return value.toString()
  }

  if (depth > 5) {
    return '[Truncated]'
  }

  if (value instanceof Date) {
    return value.toISOString()
  }

  if (value instanceof URL) {
    return value.toString()
  }

  if (value instanceof Headers) {
    return Object.fromEntries(value.entries())
  }

  if (value instanceof Error) {
    return serializeError(value, depth, seen)
  }

  if (Array.isArray(value)) {
    return value.map(item => toDiagnosticValue(item, depth + 1, seen))
  }

  if (typeof value === 'object') {
    if (seen.has(value)) {
      return '[Circular]'
    }
    seen.add(value)
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, entry]) => [
        key,
        toDiagnosticValue(entry, depth + 1, seen)
      ])
    )
  }

  return String(value)
}

const serializeError = (
  error: Error,
  depth = 0,
  seen = new WeakSet<object>()
): Record<string, unknown> => {
  if (seen.has(error)) {
    return { name: error.name, message: '[Circular]' }
  }
  seen.add(error)

  const out: Record<string, unknown> = {
    name: error.name,
    message: error.message
  }

  if (error.stack) {
    out['stack'] = error.stack
  }

  if (isRecord(error)) {
    for (const [key, value] of Object.entries(error)) {
      if (key === 'name' || key === 'message' || key === 'stack' || key === 'cause') {
        continue
      }
      out[key] = toDiagnosticValue(value, depth + 1, seen)
    }
  }

  if ('cause' in error && error.cause !== undefined) {
    out['cause'] = toDiagnosticValue(error.cause, depth + 1, seen)
  }

  return out
}

export const serializeDiagnosticError = (error: unknown): Record<string, unknown> => {
  const raw = error instanceof Error
    ? serializeError(error)
    : toDiagnosticValue(error)
  const normalized = isRecord(raw) ? raw : { value: raw }
  const sanitized = sanitizeLogMetadata(normalized)
  return isRecord(sanitized)
    ? sanitized
    : { value: sanitizeLogText(String(sanitized)) }
}
