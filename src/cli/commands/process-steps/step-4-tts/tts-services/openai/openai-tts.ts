import * as l from '~/logger'
import { readEnvFallback } from '~/utils/validate/env-utils'

export const setupOpenAITts = async (): Promise<void> => {
  const apiKey = readEnvFallback('OPENAI_API_KEY', 'NITRO_OPENAI_API_KEY')
  if (apiKey) {
    l.success('OPENAI_API_KEY found — OpenAI TTS ready')
  } else {
    l.warn('OPENAI_API_KEY not set — OpenAI TTS will not work until set')
    l.info('Set OPENAI_API_KEY environment variable to use OpenAI TTS')
  }
}

export const ensureOpenAITtsSetup = async (): Promise<void> => {
  const apiKey = readEnvFallback('OPENAI_API_KEY', 'NITRO_OPENAI_API_KEY')
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY environment variable is required for OpenAI TTS')
  }
}
