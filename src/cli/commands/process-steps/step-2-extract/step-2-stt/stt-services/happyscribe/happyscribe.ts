import { HAPPYSCRIBE_DEFAULT_BASE_URL } from '~/utils/base-urls'
import { readEnv } from '~/utils/validate/env-utils'
import { classifyFetchRetry, withRetry } from '~/utils/retries'
import type { HappyScribeOrganization, HappyScribeOrganizationSelection } from '~/types'

const ORGANIZATION_REQUEST_TIMEOUT_MS = 60_000

export const HAPPYSCRIBE_STT_LANGUAGE = 'en-US'

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const normalizeId = (value: unknown): string | undefined => {
  if (typeof value === 'string' && value.trim().length > 0) {
    return value.trim()
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value)
  }
  return undefined
}

const parseOrganization = (value: unknown): HappyScribeOrganization | undefined => {
  if (!isRecord(value)) {
    return undefined
  }

  const id = normalizeId(value['id'])
  if (!id) {
    return undefined
  }

  return {
    id,
    ...(typeof value['name'] === 'string' && value['name'].trim().length > 0
      ? { name: value['name'].trim() }
      : {}),
    ...(typeof value['currency'] === 'string' && value['currency'].trim().length > 0
      ? { currency: value['currency'].trim().toLowerCase() }
      : {})
  }
}

const readJsonOrText = async (response: Response): Promise<unknown> => {
  const rawText = await response.text()
  if (rawText.length === 0) {
    return {}
  }

  try {
    return JSON.parse(rawText) as unknown
  } catch {
    return rawText
  }
}

const extractErrorMessage = (payload: unknown): string | undefined => {
  if (typeof payload === 'string') {
    const trimmed = payload.trim()
    return trimmed.length > 0 ? trimmed : undefined
  }

  if (!isRecord(payload)) {
    return undefined
  }

  for (const key of ['message', 'error', 'detail', 'failureMessage', 'failureReason'] as const) {
    const value = payload[key]
    if (typeof value === 'string' && value.trim().length > 0) {
      return value.trim()
    }
  }

  return undefined
}

export const getHappyScribeBaseUrl = (): string => HAPPYSCRIBE_DEFAULT_BASE_URL

export const getHappyScribeApiKey = (): string | undefined =>
  readEnv('HAPPYSCRIBE_API_KEY')

export const buildHappyScribeUrl = (baseURL: string, path: string): string =>
  new URL(path.replace(/^\/+/, ''), baseURL.endsWith('/') ? baseURL : `${baseURL}/`).toString()

export const formatHappyScribeOrganizationChoices = (
  organizations: HappyScribeOrganization[]
): string =>
  organizations.length === 0
    ? 'none'
    : organizations
        .map((organization) => {
          const parts = [
            organization.id,
            organization.name ? `"${organization.name}"` : undefined,
            organization.currency ? `currency=${organization.currency}` : 'currency=unknown'
          ].filter((value): value is string => typeof value === 'string')
          return parts.join(' ')
        })
        .join(', ')

export const listHappyScribeOrganizations = async (
  options: {
    apiKey?: string | undefined
    baseURL?: string | undefined
  } = {}
): Promise<HappyScribeOrganization[]> => {
  const apiKey = options.apiKey ?? getHappyScribeApiKey()
  if (!apiKey) {
    throw new Error('HAPPYSCRIBE_API_KEY environment variable is required for Happy Scribe transcription')
  }

  const baseURL = options.baseURL ?? getHappyScribeBaseUrl()
  const payload = await withRetry(
    {
      retryClass: 'runtime_http_read',
      operationName: 'happyscribe-list-organizations',
      policy: { maxAttempts: 4 },
      timeoutMs: ORGANIZATION_REQUEST_TIMEOUT_MS
    },
    async (signal) => {
      const response = await fetch(buildHappyScribeUrl(baseURL, '/organizations'), {
        method: 'GET',
        headers: {
          authorization: `Bearer ${apiKey}`,
          accept: 'application/json'
        },
        signal: signal ?? null
      })
      const payload = await readJsonOrText(response)

      if (!response.ok) {
        throw Object.assign(
          new Error(`Happy Scribe organizations lookup failed (${response.status}): ${extractErrorMessage(payload) ?? 'Unknown error'}`),
          {
            status: response.status,
            headers: response.headers,
            stage: 'create',
            retryClass: 'runtime_http_read',
            rawResponse: payload
          }
        )
      }

      return payload
    },
    (error) => classifyFetchRetry(error, 'runtime_http_read', { retryAbortOnConservative: true })
  )

  if (!isRecord(payload) || !Array.isArray(payload['organizations'])) {
    throw new Error('Happy Scribe organizations response missing organizations array')
  }

  return payload['organizations']
    .map(parseOrganization)
    .filter((organization): organization is HappyScribeOrganization => organization !== undefined)
}

export const resolveHappyScribeOrganizationSelection = async (
  options: {
    preferredOrganizationId?: string | undefined
  } = {}
): Promise<HappyScribeOrganizationSelection> => {
  const organizations = await listHappyScribeOrganizations()
  const requestedOrganizationId = options.preferredOrganizationId?.trim()

  if (requestedOrganizationId) {
    const selected = organizations.find((organization) => organization.id === requestedOrganizationId)
    if (selected) {
      return {
        selected,
        organizations,
        source: 'option',
        requestedOrganizationId
      }
    }

    return {
      organizations,
      reason: 'not_found',
      source: 'option',
      requestedOrganizationId
    }
  }

  if (organizations.length === 1) {
    return {
      selected: organizations[0],
      organizations,
      source: 'auto'
    }
  }

  return {
    organizations,
    reason: organizations.length === 0 ? 'missing' : 'ambiguous'
  }
}

export const buildHappyScribeOrganizationResolutionError = (
  selection: HappyScribeOrganizationSelection
): Error => {
  const baseMessage = selection.reason === 'not_found'
    ? `Happy Scribe organization "${selection.requestedOrganizationId}" was not found for this API key.`
    : selection.reason === 'ambiguous'
      ? 'Happy Scribe execution requires an explicit organization because this API key can access multiple organizations.'
      : 'No Happy Scribe organizations are available for this API key.'

  return new Error([
    baseMessage,
    `Organizations: ${formatHappyScribeOrganizationChoices(selection.organizations)}.`,
    'Pass --stt-happyscribe-organization-id <id> or save defaults.extract.stt.happyscribeOrganizationId with bun as config.'
  ].join(' '))
}

export const ensureHappyScribeSttSetup = async (): Promise<void> => {
  if (!getHappyScribeApiKey()) {
    throw new Error('HAPPYSCRIBE_API_KEY environment variable is required for Happy Scribe transcription')
  }
}
