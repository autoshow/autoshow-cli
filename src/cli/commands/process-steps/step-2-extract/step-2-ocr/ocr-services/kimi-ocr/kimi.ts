import * as l from '~/utils/logger'
import { validateKimiOcrModel } from '~/cli/commands/setup-and-utilities/models/model-options'
import { KIMI_DEFAULT_BASE_URL } from '~/utils/base-urls'
import { readEnv } from '~/utils/validate/env-utils'

export const KIMI_OCR_IMAGE_BYTES = 100 * 1024 * 1024
export const KIMI_OCR_LIMIT_SOURCE = 'project/links/kimi-general-ocr-text-links.md'

export const resolveKimiBaseUrl = (): string =>
  KIMI_DEFAULT_BASE_URL.trim().replace(/\/+$/, '')

export const getKimiApiKey = (): string | undefined => {
  return readEnv('KIMI_API_KEY')
}

export const setupKimiOcr = async (): Promise<void> => {
  const apiKey = getKimiApiKey()
  if (apiKey) {
    l.write('success', 'KIMI_API_KEY found - Kimi Text/OCR ready')
  } else {
    l.warn('KIMI_API_KEY not set - Kimi Text/OCR will not work until set')
    l.write('info', 'Set KIMI_API_KEY environment variable to use Kimi write and OCR models')
  }
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
