import { readEnv } from '~/utils/validate/env-utils'

export const ensureTogetherSttSetup = async (): Promise<void> => {
  const apiKey = readEnv('TOGETHER_API_KEY')
  if (!apiKey) {
    throw new Error('TOGETHER_API_KEY environment variable is required for Together transcription')
  }
}
