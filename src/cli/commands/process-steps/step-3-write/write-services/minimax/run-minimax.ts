import Anthropic from '@anthropic-ai/sdk'
import * as l from '~/logger'
import { readEnv } from '~/utils/validate/env-utils'
import type { Step3Metadata, StructuredRequestOptions } from '~/types'
import { runAnthropicCompatibleModel } from '../anthropic-compatible'

const MINIMAX_ANTHROPIC_BASE_URL = 'https://api.minimax.io/anthropic'

export const runMinimaxModel = async (
  prompt: string,
  model: string,
  structuredOpts?: StructuredRequestOptions
): Promise<{ result: string, metadata: Step3Metadata }> => {
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

  return await runAnthropicCompatibleModel({
    prompt,
    model,
    structuredOpts,
    client,
    service: 'minimax',
    providerLabel: 'MiniMax',
    operationName: 'minimax-llm'
  })
}
