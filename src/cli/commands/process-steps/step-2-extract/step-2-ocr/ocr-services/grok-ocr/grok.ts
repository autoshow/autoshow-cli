import * as l from '~/utils/logger'
import { readEnv } from '~/utils/validate/env-utils'

export const GROK_OCR_DEFAULT_BASE_URL = 'https://api.x.ai/v1'
export const GROK_OCR_IMAGE_BYTES = 20 * 1024 * 1024
export const GROK_OCR_LIMIT_SOURCE = 'https://docs.x.ai/developers/models'

export const resolveGrokOcrBaseUrl = (): string => {
  const configured = readEnv('XAI_BASE_URL') ?? GROK_OCR_DEFAULT_BASE_URL
  const trimmed = configured.trim().replace(/\/+$/, '')
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

export const setupGrokOcr = async (): Promise<void> => {
  const apiKey = readEnv('XAI_API_KEY')
  const baseURL = resolveGrokOcrBaseUrl()
  if (apiKey) {
    l.write('success', `XAI_API_KEY found - Grok OCR ready (${baseURL})`)
  } else {
    l.warn('XAI_API_KEY not set - Grok OCR will not work until set')
    l.write('info', 'Set XAI_API_KEY environment variable to use Grok OCR')
  }
}

export const ensureGrokOcrSetup = async (): Promise<void> => {
  getGrokOcrClientConfig()
}
