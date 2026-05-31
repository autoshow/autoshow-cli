import { readEnv } from '~/utils/validate/env-utils'
import { XAI_DEFAULT_BASE_URL } from '~/utils/base-urls'
import type { OpenAIRestConfig } from '~/utils/openai/client'

const resolveGrokBaseUrl = (): string => {
  const trimmed = (readEnv('XAI_BASE_URL') ?? XAI_DEFAULT_BASE_URL).trim().replace(/\/+$/, '')
  return trimmed.endsWith('/chat/completions')
    ? trimmed.slice(0, -'/chat/completions'.length)
    : trimmed
}

export const getGrokClientConfig = (): OpenAIRestConfig => {
  const apiKey = readEnv('XAI_API_KEY')
  if (!apiKey) {
    throw new Error('XAI_API_KEY environment variable is required')
  }

  return {
    apiKey,
    baseURL: resolveGrokBaseUrl(),
  }
}
