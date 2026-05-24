import { readEnv } from '~/utils/validate/env-utils'
import { OPENAI_DEFAULT_BASE_URL } from '~/utils/base-urls'
import type { OpenAIRestConfig } from '~/utils/openai/client'

export const getOpenAIClientConfig = (): OpenAIRestConfig => {
  const apiKey = readEnv('OPENAI_API_KEY')
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY environment variable is required')
  }

  return { apiKey, baseURL: OPENAI_DEFAULT_BASE_URL }
}
