import { validateGlmOcrModel } from '~/cli/commands/setup-and-utilities/models/model-options'
import { GLM_DEFAULT_BASE_URL } from '~/utils/base-urls'
import { readEnv } from '~/utils/validate/env-utils'

export const resolveGlmBaseUrl = (): string => GLM_DEFAULT_BASE_URL

const getGlmApiKey = (): string | undefined => {
  return readEnv('GLM_API_KEY')
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
