import type { LogContext, LogMetadata } from '~/logger/types'

const REDACTED = 'REDACTED'

const SENSITIVE_FLAG_NAMES = new Set<string>([
  'password',
  'token',
  'api-key',
  'api_key',
  'apikey',
  'authorization',
  'auth',
  'secret',
  'hf-token',
  'openai-api-key',
  'anthropic-api-key',
  'gemini-api-key',
  'groq-api-key',
  'mistral-api-key',
  'assemblyai-api-key',
  'gladia-api-key',
  'elevenlabs-api-key',
  'minimax-api-key'
])

const SHORT_SENSITIVE_FLAGS = new Set<string>(['-p'])

const TOKEN_LIKE_KEY_PATTERN = /(?:token|api[_-]?key|authorization|auth|secret|password)/i

const sanitizeHeaderAuthorization = (value: string): string => {
  return value
    .replace(/(authorization[:=]\s*(?:bearer|basic)\s+)([^\s"'`]+)/gi, '$1REDACTED')
    .replace(/(--header(?:=|\s+)(?:'|")?authorization:\s*(?:bearer|basic)\s+)([^\s"'`]+)/gi, '$1REDACTED')
    .replace(/("authorization"\s*:\s*"(?:bearer|basic)\s+)([^"]+)/gi, '$1REDACTED')
}

const sanitizeUrlCredentials = (value: string): string => {
  return value
    .replace(/(https?:\/\/[^\/\s:@]+:)([^@\/\s]+)@/gi, '$1REDACTED@')
    .replace(/(oauth2:)([^@\/\s]+)@/gi, '$1REDACTED@')
}

const sanitizeQuerySecrets = (value: string): string => {
  return value.replace(/([?&](?:token|access_token|auth|authorization|api_key|apikey|key|password|secret)=)([^&\s]+)/gi, '$1REDACTED')
}

const sanitizeEnvAssignments = (value: string): string => {
  return value
    .replace(/\b([A-Z0-9_]*(?:TOKEN|API_KEY|SECRET|PASSWORD)[A-Z0-9_]*=)([^\s]+)/g, '$1REDACTED')
    .replace(/\bhf_[A-Za-z0-9]{20,}\b/g, 'hf_REDACTED')
    .replace(/\bsk-[A-Za-z0-9_-]{16,}\b/g, 'sk-REDACTED')
}

export const sanitizeLogText = (value: string): string => {
  if (value.length === 0) {
    return value
  }

  return sanitizeEnvAssignments(
    sanitizeQuerySecrets(
      sanitizeUrlCredentials(
        sanitizeHeaderAuthorization(value)
      )
    )
  )
}

const normalizeFlagName = (flagName: string): string => {
  return flagName.replace(/^--?/, '').toLowerCase()
}

const isSensitiveFlag = (flagToken: string): boolean => {
  if (SHORT_SENSITIVE_FLAGS.has(flagToken)) {
    return true
  }

  if (!flagToken.startsWith('--')) {
    return false
  }

  const eqIndex = flagToken.indexOf('=')
  const rawName = eqIndex === -1 ? flagToken : flagToken.slice(0, eqIndex)
  const normalized = normalizeFlagName(rawName)

  return SENSITIVE_FLAG_NAMES.has(normalized) || TOKEN_LIKE_KEY_PATTERN.test(normalized)
}

const sanitizeArgToken = (token: string): string => {
  if (token.length === 0) {
    return token
  }

  if (token.startsWith('--') && token.includes('=')) {
    const eqIndex = token.indexOf('=')
    const flag = token.slice(0, eqIndex)
    const value = token.slice(eqIndex + 1)
    if (isSensitiveFlag(flag)) {
      return `${flag}=${REDACTED}`
    }
    return `${flag}=${sanitizeLogText(value)}`
  }

  return sanitizeLogText(token)
}

export const redactCliArgv = (argv: readonly string[]): string[] => {
  const redacted = argv.map(token => sanitizeArgToken(token))

  for (let i = 0; i < redacted.length; i++) {
    const token = redacted[i] as string

    if (!isSensitiveFlag(token)) {
      continue
    }

    if (token.startsWith('--') && token.includes('=')) {
      continue
    }

    const next = redacted[i + 1]
    if (next !== undefined) {
      redacted[i + 1] = REDACTED
      i += 1
    }
  }

  return redacted
}

const sanitizeUnknown = (value: unknown, depth: number, seen: WeakSet<object>): unknown => {
  if (typeof value === 'string') {
    return sanitizeLogText(value)
  }

  if (
    typeof value === 'number'
    || typeof value === 'boolean'
    || value === null
    || value === undefined
    || typeof value === 'bigint'
  ) {
    return value
  }

  if (depth > 5) {
    return '[Truncated]'
  }

  if (value instanceof Date) {
    return value.toISOString()
  }

  if (value instanceof URL) {
    return sanitizeLogText(value.toString())
  }

  if (value instanceof Error) {
    return {
      name: value.name,
      message: sanitizeLogText(value.message),
      ...(value.stack ? { stack: sanitizeLogText(value.stack) } : {})
    }
  }

  if (Array.isArray(value)) {
    return value.map(item => sanitizeUnknown(item, depth + 1, seen))
  }

  if (typeof value === 'object') {
    const objectValue = value as Record<string, unknown>
    if (seen.has(objectValue)) {
      return '[Circular]'
    }
    seen.add(objectValue)

    const entries = Object.entries(objectValue)
    const out: Record<string, unknown> = {}
    for (const [key, entryValue] of entries) {
      out[key] = sanitizeUnknown(entryValue, depth + 1, seen)
    }

    return out
  }

  return sanitizeLogText(String(value))
}

export const sanitizeLogValue = (value: unknown): unknown => {
  return sanitizeUnknown(value, 0, new WeakSet<object>())
}

export const sanitizeLogArgs = (args: readonly unknown[]): readonly unknown[] => {
  return args.map(arg => sanitizeLogValue(arg))
}

export const sanitizeLogContext = (context: LogContext): LogContext => {
  const sanitized: Record<string, string | number | boolean | null | undefined> = {}

  for (const [key, value] of Object.entries(context)) {
    if (typeof value === 'string') {
      sanitized[key] = sanitizeLogText(value)
      continue
    }

    sanitized[key] = value
  }

  return sanitized
}

export const sanitizeLogMetadata = (metadata: LogMetadata): LogMetadata => {
  const sanitized = sanitizeLogValue(metadata)
  if (sanitized && typeof sanitized === 'object' && !Array.isArray(sanitized)) {
    return sanitized as LogMetadata
  }
  return {}
}
