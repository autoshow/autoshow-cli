import {
  HOSTED_URL_ARTICLE_BACKENDS,
  URL_ARTICLE_BACKENDS
} from '~/cli/commands/process-steps/step-2-extract/step-2-url/url-provider-registry'
import {
  DEFAULT_URL_REQUEST_ATTEMPTS,
  DEFAULT_URL_REQUEST_TIMEOUT_MS
} from '~/cli/commands/process-steps/step-2-extract/step-2-url/url-utils'
import { CLIUsageError } from '~/utils/error-handler'
import { readEnv } from '~/utils/validate/env-utils'
import type { RuntimeOptions } from '~/types'
import {
  parseUrlBackend,
  readOptionalStringFlag
} from '../options/flag-readers'

export const HOSTED_URL_ARTICLE_BACKEND_CONCURRENCY_TARGET = Math.min(4, HOSTED_URL_ARTICLE_BACKENDS.length)

const parsePositiveInteger = (
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
  envName: string,
  fallback: number
): number => {
  const flagValue = readOptionalStringFlag(flags, flagName)
  const envValue = readEnv(envName)
  return parsePositiveInteger(flagValue, `--${flagName}`)
    ?? parsePositiveInteger(envValue, envName)
    ?? fallback
}

export const resolveUrlOptions = (
  flags: Record<string, unknown>,
  allUrlSelected: boolean
): Pick<RuntimeOptions, 'urlBackend' | 'urlBackendExplicit' | 'urlBackends' | 'urlRequestTimeoutMs' | 'urlRequestAttempts'> => {
  const urlBackendFlag = readOptionalStringFlag(flags, 'url-backend')
  const urlBackendEnv = readEnv('AUTOSHOW_URL_BACKEND')
  if (allUrlSelected && (urlBackendFlag !== undefined || urlBackendEnv !== undefined)) {
    throw CLIUsageError('Cannot use --all-url with --url-backend')
  }

  return {
    urlBackend: parseUrlBackend(urlBackendFlag ?? urlBackendEnv),
    urlBackendExplicit: urlBackendFlag !== undefined || urlBackendEnv !== undefined,
    urlBackends: allUrlSelected ? [...URL_ARTICLE_BACKENDS] : undefined,
    urlRequestTimeoutMs: readPositiveIntegerOption(
      flags,
      'url-request-timeout-ms',
      'AUTOSHOW_URL_REQUEST_TIMEOUT_MS',
      DEFAULT_URL_REQUEST_TIMEOUT_MS
    ),
    urlRequestAttempts: readPositiveIntegerOption(
      flags,
      'url-request-attempts',
      'AUTOSHOW_URL_REQUEST_ATTEMPTS',
      DEFAULT_URL_REQUEST_ATTEMPTS
    ),
  }
}
