import { extractRestErrorMessage, parseJsonOrText } from '~/utils/rest-client'

export const trimTrailingSlash = (value: string): string => value.replace(/\/+$/, '')

export const readTtsHttpError = async (response: Response): Promise<string> => {
  const rawText = await response.text()
  if (!rawText.trim()) {
    return `HTTP ${response.status}`
  }

  return extractRestErrorMessage(parseJsonOrText(rawText), rawText, response.status)
}

export const fetchTtsAudioBytes = async (options: {
  url: string
  apiKey: string
  providerLabel: string
  body: Record<string, unknown>
  signal?: AbortSignal | undefined
}): Promise<Uint8Array> => {
  const response = await fetch(options.url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${options.apiKey}`,
      'Content-Type': 'application/json',
      Accept: 'audio/wav'
    },
    body: JSON.stringify(options.body),
    ...(options.signal ? { signal: options.signal } : {})
  })

  if (!response.ok) {
    const errText = await readTtsHttpError(response)
    const error = new Error(`${options.providerLabel} TTS failed (${response.status}): ${errText}`) as Error & {
      status?: number
      headers?: Headers
    }
    error.status = response.status
    error.headers = response.headers
    throw error
  }

  return new Uint8Array(await response.arrayBuffer())
}
