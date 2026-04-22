import * as l from '~/logger'
import { readEnv } from '~/utils/validate/env-utils'
import type { Step3Metadata, StructuredRequestOptions } from '~/types'
import { runAnthropicCompatibleModel } from '../anthropic-compatible'
import { createAnthropicClient } from '~/utils/anthropic-utils'

export const runAnthropicModel = async (
  prompt: string,
  model: string,
  structuredOpts?: StructuredRequestOptions
): Promise<{ result: string, metadata: Step3Metadata }> => {
  const apiKey = readEnv('ANTHROPIC_API_KEY')
  if (!apiKey) {
    l.error(`ANTHROPIC_API_KEY not found in environment`)
    throw new Error('ANTHROPIC_API_KEY environment variable is required')
  }

  const client = createAnthropicClient()

  return await runAnthropicCompatibleModel({
    prompt,
    model,
    structuredOpts,
    client,
    service: 'anthropic',
    providerLabel: 'Anthropic',
    operationName: 'anthropic-llm',
    supportsStructuredOutput: true
  })
}

export const checkAnthropicHealth = async (): Promise<boolean> => {
  try {
    const apiKey = readEnv('ANTHROPIC_API_KEY')
    if (!apiKey) return false

    const client = createAnthropicClient()
    await client.models.list()
    return true
  } catch (error) {
    l.error(`Anthropic health check failed`, error)
    return false
  }
}
