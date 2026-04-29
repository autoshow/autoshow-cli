import * as l from '~/utils/logger'
import { readEnv } from '~/utils/validate/env-utils'

export const setupGrokTts = async (): Promise<void> => {
  const apiKey = readEnv('XAI_API_KEY')
  if (apiKey) {
    l.write('success', 'XAI_API_KEY found - Grok TTS ready')
  } else {
    l.warn('XAI_API_KEY not set - Grok TTS will not work until set')
    l.write('info', 'Set XAI_API_KEY environment variable to use Grok TTS')
  }
}

export const ensureGrokTtsSetup = async (): Promise<void> => {
  const apiKey = readEnv('XAI_API_KEY')
  if (!apiKey) {
    throw new Error('XAI_API_KEY environment variable is required for Grok TTS')
  }
}
