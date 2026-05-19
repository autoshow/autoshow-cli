import type { AnthropicRestConfig } from '~/utils/anthropic/client'
import { readEnv } from '~/utils/validate/env-utils'

export const getAnthropicClientConfig = (): AnthropicRestConfig => {
  const apiKey = readEnv('ANTHROPIC_API_KEY')
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY environment variable is required')
  }

  const baseURL = readEnv('ANTHROPIC_BASE_URL')
  return baseURL ? { apiKey, baseURL } : { apiKey }
}
