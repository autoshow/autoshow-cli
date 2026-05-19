import * as l from '~/utils/logger'
import { readEnv } from '~/utils/validate/env-utils'
import type { Step3Metadata, StructuredRequestOptions } from '~/types'
import { runAnthropicCompatibleModel } from '../anthropic-compatible'
import { getAnthropicClientConfig } from '~/cli/commands/process-steps/step-3-write/write-services/anthropic/anthropic-utils'

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

  const config = getAnthropicClientConfig()

  return await runAnthropicCompatibleModel({
    prompt,
    model,
    structuredOpts,
    config,
    service: 'anthropic',
    providerLabel: 'Anthropic',
    operationName: 'anthropic-llm',
    supportsStructuredOutput: true
  })
}
