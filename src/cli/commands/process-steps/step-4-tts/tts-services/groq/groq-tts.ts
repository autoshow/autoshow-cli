import * as l from '~/logger'
import { readEnvFallback } from '~/utils/validate/env-utils'

export const setupGroqTts = async (): Promise<void> => {
  const apiKey = readEnvFallback('GROQ_API_KEY')
  if (apiKey) {
    l.success('GROQ_API_KEY found — Groq TTS ready')
  } else {
    l.warn('GROQ_API_KEY not set — Groq TTS will not work until set')
    l.info('Set GROQ_API_KEY environment variable to use Groq TTS')
  }
}

export const ensureGroqTtsSetup = async (): Promise<void> => {
  const apiKey = readEnvFallback('GROQ_API_KEY')
  if (!apiKey) {
    throw new Error('GROQ_API_KEY environment variable is required for Groq TTS')
  }
}
