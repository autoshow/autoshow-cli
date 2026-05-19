import * as l from '~/utils/logger'
import { readEnv } from '~/utils/validate/env-utils'
import type { Step3Metadata, StructuredRequestOptions } from '~/types'
import { runOpenAICompatibleChatModel } from '../openai-compatible-chat'

const getGrokClientConfig = (): { apiKey: string, baseURL: string } => {
  const apiKey = readEnv('XAI_API_KEY')
  if (!apiKey) {
    l.error('XAI_API_KEY not found in environment for Grok model')
    throw new Error('XAI_API_KEY environment variable is required for --grok models')
  }

  const baseURL = readEnv('XAI_BASE_URL') ?? 'https://api.x.ai/v1'
  return { apiKey, baseURL }
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
