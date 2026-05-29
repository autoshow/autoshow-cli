import { readEnv } from '~/utils/validate/env-utils'

export const ensureOpenAIOcrSetup = async (): Promise<void> => {
  const apiKey = readEnv('OPENAI_API_KEY')
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY environment variable is required for OpenAI OCR')
  }
}
