import { readEnv } from '~/utils/validate/env-utils'

export const getGeminiApiKey = (): string => {
  const apiKey = readEnv('GEMINI_API_KEY')
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY environment variable is required')
  }
  return apiKey
}
