import * as l from '~/utils/logger'
import type {
  RunOpenAICompatibleChatModelOptions,
  Step3Metadata
} from '~/types'
import { withRetry, classifyFetchRetry } from '~/utils/retries'
import { isStructuredFallbackError } from '~/cli/commands/process-steps/step-3-write/write-utils/structured-error-utils'
import { runWithLLMInstrumentation, buildStep3Metadata, type LlmApiCallResult } from '~/cli/commands/process-steps/step-3-write/write-utils/llm-instrumentation'
import { LLM_REQUEST_TIMEOUT_MS } from '~/utils/timeouts'
import { createOpenAIChatCompletion, extractOpenAIChatCompletionText } from '~/utils/openai/client'

const createCombinedSignal = (signal?: AbortSignal): AbortSignal => {
  const timeoutSignal = AbortSignal.timeout(LLM_REQUEST_TIMEOUT_MS)
  return AbortSignal.any([...(signal ? [signal] : []), timeoutSignal])
}

export const runOpenAICompatibleChatModel = async ({
  prompt,
  model,
  structuredOpts,
  config,
  service,
  providerLabel,
  operationName,
  customizeRequestBody,
  buildStructuredResponseFormat
}: RunOpenAICompatibleChatModelOptions): Promise<{ result: string, metadata: Step3Metadata }> => {
  try {
    const apiCall = (): Promise<LlmApiCallResult> => withRetry(
      { retryClass: 'runtime_http_create_conservative', operationName },
      async (signal) => {
        const requestBody: Record<string, unknown> = {
          model,
          messages: [{ role: 'user', content: prompt }]
        }
        customizeRequestBody?.(requestBody, model)

        const executeRequest = async (body: Record<string, unknown>): Promise<LlmApiCallResult> => {
          const response = await createOpenAIChatCompletion(config, body, {
            signal: createCombinedSignal(signal)
          })

          const text = extractOpenAIChatCompletionText(response) ?? ''
          if (!text) {
            throw new Error('No response text from model')
          }
          return {
            text,
            usage: response.usage,
            rawProviderUsage: response.usage,
            returnedModel: response.model
          }
        }

        if (!structuredOpts) {
          return await executeRequest(requestBody)
        }

        const structuredRequestBody: Record<string, unknown> = {
          ...requestBody,
          response_format: buildStructuredResponseFormat?.(structuredOpts) ?? {
            type: 'json_schema',
            json_schema: {
              name: structuredOpts.schemaName,
              schema: structuredOpts.schema,
              strict: structuredOpts.strict
            }
          }
        }

        try {
          return await executeRequest(structuredRequestBody)
        } catch (error) {
          if (!isStructuredFallbackError(error)) {
            throw error
          }
          l.warn(`${providerLabel} structured output failed for ${model}; retrying without response_format`)
          return await executeRequest(requestBody)
        }
      },
      (error) => classifyFetchRetry(error, 'runtime_http_create_conservative')
    )

    const instrumentation = await runWithLLMInstrumentation(prompt, apiCall)
    const metadata = buildStep3Metadata(service, model, instrumentation, structuredOpts)

    return { result: instrumentation.responseText, metadata }
  } catch (error) {
    l.error(`Failed to run ${providerLabel} model`, error)
    throw error
  }
}
