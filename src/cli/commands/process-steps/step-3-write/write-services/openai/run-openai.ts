import OpenAI from 'openai'
import * as l from '~/utils/logger'
import type { Step3Metadata, StructuredRequestOptions } from '~/types'
import { runWithLLMInstrumentation, buildStep3Metadata } from '~/cli/commands/process-steps/step-3-write/write-utils/llm-instrumentation'
import { withRetry, classifyFetchRetry } from '~/utils/retries'
import { getOpenAIClientConfig } from '~/cli/commands/process-steps/step-3-write/write-services/openai/openai-utils'

export const runOpenAIModel = async (
  prompt: string,
  model: string,
  structuredOpts?: StructuredRequestOptions
): Promise<{ result: string, metadata: Step3Metadata }> => {
  try {
    const config = getOpenAIClientConfig()
    const client = new OpenAI({ apiKey: config.apiKey, maxRetries: 0, ...(config.baseURL ? { baseURL: config.baseURL } : {}) })

    const apiCall = (): Promise<string> => withRetry(
      { retryClass: 'runtime_http_create_conservative', operationName: 'openai-llm' },
      async (signal) => {
        const timeoutSignal = AbortSignal.timeout(1800000)
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

        const response = await client.responses.create(requestBody as any, {
          signal: combined
        })

        const text = response.output_text || ''
        if (!text) {
          throw new Error('No response text from model')
        }
        return text
      },
      (error) => classifyFetchRetry(error, 'runtime_http_create_conservative')
    )

    const { responseText, inputTokenCount, outputTokenCount, processingTime } = await runWithLLMInstrumentation(prompt, apiCall)
    const metadata = buildStep3Metadata('openai', model, { processingTime, inputTokenCount, outputTokenCount }, structuredOpts)

    return { result: responseText, metadata }
  } catch (error) {
    l.error(`Failed to run OpenAI model`, error)
    throw error
  }
}
