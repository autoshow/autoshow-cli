import * as l from '~/utils/logger'
import { DEEPINFRA_OCR_DEFAULT_BASE_URL } from '~/utils/base-urls'
import { readEnv } from '~/utils/validate/env-utils'

export const DEEPINFRA_OCR_IMAGE_BYTES = 20 * 1024 * 1024
export const DEEPINFRA_OCR_LIMIT_SOURCE = 'https://docs.deepinfra.com/chat/vision'

export const resolveDeepinfraOcrBaseUrl = (): string => {
  const trimmed = DEEPINFRA_OCR_DEFAULT_BASE_URL.replace(/\/+$/, '')
  return trimmed.endsWith('/chat/completions')
    ? trimmed.slice(0, -'/chat/completions'.length)
    : trimmed
}

export const getDeepinfraOcrClientConfig = (): { apiKey: string, baseURL: string } => {
  const apiKey = readEnv('DEEPINFRA_API_KEY')
  if (!apiKey) {
    throw new Error('DEEPINFRA_API_KEY environment variable is required for DeepInfra OCR')
  }

  return {
    apiKey,
    baseURL: resolveDeepinfraOcrBaseUrl()
  }
}

export const setupDeepinfraOcr = async (): Promise<void> => {
  const apiKey = readEnv('DEEPINFRA_API_KEY')
  const baseURL = resolveDeepinfraOcrBaseUrl()
  if (apiKey) {
    l.write('success', `DEEPINFRA_API_KEY found - DeepInfra OCR ready (${baseURL})`)
  } else {
    l.warn('DEEPINFRA_API_KEY not set - DeepInfra OCR will not work until set')
    l.write('info', 'Set DEEPINFRA_API_KEY environment variable to use DeepInfra OCR')
  }
}

export const ensureDeepinfraOcrSetup = async (): Promise<void> => {
  getDeepinfraOcrClientConfig()
}
