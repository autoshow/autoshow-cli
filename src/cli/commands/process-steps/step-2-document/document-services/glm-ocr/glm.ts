import * as l from '~/logger'
import { validateGlmOcrModel } from '~/cli/commands/setup-and-utilities/models/model-options'
import { readEnv } from '~/utils/validate/env-utils'

const DEFAULT_GLM_BASE_URL = 'https://api.z.ai/api/paas/v4'

const normalizeGlmBaseUrl = (value: string): string => {
  const normalized = value.trim().replace(/\/+$/, '')
  if (normalized.endsWith('/paas/v4')) {
    return normalized
  }
  if (normalized.endsWith('/api/paas')) {
    return `${normalized}/v4`
  }
  if (normalized.endsWith('/api')) {
    return `${normalized}/paas/v4`
  }
  if (/^https?:\/\/[^/]+$/i.test(normalized)) {
    return `${normalized}/api/paas/v4`
  }
  return normalized
}

export const resolveGlmBaseUrl = (): string => {
  const configured = readEnv('ZAI_BASE_URL')
  if (!configured) {
    return DEFAULT_GLM_BASE_URL
  }
  return normalizeGlmBaseUrl(configured)
}

export const getGlmApiKey = (): string | undefined => {
  return readEnv('GLM_API_KEY')
}

export const setupGlmOcr = async (): Promise<void> => {
  const apiKey = getGlmApiKey()
  if (apiKey) {
    l.success('GLM_API_KEY found — GLM OCR/Reader ready')
  } else {
    l.warn('GLM_API_KEY not set — GLM OCR/Reader will not work until set')
    l.info('Set GLM_API_KEY environment variable to use GLM OCR and GLM Reader')
  }
}

export const ensureGlmApiKey = (serviceName: string): string => {
  const apiKey = getGlmApiKey()
  if (!apiKey) {
    throw new Error(`GLM_API_KEY environment variable is required for ${serviceName}`)
  }
  return apiKey
}

export const ensureGlmOcrSetup = async (): Promise<void> => {
  ensureGlmApiKey('GLM OCR')
}

export { validateGlmOcrModel }
