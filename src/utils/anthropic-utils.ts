import Anthropic from '@anthropic-ai/sdk'
import { readEnv } from '~/utils/validate/env-utils'

export const getAnthropicClientConfig = (): { apiKey: string, baseURL?: string } => {
  const apiKey = readEnv('ANTHROPIC_API_KEY')
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY environment variable is required')
  }

  const baseURL = readEnv('ANTHROPIC_BASE_URL')
  return baseURL ? { apiKey, baseURL } : { apiKey }
}

export const createAnthropicClient = (
  opts?: { timeout?: number }
): Anthropic => {
  const config = getAnthropicClientConfig()
  return new Anthropic({
    apiKey: config.apiKey,
    maxRetries: 0,
    ...(typeof opts?.timeout === 'number' ? { timeout: opts.timeout } : {}),
    ...(config.baseURL ? { baseURL: config.baseURL } : {})
  })
}
