import { readEnv } from '~/utils/validate/env-utils'

export const ensureGeminiMusicGenSetup = async (): Promise<void> => {
  const apiKey = readEnv('GEMINI_API_KEY')
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY environment variable is required for Gemini music generation')
  }
}
