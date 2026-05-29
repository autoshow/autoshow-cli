import { XAI_DEFAULT_BASE_URL } from '~/utils/base-urls'
import { readEnv } from '~/utils/validate/env-utils'

export const GROK_OCR_IMAGE_BYTES = 20 * 1024 * 1024
export const GROK_OCR_LIMIT_SOURCE = 'https://docs.x.ai/developers/models'

const resolveGrokOcrBaseUrl = (): string => {
  const trimmed = XAI_DEFAULT_BASE_URL.trim().replace(/\/+$/, '')
  return trimmed.endsWith('/chat/completions')
    ? trimmed.slice(0, -'/chat/completions'.length)
    : trimmed
}

export const getGrokOcrClientConfig = (): { apiKey: string, baseURL: string } => {
  const apiKey = readEnv('XAI_API_KEY')
  if (!apiKey) {
    throw new Error('XAI_API_KEY environment variable is required for Grok OCR')
  }

  return {
    apiKey,
    baseURL: resolveGrokOcrBaseUrl()
  }
}

export const ensureGrokOcrSetup = async (): Promise<void> => {
  getGrokOcrClientConfig()
}
