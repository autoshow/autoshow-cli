import * as l from '~/utils/logger'
import { readEnv } from '~/utils/validate/env-utils'

export const setupGeminiStt = async (): Promise<void> => {
  const apiKey = readEnv('GEMINI_API_KEY')
  if (apiKey) {
    l.write('success', 'GEMINI_API_KEY found - Gemini transcription ready')
  } else {
    l.warn('GEMINI_API_KEY not set - Gemini transcription will not work until set')
    l.write('info', 'Set GEMINI_API_KEY environment variable to use Gemini transcription')
  }
}

export const ensureGeminiSttSetup = async (): Promise<void> => {
  const apiKey = readEnv('GEMINI_API_KEY')
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY environment variable is required for Gemini transcription')
  }
}
