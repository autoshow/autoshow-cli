import * as l from '~/logger'
import { readEnv } from '~/utils/validate/env-utils'

export const setupGroqStt = async (): Promise<void> => {
  const apiKey = readEnv('GROQ_API_KEY')
  if (apiKey) {
    l.success('GROQ_API_KEY found — Groq transcription ready')
  } else {
    l.warn('GROQ_API_KEY not set — Groq transcription will not work until set')
    l.info('Set GROQ_API_KEY environment variable to use Groq transcription')
  }
}

export const ensureGroqSttSetup = async (): Promise<void> => {
  const apiKey = readEnv('GROQ_API_KEY')
  if (!apiKey) {
    throw new Error('GROQ_API_KEY environment variable is required for Groq STT models')
  }
}
