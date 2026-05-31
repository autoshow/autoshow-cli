import { readEnv } from '~/utils/validate/env-utils'
import { REVE_DEFAULT_BASE_URL } from '~/utils/base-urls'

const getReveApiKey = (): string | undefined => readEnv('REVE_API_KEY')

export const getReveBaseUrl = (): string => {
  return (readEnv('REVE_BASE_URL') ?? REVE_DEFAULT_BASE_URL).replace(/\/+$/, '')
}

export const ensureReveImageGenSetup = async (): Promise<string> => {
  const apiKey = getReveApiKey()
  if (!apiKey) {
    throw new Error('REVE_API_KEY environment variable is required for Reve image generation')
  }
  return apiKey
}
