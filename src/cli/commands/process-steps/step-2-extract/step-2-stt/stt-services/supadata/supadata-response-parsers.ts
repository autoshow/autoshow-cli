import type {
  SupadataChunk,
  SupadataJobPayload,
  SupadataJobStatus,
  SupadataTranscriptPayload
} from '~/types'

export const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const isSupadataChunk = (value: unknown): value is SupadataChunk =>
  isRecord(value)
  && typeof value['text'] === 'string'
  && typeof value['offset'] === 'number'
  && Number.isFinite(value['offset'])
  && typeof value['duration'] === 'number'
  && Number.isFinite(value['duration'])
  && (value['lang'] === undefined || typeof value['lang'] === 'string')

export const parseSupadataTranscriptPayload = (
  value: unknown
): SupadataTranscriptPayload | undefined => {
  if (!isRecord(value)) {
    return undefined
  }

  const content = value['content']
  if (
    typeof content !== 'string'
    && !(Array.isArray(content) && content.every(isSupadataChunk))
  ) {
    return undefined
  }

  return {
    content,
    ...(typeof value['lang'] === 'string' ? { lang: value['lang'] } : {}),
    ...(Array.isArray(value['availableLangs']) && value['availableLangs'].every((entry) => typeof entry === 'string')
      ? { availableLangs: value['availableLangs'] as string[] }
      : {})
  }
}

export const parseSupadataJobPayload = (
  value: unknown
): SupadataJobPayload | undefined =>
  isRecord(value) && typeof value['jobId'] === 'string'
    ? { jobId: value['jobId'] }
    : undefined

export const parseSupadataJobStatus = (
  value: unknown
): SupadataJobStatus | undefined => {
  if (!isRecord(value)) {
    return undefined
  }

  const status = value['status']
  if (status !== 'queued' && status !== 'active' && status !== 'completed' && status !== 'failed') {
    return undefined
  }

  const parsed: SupadataJobStatus = { status }
  if (value['content'] !== undefined) {
    if (
      typeof value['content'] !== 'string'
      && !(Array.isArray(value['content']) && value['content'].every(isSupadataChunk))
    ) {
      return undefined
    }
    parsed.content = value['content']
  }
  if (typeof value['lang'] === 'string') {
    parsed.lang = value['lang']
  }
  if (Array.isArray(value['availableLangs']) && value['availableLangs'].every((entry) => typeof entry === 'string')) {
    parsed.availableLangs = value['availableLangs'] as string[]
  }
  if ('error' in value) {
    parsed.error = value['error']
  }
  if ('message' in value) {
    parsed.message = value['message']
  }

  return parsed
}

export const extractSupadataErrorMessage = (payload: unknown): string | undefined => {
  if (typeof payload === 'string') {
    const trimmed = payload.trim()
    return trimmed.length > 0 ? trimmed : undefined
  }

  if (!isRecord(payload)) {
    return undefined
  }

  const directMessage = typeof payload['message'] === 'string'
    ? payload['message']
    : typeof payload['error'] === 'string'
      ? payload['error']
      : undefined
  if (directMessage && directMessage.trim().length > 0) {
    return directMessage.trim()
  }

  if (isRecord(payload['error']) && typeof payload['error']['message'] === 'string') {
    return payload['error']['message']
  }

  return undefined
}

export const readJsonOrText = async (response: Response): Promise<unknown> => {
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
