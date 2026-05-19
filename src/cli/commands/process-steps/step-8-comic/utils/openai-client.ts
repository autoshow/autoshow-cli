import { readEnv } from '~/utils/validate/env-utils'
import type { OpenAIRestConfig } from '~/utils/openai/client'

export const getOpenAIClientConfig = (): OpenAIRestConfig => {
  const apiKey = readEnv('OPENAI_API_KEY')
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY environment variable is required')
  }

  const baseURL = readEnv('OPENAI_BASE_URL')
  return baseURL ? { apiKey, baseURL } : { apiKey }
}
