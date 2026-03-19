import OpenAI from 'openai'
import * as l from '~/logger'
import type { Step3Metadata } from '~/types'
import { countTokens } from '~/cli/commands/process-steps/step-2-stt/stt-utils/transcription-utils'
import { readEnv, readEnvFallback } from '~/utils/validate/env-utils'
import { withRetry, classifyFetchRetry } from '~/utils/retries'
import type { StructuredRequestOptions } from '~/cli/commands/process-steps/step-3-write/structured-output/types'

const getGroqClientConfig = (): { apiKey: string, baseURL: string } => {
  const apiKey = readEnvFallback('GROQ_API_KEY')
  if (!apiKey) {
    l.error('GROQ_API_KEY not found in environment for Groq model')
    throw new Error('GROQ_API_KEY environment variable is required for --groq models')
  }

  const baseURL = readEnv('GROQ_BASE_URL') ?? 'https://api.groq.com/openai/v1'
  return { apiKey, baseURL }
}

const toRecord = (value: unknown): Record<string, unknown> | undefined =>
  typeof value === 'object' && value !== null ? value as Record<string, unknown> : undefined

const getStringField = (obj: Record<string, unknown> | undefined, key: string): string | undefined => {
  if (!obj) return undefined
  const value = obj[key]
  return typeof value === 'string' ? value : undefined
}

const getNumberField = (obj: Record<string, unknown> | undefined, key: string): number | undefined => {
  if (!obj) return undefined
  const value = obj[key]
  return typeof value === 'number' ? value : undefined
}

const isStructuredFallbackError = (error: unknown): boolean => {
  const root = toRecord(error)
  const nested = toRecord(root?.['error'])

  const status = getNumberField(root, 'status')
  if (status !== 400 && status !== 422) return false

  const code = getStringField(root, 'code') ?? getStringField(nested, 'code')
  const param = getStringField(nested, 'param')
  const message = (getStringField(root, 'message') ?? '').toLowerCase()
  const nestedMessage = (getStringField(nested, 'message') ?? '').toLowerCase()
  const combinedMessage = `${message} ${nestedMessage}`

  if (code === 'json_validate_failed') return true
  if (param === 'response_format') return true

  return (
    combinedMessage.includes('response_format') ||
    combinedMessage.includes('json schema') ||
    combinedMessage.includes('failed to validate json') ||
    combinedMessage.includes('generated json does not match')
  )
}

export const runGroqModel = async (
  prompt: string,
  model: string,
  structuredOpts?: StructuredRequestOptions
): Promise<{ result: string, metadata: Step3Metadata }> => {
  try {
    const config = getGroqClientConfig()
    const client = new OpenAI({ apiKey: config.apiKey, baseURL: config.baseURL, maxRetries: 0 })

    const inputTokenCount = countTokens(prompt)
    const startTime = Date.now()

    const responseText = await withRetry(
      { retryClass: 'runtime_http_create_conservative', operationName: 'groq-llm' },
      async (signal) => {
        const timeoutSignal = AbortSignal.timeout(1800000)
        const combined = AbortSignal.any([...(signal ? [signal] : []), timeoutSignal])

        const requestBody: Record<string, unknown> = {
          model,
          messages: [{ role: 'user', content: prompt }]
        }
        if (model.startsWith('openai/gpt-oss-')) {
          requestBody['reasoning_effort'] = 'low'
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
          l.warn(`Groq structured output failed for ${model}; retrying without response_format`)
          return await executeRequest(requestBody)
        }
      },
      (error) => classifyFetchRetry(error, 'runtime_http_create_conservative')
    )

    const processingTime = Date.now() - startTime
    const outputTokenCount = countTokens(responseText)

    const metadata: Step3Metadata = {
      llmService: 'groq',
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
    l.error('Failed to run Groq model', error)
    throw error
  }
}
