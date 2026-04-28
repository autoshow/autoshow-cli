import { readEnv } from '~/utils/validate/env-utils'

export const ensureGroqSttSetup = async (): Promise<void> => {
  const apiKey = readEnv('GROQ_API_KEY')
  if (!apiKey) {
    throw new Error('GROQ_API_KEY environment variable is required for Groq STT models')
  }
}
