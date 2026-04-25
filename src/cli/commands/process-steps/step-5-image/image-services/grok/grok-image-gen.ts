import * as l from '~/utils/logger'
import { readEnv } from '~/utils/validate/env-utils'

export const setupGrokImageGen = async (): Promise<void> => {
  const apiKey = readEnv('XAI_API_KEY')
  if (apiKey) {
    l.write('success', 'XAI_API_KEY found — Grok image generation ready')
  } else {
    l.warn('XAI_API_KEY not set — Grok image generation will not work until set')
    l.write('info', 'Set XAI_API_KEY environment variable to use Grok image models')
  }
}

export const ensureGrokImageGenSetup = async (): Promise<void> => {
  const apiKey = readEnv('XAI_API_KEY')
  if (!apiKey) {
    throw new Error('XAI_API_KEY environment variable is required for Grok image generation')
  }
}
