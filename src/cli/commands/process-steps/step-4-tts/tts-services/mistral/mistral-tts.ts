import * as l from '~/utils/logger'
import { readEnv } from '~/utils/validate/env-utils'

export const setupMistralTts = async (): Promise<void> => {
  const apiKey = readEnv('MISTRAL_API_KEY')
  if (apiKey) {
    l.write('success', 'MISTRAL_API_KEY found - Mistral TTS ready')
  } else {
    l.warn('MISTRAL_API_KEY not set - Mistral TTS will not work until set')
    l.write('info', 'Set MISTRAL_API_KEY plus MISTRAL_TTS_VOICE or MISTRAL_TTS_REF_AUDIO to use Mistral TTS')
  }
}

export const ensureMistralTtsSetup = async (): Promise<void> => {
  const apiKey = readEnv('MISTRAL_API_KEY')
  if (!apiKey) {
    throw new Error('MISTRAL_API_KEY environment variable is required for Mistral TTS')
  }
}
