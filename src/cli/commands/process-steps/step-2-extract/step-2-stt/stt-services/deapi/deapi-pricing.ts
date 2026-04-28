import * as l from '~/utils/logger'
import { computeBilledSttCost } from '~/utils/pricing/stt-billing'
import { classifyFetchRetry, withRetry } from '~/utils/retries'
import { readEnv } from '~/utils/validate/env-utils'
import { getDeapiBaseUrl, isDeapiSupportedSourceUrl } from './deapi'
import { buildDeapiUrl, extractDeapiErrorMessage, extractPriceUsd, readJsonOrText } from '~/utils/deapi'
import type { DeapiQuoteError, DeapiQuoteMode, DeapiResolvedPrice } from '~/types'

const REQUEST_TIMEOUT_MS = 60_000

const buildFallbackWarning = (
  mode: DeapiQuoteMode,
  error: unknown
): string => {
  const reason = error instanceof Error ? error.message : String(error)
  return `deAPI exact STT pricing failed for ${mode} mode; using local registry fallback (${reason}).`
}

const resolveRegistryFallbackCost = (
  model: string,
  durationSeconds: number
): number => computeBilledSttCost('deapi', model, durationSeconds).cost

export const resolveDeapiTranscriptionPrice = async (
  options: {
    model: string
    sourceUrl?: string | undefined
    durationSeconds?: number | undefined
  }
): Promise<DeapiResolvedPrice> => {
  const mode: DeapiQuoteMode = isDeapiSupportedSourceUrl(options.sourceUrl) ? 'url' : 'duration'
  const durationSeconds = typeof options.durationSeconds === 'number' && Number.isFinite(options.durationSeconds)
    ? Math.max(0, options.durationSeconds)
    : undefined

  const fallback = (error: unknown): DeapiResolvedPrice => {
    if (durationSeconds === undefined) {
      throw error
    }

    return {
      totalCost: resolveRegistryFallbackCost(options.model, durationSeconds),
      source: 'registry_fallback',
      mode,
      estimateType: 'heuristic',
      warning: buildFallbackWarning(mode, error)
    }
  }

  const apiKey = readEnv('DEAPI_API_KEY')
  if (!apiKey) {
    return fallback(new Error('DEAPI_API_KEY environment variable is required for deAPI exact STT pricing'))
  }

  if (mode === 'duration' && durationSeconds === undefined) {
    return fallback(new Error('Audio duration is required for deAPI duration-based STT pricing'))
  }

  const form = new FormData()
  form.append('include_ts', 'true')
  form.append('model', options.model)
  if (mode === 'url') {
    form.append('source_url', options.sourceUrl as string)
  } else {
    form.append('duration_seconds', String(durationSeconds))
  }

  try {
    const payload = await withRetry(
      {
        retryClass: 'runtime_http_read',
        operationName: 'deapi-stt-price',
        policy: { maxAttempts: 4 },
        timeoutMs: REQUEST_TIMEOUT_MS
      },
      async (signal) => {
        const response = await fetch(buildDeapiUrl(getDeapiBaseUrl(), '/api/v1/client/transcribe/price-calculation'), {
          method: 'POST',
          headers: {
            accept: 'application/json',
            authorization: `Bearer ${apiKey}`
          },
          body: form,
          signal: signal ?? null
        })

        const responsePayload = await readJsonOrText(response)
        if (!response.ok) {
          throw Object.assign(
            new Error(`deAPI STT price request failed (${response.status}): ${extractDeapiErrorMessage(responsePayload) ?? 'Unknown error'}`),
            {
              status: response.status,
              headers: response.headers,
              stage: 'price',
              retryClass: 'runtime_http_read',
              rawResponse: responsePayload
            } satisfies Pick<DeapiQuoteError, 'status' | 'headers' | 'stage' | 'retryClass' | 'rawResponse'>
          )
        }

        return responsePayload
      },
      (error) => classifyFetchRetry(error, 'runtime_http_read', { retryAbortOnConservative: true })
    )

    const priceUsd = extractPriceUsd(payload)
    if (priceUsd === undefined) {
      throw Object.assign(
        new Error('deAPI STT price response did not include data.price'),
        {
          stage: 'price',
          retryClass: 'runtime_http_read',
          rawResponse: payload
        } satisfies Pick<DeapiQuoteError, 'stage' | 'retryClass' | 'rawResponse'>
      )
    }

    return {
      totalCost: priceUsd * 100,
      source: 'provider_quote',
      mode,
      estimateType: 'exact'
    }
  } catch (error) {
    return fallback(error)
  }
}

export const logDeapiPricingFallbackWarning = (
  warning: string | undefined
): void => {
  if (warning) {
    l.warn(warning)
  }
}
