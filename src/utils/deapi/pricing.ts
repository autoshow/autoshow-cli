import { classifyFetchRetry, withRetry } from '~/utils/retries'
import {
  buildDeapiUrl,
  createDeapiHttpError,
  extractDeapiErrorMessage,
  getDeapiBaseUrl,
  isRecord,
  readJsonOrText
} from './client'

const REQUEST_TIMEOUT_MS = 60_000

const parsePriceUsd = (value: unknown): number | undefined => {
  if (typeof value === 'number' && Number.isFinite(value) && value >= 0) {
    return value
  }

  if (typeof value === 'string') {
    const normalized = value.replace(/[$,\s]/g, '')
    const parsed = Number.parseFloat(normalized)
    if (Number.isFinite(parsed) && parsed >= 0) {
      return parsed
    }
  }

  return undefined
}

export const extractPriceUsd = (payload: unknown): number | undefined => {
  if (isRecord(payload)) {
    const directPrice = parsePriceUsd(payload['price'])
    if (directPrice !== undefined) {
      return directPrice
    }

    const data = payload['data']
    if (isRecord(data)) {
      const nestedPrice = parsePriceUsd(data['price'])
      if (nestedPrice !== undefined) {
        return nestedPrice
      }
    }
  }

  return undefined
}

export const requestDeapiJsonPrice = async (
  options: {
    apiKey: string
    path: string
    operationName: string
    body: Record<string, unknown>
    baseURL?: string | undefined
  }
): Promise<number> => {
  const payload = await withRetry(
    {
      retryClass: 'runtime_http_read',
      operationName: options.operationName,
      policy: { maxAttempts: 4 },
      timeoutMs: REQUEST_TIMEOUT_MS
    },
    async (signal) => {
      const response = await fetch(buildDeapiUrl(options.baseURL ?? getDeapiBaseUrl(), options.path), {
        method: 'POST',
        headers: {
          accept: 'application/json',
          authorization: `Bearer ${options.apiKey}`,
          'content-type': 'application/json'
        },
        body: JSON.stringify(options.body),
        signal: signal ?? null
      })

      const responsePayload = await readJsonOrText(response)
      if (!response.ok) {
        throw createDeapiHttpError(
          `deAPI price request failed (${response.status}): ${extractDeapiErrorMessage(responsePayload) ?? 'Unknown error'}`,
          response,
          'price',
          'runtime_http_read',
          responsePayload
        )
      }

      return responsePayload
    },
    (error) => classifyFetchRetry(error, 'runtime_http_read', { retryAbortOnConservative: true })
  )

  const priceUsd = extractPriceUsd(payload)
  if (priceUsd === undefined) {
    throw createDeapiHttpError(
      'deAPI price response did not include data.price',
      new Response(null, { status: 502 }),
      'price',
      'runtime_http_read',
      payload
    )
  }

  return priceUsd
}
