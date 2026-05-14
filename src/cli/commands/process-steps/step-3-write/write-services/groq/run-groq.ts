import * as l from '~/utils/logger'
import { readEnv } from '~/utils/validate/env-utils'
import type { Step3Metadata, StructuredRequestOptions } from '~/types'
import { runOpenAICompatibleChatModel } from '../openai-compatible-chat'

const getGroqClientConfig = (): { apiKey: string, baseURL: string } => {
  const apiKey = readEnv('GROQ_API_KEY')
  if (!apiKey) {
    l.error('GROQ_API_KEY not found in environment for Groq model')
    throw new Error('GROQ_API_KEY environment variable is required for --groq models')
  }

  const baseURL = readEnv('GROQ_BASE_URL') ?? 'https://api.groq.com/openai/v1'
  return { apiKey, baseURL }
}

export const runGroqModel = async (
  prompt: string,
  model: string,
  structuredOpts?: StructuredRequestOptions
): Promise<{ result: string, metadata: Step3Metadata }> => {
  const config = getGroqClientConfig()

  return await runOpenAICompatibleChatModel({
    prompt,
    model,
    structuredOpts,
    config,
    service: 'groq',
    providerLabel: 'Groq',
    operationName: 'groq-llm',
    customizeRequestBody: (requestBody, currentModel) => {
      if (currentModel.startsWith('openai/gpt-oss-')) {
        requestBody['reasoning_effort'] = 'low'
      }
    }
  })
}
