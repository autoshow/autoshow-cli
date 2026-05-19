import * as l from '~/utils/logger'
import { readEnv } from '~/utils/validate/env-utils'

export const setupSpeechifyTts = async (): Promise<void> => {
  const apiKey = readEnv('SPEECHIFY_API_KEY')
  if (apiKey) {
    l.write('success', 'SPEECHIFY_API_KEY found - Speechify TTS ready')
  } else {
    l.warn('SPEECHIFY_API_KEY not set - Speechify TTS will not work until set')
    l.write('info', 'Set SPEECHIFY_API_KEY environment variable to use Speechify TTS models')
  }
}

export const ensureSpeechifyTtsSetup = async (): Promise<void> => {
  const apiKey = readEnv('SPEECHIFY_API_KEY')
  if (!apiKey) {
    throw new Error('SPEECHIFY_API_KEY environment variable is required for Speechify TTS')
  }
}
