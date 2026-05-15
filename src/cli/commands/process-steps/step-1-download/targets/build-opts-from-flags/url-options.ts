import {
  HOSTED_URL_ARTICLE_BACKENDS,
  URL_ARTICLE_BACKENDS
} from '~/cli/commands/process-steps/step-2-extract/step-2-url/url-provider-registry'
import { CLIUsageError } from '~/utils/error-handler'
import { readEnv } from '~/utils/validate/env-utils'
import type { RuntimeOptions } from '~/types'
import {
  parseUrlBackend,
  readOptionalStringFlag
} from '../options/flag-readers'

export const HOSTED_URL_ARTICLE_BACKEND_CONCURRENCY_TARGET = Math.min(4, HOSTED_URL_ARTICLE_BACKENDS.length)

export const resolveUrlOptions = (
  flags: Record<string, unknown>,
  allUrlSelected: boolean
): Pick<RuntimeOptions, 'urlBackend' | 'urlBackendExplicit' | 'urlBackends'> => {
  const urlBackendFlag = readOptionalStringFlag(flags, 'url-backend')
  const urlBackendEnv = readEnv('AUTOSHOW_URL_BACKEND')
  if (allUrlSelected && (urlBackendFlag !== undefined || urlBackendEnv !== undefined)) {
    throw CLIUsageError('Cannot use --all-url with --url-backend')
  }

  return {
    urlBackend: parseUrlBackend(urlBackendFlag ?? urlBackendEnv),
    urlBackendExplicit: urlBackendFlag !== undefined || urlBackendEnv !== undefined,
    urlBackends: allUrlSelected ? [...URL_ARTICLE_BACKENDS] : undefined,
  }
}
