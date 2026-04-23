import * as l from '~/logger'
import { readEnv } from '~/utils/validate/env-utils'

const DEAPI_SUPPORTED_HOST_PATTERNS = [
  /(^|\.)youtube\.com$/i,
  /(^|\.)youtu\.be$/i,
  /(^|\.)x\.com$/i,
  /(^|\.)twitter\.com$/i,
  /(^|\.)twitch\.tv$/i,
  /(^|\.)kick\.com$/i,
  /(^|\.)tiktok\.com$/i
]

export const getDeapiBaseUrl = (): string =>
  readEnv('DEAPI_BASE_URL') ?? 'https://api.deapi.ai'

export const isDeapiSupportedSourceUrl = (
  sourceUrl: string | undefined
): boolean => {
  if (typeof sourceUrl !== 'string' || sourceUrl.length === 0) {
    return false
  }

  try {
    const parsed = new URL(sourceUrl)
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return false
    }

    const hostname = parsed.hostname.toLowerCase()
    return DEAPI_SUPPORTED_HOST_PATTERNS.some((pattern) => pattern.test(hostname))
  } catch {
    return false
  }
}

export const setupDeapiStt = async (): Promise<void> => {
  const apiKey = readEnv('DEAPI_API_KEY')
  if (apiKey) {
    l.write('success', `DEAPI_API_KEY found — deAPI transcription ready (${getDeapiBaseUrl()})`)
  } else {
    l.warn('DEAPI_API_KEY not set — deAPI transcription will not work until set')
    l.write('info', 'Set DEAPI_API_KEY environment variable to use deAPI transcription')
  }
}

export const ensureDeapiSttSetup = async (): Promise<void> => {
  const apiKey = readEnv('DEAPI_API_KEY')
  if (!apiKey) {
    throw new Error('DEAPI_API_KEY environment variable is required for deAPI transcription')
  }
}
