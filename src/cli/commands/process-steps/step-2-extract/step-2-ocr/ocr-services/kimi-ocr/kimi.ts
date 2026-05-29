import { validateKimiOcrModel } from '~/cli/commands/setup-and-utilities/models/model-options'
import { KIMI_DEFAULT_BASE_URL } from '~/utils/base-urls'
import { readEnv } from '~/utils/validate/env-utils'

export const KIMI_OCR_IMAGE_BYTES = 100 * 1024 * 1024
export const KIMI_OCR_LIMIT_SOURCE = 'project/links/kimi-general-ocr-text-links.md'

export const resolveKimiBaseUrl = (): string =>
  KIMI_DEFAULT_BASE_URL.trim().replace(/\/+$/, '')

const getKimiApiKey = (): string | undefined => {
  return readEnv('KIMI_API_KEY')
}

export const ensureKimiApiKey = (serviceName: string): string => {
  const apiKey = getKimiApiKey()
  if (!apiKey) {
    throw new Error(`KIMI_API_KEY environment variable is required for ${serviceName}`)
  }
  return apiKey
}

export const ensureKimiOcrSetup = async (): Promise<void> => {
  ensureKimiApiKey('Kimi OCR')
}

export { validateKimiOcrModel }
