import * as l from '~/utils/logger'
import { readEnv } from '~/utils/validate/env-utils'

export const setupDeepgramTts = async (): Promise<void> => {
  const apiKey = readEnv('DEEPGRAM_API_KEY')
  if (apiKey) {
    l.write('success', 'DEEPGRAM_API_KEY found — Deepgram TTS ready')
  } else {
    l.warn('DEEPGRAM_API_KEY not set — Deepgram TTS will not work until set')
    l.write('info', 'Set DEEPGRAM_API_KEY environment variable to use Deepgram TTS')
  }
}

export const ensureDeepgramTtsSetup = async (): Promise<void> => {
  const apiKey = readEnv('DEEPGRAM_API_KEY')
  if (!apiKey) {
    throw new Error('DEEPGRAM_API_KEY environment variable is required for Deepgram TTS')
  }
}
