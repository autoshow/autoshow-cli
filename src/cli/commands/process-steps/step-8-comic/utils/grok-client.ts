import { readEnv } from '~/utils/validate/env-utils'
import type { OpenAIRestConfig } from '~/utils/openai/client'

const GROK_DEFAULT_BASE_URL = 'https://api.x.ai/v1'

const resolveGrokBaseUrl = (): string => {
  const configured = readEnv('XAI_BASE_URL') ?? GROK_DEFAULT_BASE_URL
  const trimmed = configured.trim().replace(/\/+$/, '')
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
