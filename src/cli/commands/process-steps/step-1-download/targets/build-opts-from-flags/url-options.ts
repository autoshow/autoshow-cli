import {
  HOSTED_URL_ARTICLE_BACKENDS,
  URL_ARTICLE_BACKENDS
} from '~/cli/commands/process-steps/step-2-extract/step-2-url/url-provider-registry'
import {
  DEFAULT_URL_REQUEST_ATTEMPTS,
  DEFAULT_URL_REQUEST_TIMEOUT_MS
} from '~/cli/commands/process-steps/step-2-extract/step-2-url/url-utils'
import { CLIUsageError } from '~/utils/error-handler'
import type { RuntimeOptions } from '~/types'
import {
  parseUrlBackend,
  readOptionalStringFlag
} from '../options/flag-readers'

export const HOSTED_URL_ARTICLE_BACKEND_CONCURRENCY_TARGET = Math.min(4, HOSTED_URL_ARTICLE_BACKENDS.length)

const parsePositiveIntegerFlag = (
  value: string | undefined,
  label: string
): number | undefined => {
  if (value === undefined) {
    return undefined
  }

  if (!/^\d+$/.test(value)) {
    throw CLIUsageError(`Invalid ${label} value "${value}". Expected a positive integer.`)
  }

  const parsed = Number.parseInt(value, 10)
  if (!Number.isFinite(parsed) || parsed < 1) {
    throw CLIUsageError(`Invalid ${label} value "${value}". Expected a positive integer.`)
  }

  return parsed
}

const readPositiveIntegerOption = (
  flags: Record<string, unknown>,
  flagName: string,
  fallback: number
): number => {
  const flagValue = readOptionalStringFlag(flags, flagName)
  return parsePositiveIntegerFlag(flagValue, `--${flagName}`)
    ?? fallback
}

export const resolveUrlOptions = (
  flags: Record<string, unknown>,
  allUrlSelected: boolean
): Pick<RuntimeOptions, 'urlBackend' | 'urlBackendExplicit' | 'urlBackends' | 'urlRequestTimeoutMs' | 'urlRequestAttempts'> => {
  const publicUrlBackendFlag = readOptionalStringFlag(flags, 'url-provider')
  const legacyUrlBackendFlag = readOptionalStringFlag(flags, 'url-backend')
  const urlBackendFlag = publicUrlBackendFlag ?? legacyUrlBackendFlag
  if (allUrlSelected && urlBackendFlag !== undefined) {
    throw CLIUsageError('Cannot use --all-providers url with --url-provider')
  }

  return {
    urlBackend: parseUrlBackend(urlBackendFlag, publicUrlBackendFlag !== undefined ? 'url-provider' : 'url-backend'),
    urlBackendExplicit: urlBackendFlag !== undefined,
    urlBackends: allUrlSelected ? [...URL_ARTICLE_BACKENDS] : undefined,
    urlRequestTimeoutMs: readPositiveIntegerOption(
      flags,
      'url-request-timeout-ms',
      DEFAULT_URL_REQUEST_TIMEOUT_MS
    ),
    urlRequestAttempts: readPositiveIntegerOption(
      flags,
      'url-request-attempts',
      DEFAULT_URL_REQUEST_ATTEMPTS
    ),
  }
}
