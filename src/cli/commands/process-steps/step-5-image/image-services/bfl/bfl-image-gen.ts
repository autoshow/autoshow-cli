import { readEnv } from '~/utils/validate/env-utils'
import { BFL_DEFAULT_BASE_URL } from '~/utils/base-urls'

const getBflApiKey = (): string | undefined => readEnv('BFL_API_KEY')

export const getBflBaseUrl = (): string => {
  return BFL_DEFAULT_BASE_URL.replace(/\/+$/, '')
}

export const ensureBflImageGenSetup = async (): Promise<string> => {
  const apiKey = getBflApiKey()
  if (!apiKey) {
    throw new Error('BFL_API_KEY environment variable is required for BFL image generation')
  }
  return apiKey
}
