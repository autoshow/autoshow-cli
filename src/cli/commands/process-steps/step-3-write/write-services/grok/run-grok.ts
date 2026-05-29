import * as l from '~/utils/logger'
import { readEnv } from '~/utils/validate/env-utils'
import { XAI_DEFAULT_BASE_URL } from '~/utils/base-urls'
import type { Step3Metadata, StructuredRequestOptions } from '~/types'
import { runOpenAICompatibleChatModel } from '../openai-compatible-chat'

const getGrokClientConfig = (): { apiKey: string, baseURL: string } => {
  const apiKey = readEnv('XAI_API_KEY')
  if (!apiKey) {
    l.error('XAI_API_KEY not found in environment for Grok model')
    throw new Error('XAI_API_KEY environment variable is required for --grok models')
  }

  const baseURL = (readEnv('XAI_BASE_URL') ?? XAI_DEFAULT_BASE_URL).trim().replace(/\/+$/, '')
  return {
    apiKey,
    baseURL: baseURL.endsWith('/chat/completions')
      ? baseURL.slice(0, -'/chat/completions'.length)
      : baseURL
  }
}

export const runGrokModel = async (
  prompt: string,
  model: string,
  structuredOpts?: StructuredRequestOptions
): Promise<{ result: string, metadata: Step3Metadata }> => {
  const config = getGrokClientConfig()

  return await runOpenAICompatibleChatModel({
    prompt,
    model,
    structuredOpts,
    config,
    service: 'grok',
    providerLabel: 'Grok',
    operationName: 'grok-llm'
  })
}
