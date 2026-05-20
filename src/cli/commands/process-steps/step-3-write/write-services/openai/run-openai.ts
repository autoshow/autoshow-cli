import * as l from '~/utils/logger'
import type { Step3Metadata, StructuredRequestOptions } from '~/types'
import { runWithLLMInstrumentation, buildStep3Metadata, type LlmApiCallResult } from '~/cli/commands/process-steps/step-3-write/write-utils/llm-instrumentation'
import { withRetry, classifyFetchRetry } from '~/utils/retries'
import { getOpenAIClientConfig } from '~/cli/commands/process-steps/step-3-write/write-services/openai/openai-utils'
import { LLM_REQUEST_TIMEOUT_MS } from '~/utils/timeouts'
import { createOpenAIResponse, extractOpenAIResponseText } from '~/utils/openai/client'

export const runOpenAIModel = async (
  prompt: string,
  model: string,
  structuredOpts?: StructuredRequestOptions
): Promise<{ result: string, metadata: Step3Metadata }> => {
  try {
    const config = getOpenAIClientConfig()

    const apiCall = (): Promise<LlmApiCallResult> => withRetry(
      { retryClass: 'runtime_http_create_conservative', operationName: 'openai-llm' },
      async (signal) => {
        const timeoutSignal = AbortSignal.timeout(LLM_REQUEST_TIMEOUT_MS)
        const combined = AbortSignal.any([...(signal ? [signal] : []), timeoutSignal])

        const requestBody: Record<string, unknown> = {
          model,
          input: prompt,
          stream: false
        }

        if (structuredOpts) {
          requestBody['text'] = {
            format: {
              type: 'json_schema',
              name: structuredOpts.schemaName,
              schema: structuredOpts.schema,
              strict: structuredOpts.strict
            }
          }
        }

        const response = await createOpenAIResponse(config, requestBody, {
          signal: combined
        })

        const text = extractOpenAIResponseText(response) ?? ''
        if (!text) {
          throw new Error('No response text from model')
        }
        return {
          text,
          usage: response.usage,
          rawProviderUsage: response.usage,
          returnedModel: response.model
        }
      },
      (error) => classifyFetchRetry(error, 'runtime_http_create_conservative')
    )

    const instrumentation = await runWithLLMInstrumentation(prompt, apiCall)
    const metadata = buildStep3Metadata('openai', model, instrumentation, structuredOpts)

    return { result: instrumentation.responseText, metadata }
  } catch (error) {
    l.error(`Failed to run OpenAI model`, error)
    throw error
  }
}
