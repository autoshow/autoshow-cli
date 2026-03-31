import Anthropic from '@anthropic-ai/sdk'
import * as l from '~/logger'
import type { Step3Metadata } from '~/types'
import { readEnv } from '~/utils/validate/env-utils'
import { withRetry, classifyFetchRetry } from '~/utils/retries'
import type { StructuredRequestOptions } from '~/cli/commands/process-steps/step-3-write/structured-output/types'
import { runWithLLMInstrumentation, buildStep3Metadata } from '~/cli/commands/process-steps/step-3-write/write-utils/llm-instrumentation'

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

    const apiCall = (): Promise<string> => withRetry(
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

    const { responseText, inputTokenCount, outputTokenCount, processingTime } = await runWithLLMInstrumentation(prompt, apiCall)
    const metadata = buildStep3Metadata('minimax', model, { processingTime, inputTokenCount, outputTokenCount }, structuredOpts)

    return { result: responseText, metadata }
  } catch (error) {
    l.error('Failed to run MiniMax model', error)
    throw error
  }
}
