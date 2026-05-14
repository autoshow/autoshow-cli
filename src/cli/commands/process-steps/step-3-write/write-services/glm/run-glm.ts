import type { Step3Metadata, StructuredRequestOptions } from '~/types'
import { ensureGlmApiKey, resolveGlmBaseUrl } from '~/cli/commands/process-steps/step-2-extract/step-2-ocr/ocr-services/glm-ocr/glm'
import { runOpenAICompatibleChatModel } from '../openai-compatible-chat'

export const runGlmModel = async (
  prompt: string,
  model: string,
  structuredOpts?: StructuredRequestOptions
): Promise<{ result: string, metadata: Step3Metadata }> => {
  const apiKey = ensureGlmApiKey('--glm models')
  const config = {
    apiKey,
    baseURL: resolveGlmBaseUrl()
  }

  return await runOpenAICompatibleChatModel({
    prompt,
    model,
    structuredOpts,
    config,
    service: 'glm',
    providerLabel: 'GLM',
    operationName: 'glm-llm',
    customizeRequestBody: (requestBody) => {
      requestBody['stream'] = false
      requestBody['max_tokens'] = 16000
      requestBody['thinking'] = { type: 'disabled' }
    },
    buildStructuredResponseFormat: () => ({ type: 'json_object' })
  })
}
