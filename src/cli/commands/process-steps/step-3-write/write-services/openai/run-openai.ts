import OpenAI from 'openai'
import * as l from '~/logger'
import type { Step3Metadata } from '~/types'
import { countTokens } from '~/cli/commands/process-steps/step-2-stt/stt-utils/transcription-utils'
import { readEnvFallback, readEnv } from '~/utils/validate/env-utils'
import { withRetry, classifyFetchRetry } from '~/utils/retries'
import type { StructuredRequestOptions } from '~/cli/commands/process-steps/step-3-write/structured-output/types'

const getClientConfig = (): { apiKey: string, baseURL?: string } => {
  const apiKey = readEnvFallback('OPENAI_API_KEY', 'NITRO_OPENAI_API_KEY')
  if (!apiKey) {
    l.error(`OPENAI_API_KEY not found in environment`)
    throw new Error('OPENAI_API_KEY environment variable is required')
  }

  const baseURL = readEnv('OPENAI_BASE_URL')
  return baseURL ? { apiKey, baseURL } : { apiKey }
}

export const runOpenAIModel = async (
  prompt: string,
  model: string,
  structuredOpts?: StructuredRequestOptions
): Promise<{ result: string, metadata: Step3Metadata }> => {
  try {
    const config = getClientConfig()
    const client = new OpenAI({ apiKey: config.apiKey, maxRetries: 0, ...(config.baseURL ? { baseURL: config.baseURL } : {}) })

    const inputTokenCount = countTokens(prompt)
    const startTime = Date.now()

    const responseText = await withRetry(
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

    const processingTime = Date.now() - startTime
    const outputTokenCount = countTokens(responseText)

    const metadata: Step3Metadata = {
      llmService: 'openai',
      llmModel: model,
      processingTime,
      inputTokenCount,
      outputTokenCount,
      outputFileName: '',
      outputFormat: structuredOpts ? 'json' : 'markdown',
      structuredMode: structuredOpts?.modeHint ?? 'off',
      structuredPresetNames: []
    }

    return { result: responseText, metadata }
  } catch (error) {
    l.error(`Failed to run OpenAI model`, error)
    throw error
  }
}

export const checkOpenAIHealth = async (): Promise<boolean> => {
  try {
    const config = getClientConfig()
    const client = new OpenAI({ apiKey: config.apiKey, maxRetries: 0, ...(config.baseURL ? { baseURL: config.baseURL } : {}) })

    await client.models.list()
    return true
  } catch (error) {
    l.error(`OpenAI health check failed`, error)
    return false
  }
}
