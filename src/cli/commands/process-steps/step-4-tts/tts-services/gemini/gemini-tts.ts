import * as l from '~/logger'
import { readEnv } from '~/utils/validate/env-utils'

export const setupGeminiTts = async (): Promise<void> => {
  const apiKey = readEnv('GEMINI_API_KEY')
  if (apiKey) {
    l.success('GEMINI_API_KEY found — Gemini TTS ready')
  } else {
    l.warn('GEMINI_API_KEY not set — Gemini TTS will not work until set')
    l.info('Set GEMINI_API_KEY environment variable to use Gemini TTS')
  }
}

export const ensureGeminiTtsSetup = async (): Promise<void> => {
  const apiKey = readEnv('GEMINI_API_KEY')
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY environment variable is required for Gemini TTS')
  }
}
