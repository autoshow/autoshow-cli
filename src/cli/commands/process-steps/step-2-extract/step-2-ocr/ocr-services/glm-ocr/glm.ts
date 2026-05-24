import * as l from '~/utils/logger'
import { validateGlmOcrModel } from '~/cli/commands/setup-and-utilities/models/model-options'
import { GLM_DEFAULT_BASE_URL } from '~/utils/base-urls'
import { readEnv } from '~/utils/validate/env-utils'

export const resolveGlmBaseUrl = (): string => GLM_DEFAULT_BASE_URL

export const getGlmApiKey = (): string | undefined => {
  return readEnv('GLM_API_KEY')
}

export const setupGlmOcr = async (): Promise<void> => {
  const apiKey = getGlmApiKey()
  if (apiKey) {
    l.write('success', 'GLM_API_KEY found - GLM OCR/Reader/Text ready')
  } else {
    l.warn('GLM_API_KEY not set - GLM OCR/Reader/Text will not work until set')
    l.write('info', 'Set GLM_API_KEY environment variable to use GLM OCR, GLM Reader, and GLM text models')
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
