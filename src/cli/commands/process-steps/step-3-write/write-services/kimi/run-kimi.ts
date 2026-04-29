import OpenAI from 'openai'
import type { Step3Metadata, StructuredRequestOptions } from '~/types'
import { ensureKimiApiKey, resolveKimiBaseUrl } from '~/cli/commands/process-steps/step-2-extract/step-2-ocr/ocr-services/kimi-ocr/kimi'
import { runOpenAICompatibleChatModel } from '../openai-compatible-chat'

export const runKimiModel = async (
  prompt: string,
  model: string,
  structuredOpts?: StructuredRequestOptions
): Promise<{ result: string, metadata: Step3Metadata }> => {
  const apiKey = ensureKimiApiKey('--kimi models')
  const client = new OpenAI({
    apiKey,
    baseURL: resolveKimiBaseUrl(),
    maxRetries: 0
  })

  return await runOpenAICompatibleChatModel({
    prompt,
    model,
    structuredOpts,
    client,
    service: 'kimi',
    providerLabel: 'Kimi',
    operationName: 'kimi-llm',
    customizeRequestBody: (requestBody) => {
      requestBody['stream'] = false
      requestBody['max_completion_tokens'] = 32768
      requestBody['thinking'] = { type: 'disabled' }
    },
    buildStructuredResponseFormat: () => ({ type: 'json_object' })
  })
}
