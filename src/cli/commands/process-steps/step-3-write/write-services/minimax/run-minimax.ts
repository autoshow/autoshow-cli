import Anthropic from '@anthropic-ai/sdk'
import * as l from '~/logger'
import type { Step3Metadata } from '~/types'
import { countTokens } from '~/cli/commands/process-steps/step-2-stt/stt-utils/transcription-utils'
import { readEnv } from '~/utils/validate/env-utils'
import { withRetry, classifyFetchRetry } from '~/utils/retries'
import type { StructuredRequestOptions } from '~/cli/commands/process-steps/step-3-write/structured-output/types'

const MINIMAX_ANTHROPIC_BASE_URL = 'https://api.minimax.io/anthropic'

export const runMinimaxModel = async (
  prompt: string,
  model: string,
  structuredOpts?: StructuredRequestOptions
): Promise<{ result: string, metadata: Step3Metadata }> => {
  try {
    const apiKey = readEnv('MINIMAX_API_KEY')
    if (!apiKey) {
      l.error('MINIMAX_API_KEY not found in environment')
      throw new Error('MINIMAX_API_KEY environment variable is required')
    }

    const client = new Anthropic({
      apiKey,
      baseURL: MINIMAX_ANTHROPIC_BASE_URL,
      maxRetries: 0
    })

    const inputTokenCount = countTokens(prompt)
    const startTime = Date.now()

    const responseText = await withRetry(
      { retryClass: 'runtime_http_create_conservative', operationName: 'minimax-llm' },
      async (signal) => {
        const timeoutSignal = AbortSignal.timeout(1800000)
        const combined = AbortSignal.any([...(signal ? [signal] : []), timeoutSignal])

        const message = await client.messages.create(
          {
            model,
            max_tokens: 16000,
            messages: [{ role: 'user', content: prompt }]
          },
          { signal: combined }
        )

        const text = message.content
          .filter(block => block.type === 'text')
          .map(block => block.text)
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
      llmService: 'minimax',
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
    l.error('Failed to run MiniMax model', error)
    throw error
  }
}
