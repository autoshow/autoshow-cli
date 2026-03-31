import OpenAI from 'openai'
import * as l from '~/logger'
import type { Step3Metadata } from '~/types'
import { readEnv, readEnvFallback } from '~/utils/validate/env-utils'
import { withRetry, classifyFetchRetry } from '~/utils/retries'
import type { StructuredRequestOptions } from '~/cli/commands/process-steps/step-3-write/structured-output/types'
import { isStructuredFallbackError } from '~/cli/commands/process-steps/step-3-write/write-utils/structured-error-utils'
import { runWithLLMInstrumentation, buildStep3Metadata } from '~/cli/commands/process-steps/step-3-write/write-utils/llm-instrumentation'

const getGrokClientConfig = (): { apiKey: string, baseURL: string } => {
  const apiKey = readEnvFallback('XAI_API_KEY')
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
  try {
    const config = getGrokClientConfig()
    const client = new OpenAI({ apiKey: config.apiKey, baseURL: config.baseURL, maxRetries: 0 })

    const apiCall = (): Promise<string> => withRetry(
      { retryClass: 'runtime_http_create_conservative', operationName: 'grok-llm' },
      async (signal) => {
        const timeoutSignal = AbortSignal.timeout(1800000)
        const combined = AbortSignal.any([...(signal ? [signal] : []), timeoutSignal])

        const requestBody: Record<string, unknown> = {
          model,
          messages: [{ role: 'user', content: prompt }]
        }

        const executeRequest = async (body: Record<string, unknown>): Promise<string> => {
          const response = await client.chat.completions.create(body as any, {
            signal: combined
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
          l.warn(`Grok structured output failed for ${model}; retrying without response_format`)
          return await executeRequest(requestBody)
        }
      },
      (error) => classifyFetchRetry(error, 'runtime_http_create_conservative')
    )

    const { responseText, inputTokenCount, outputTokenCount, processingTime } = await runWithLLMInstrumentation(prompt, apiCall)
    const metadata = buildStep3Metadata('grok', model, { processingTime, inputTokenCount, outputTokenCount }, structuredOpts)

    return { result: responseText, metadata }
  } catch (error) {
    l.error('Failed to run Grok model', error)
    throw error
  }
}
