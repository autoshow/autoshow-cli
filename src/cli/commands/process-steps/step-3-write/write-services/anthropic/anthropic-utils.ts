import type { AnthropicRestConfig } from '~/utils/anthropic/client'
import { readEnv } from '~/utils/validate/env-utils'
import { ANTHROPIC_DEFAULT_BASE_URL } from '~/utils/base-urls'

export const getAnthropicClientConfig = (): AnthropicRestConfig => {
  const apiKey = readEnv('ANTHROPIC_API_KEY')
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY environment variable is required')
  }

  return { apiKey, baseURL: readEnv('ANTHROPIC_BASE_URL') ?? ANTHROPIC_DEFAULT_BASE_URL }
}
