import OpenAI from 'openai'
import * as l from '~/logger'
import { readEnv, readEnvFallback } from '~/utils/validate/env-utils'
import type { StructuredRequestOptions } from '~/cli/commands/process-steps/step-3-write/structured-output/types'
import type { Step3Metadata } from '~/types'
import { runOpenAICompatibleChatModel } from '../openai-compatible-chat'

const getGroqClientConfig = (): { apiKey: string, baseURL: string } => {
  const apiKey = readEnvFallback('GROQ_API_KEY')
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
  const client = new OpenAI({ apiKey: config.apiKey, baseURL: config.baseURL, maxRetries: 0 })

  return await runOpenAICompatibleChatModel({
    prompt,
    model,
    structuredOpts,
    client,
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
