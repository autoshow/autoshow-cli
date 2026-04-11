import OpenAI from 'openai'
import * as l from '~/logger'
import type { Step3Metadata } from '~/types'
import { withRetry, classifyFetchRetry } from '~/utils/retries'
import type { StructuredRequestOptions } from '~/cli/commands/process-steps/step-3-write/structured-output/types'
import { isStructuredFallbackError } from '~/cli/commands/process-steps/step-3-write/write-utils/structured-error-utils'
import { runWithLLMInstrumentation, buildStep3Metadata } from '~/cli/commands/process-steps/step-3-write/write-utils/llm-instrumentation'

type OpenAICompatibleChatService = Extract<Step3Metadata['llmService'], 'groq' | 'grok'>

type RunOpenAICompatibleChatModelOptions = {
  prompt: string
  model: string
  structuredOpts?: StructuredRequestOptions | undefined
  client: OpenAI
  service: OpenAICompatibleChatService
  providerLabel: string
  operationName: string
  customizeRequestBody?: ((requestBody: Record<string, unknown>, model: string) => void) | undefined
}

const createCombinedSignal = (signal?: AbortSignal): AbortSignal => {
  const timeoutSignal = AbortSignal.timeout(1800000)
  return AbortSignal.any([...(signal ? [signal] : []), timeoutSignal])
}

export const runOpenAICompatibleChatModel = async ({
  prompt,
  model,
  structuredOpts,
  client,
  service,
  providerLabel,
  operationName,
  customizeRequestBody
}: RunOpenAICompatibleChatModelOptions): Promise<{ result: string, metadata: Step3Metadata }> => {
  try {
    const apiCall = (): Promise<string> => withRetry(
      { retryClass: 'runtime_http_create_conservative', operationName },
      async (signal) => {
        const requestBody: Record<string, unknown> = {
          model,
          messages: [{ role: 'user', content: prompt }]
        }
        customizeRequestBody?.(requestBody, model)

        const executeRequest = async (body: Record<string, unknown>): Promise<string> => {
          const response = await client.chat.completions.create(body as any, {
            signal: createCombinedSignal(signal)
          })

          const text = response.choices[0]?.message?.content ?? ''
          if (!text) {
            throw new Error('No response text from model')
          }
          return text
        }

        if (!structuredOpts) {
          return await executeRequest(requestBody)
        }

        const structuredRequestBody: Record<string, unknown> = {
          ...requestBody,
          response_format: {
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

    const { responseText, inputTokenCount, outputTokenCount, processingTime } = await runWithLLMInstrumentation(prompt, apiCall)
    const metadata = buildStep3Metadata(service, model, { processingTime, inputTokenCount, outputTokenCount }, structuredOpts)

    return { result: responseText, metadata }
  } catch (error) {
    l.error(`Failed to run ${providerLabel} model`, error)
    throw error
  }
}
