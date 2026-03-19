import Anthropic from '@anthropic-ai/sdk'
import * as l from '~/logger'
import type { Step3Metadata } from '~/types'
import { countTokens } from '~/cli/commands/process-steps/step-2-stt/stt-utils/transcription-utils'
import { readEnvFallback } from '~/utils/validate/env-utils'
import { withRetry, classifyFetchRetry } from '~/utils/retries'
import type { StructuredRequestOptions } from '~/cli/commands/process-steps/step-3-write/structured-output/types'

export const runAnthropicModel = async (
  prompt: string,
  model: string,
  structuredOpts?: StructuredRequestOptions
): Promise<{ result: string, metadata: Step3Metadata }> => {
  try {
    const apiKey = readEnvFallback('ANTHROPIC_API_KEY', 'NITRO_ANTHROPIC_API_KEY')
    if (!apiKey) {
      l.error(`ANTHROPIC_API_KEY not found in environment`)
      throw new Error('ANTHROPIC_API_KEY environment variable is required')
    }

    const client = new Anthropic({ apiKey, maxRetries: 0 })

    const inputTokenCount = countTokens(prompt)
    const startTime = Date.now()

    const responseText = await withRetry(
      { retryClass: 'runtime_http_create_conservative', operationName: 'anthropic-llm' },
      async (signal) => {
        const timeoutSignal = AbortSignal.timeout(1800000)
        const combined = AbortSignal.any([...(signal ? [signal] : []), timeoutSignal])

        const requestBody: Record<string, unknown> = {
          model,
          max_tokens: 16000,
          messages: [{ role: 'user', content: prompt }]
        }

        if (structuredOpts) {
          requestBody['output_config'] = {
            format: {
              type: 'json_schema',
              schema: structuredOpts.schema
            }
          }
        }

        const message = await client.messages.create(requestBody as any, { signal: combined })

        const text = message.content
          .filter(block => block.type === 'text')
          .map(block => (block as { type: 'text'; text: string }).text)
          .join('')

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
      llmService: 'anthropic',
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
    l.error(`Failed to run Anthropic model`, error)
    throw error
  }
}

export const checkAnthropicHealth = async (): Promise<boolean> => {
  try {
    const apiKey = readEnvFallback('ANTHROPIC_API_KEY', 'NITRO_ANTHROPIC_API_KEY')
    if (!apiKey) return false

    const client = new Anthropic({ apiKey, maxRetries: 0 })
    await client.models.list()
    return true
  } catch (error) {
    l.error(`Anthropic health check failed`, error)
    return false
  }
}
