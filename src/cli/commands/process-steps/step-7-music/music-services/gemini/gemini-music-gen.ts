import * as l from '~/utils/logger'
import { readEnv } from '~/utils/validate/env-utils'

export const setupGeminiMusicGen = async (): Promise<void> => {
  const apiKey = readEnv('GEMINI_API_KEY')
  if (apiKey) {
    l.write('success', 'GEMINI_API_KEY found — Gemini music generation ready')
  } else {
    l.warn('GEMINI_API_KEY not set — Gemini music generation will not work until set')
    l.write('info', 'Set GEMINI_API_KEY environment variable to use Gemini Lyria music generation')
  }
}

export const ensureGeminiMusicGenSetup = async (): Promise<void> => {
  const apiKey = readEnv('GEMINI_API_KEY')
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY environment variable is required for Gemini music generation')
  }
}
