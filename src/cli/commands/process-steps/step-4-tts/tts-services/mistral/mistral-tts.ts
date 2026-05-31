import { readEnv } from '~/utils/validate/env-utils'

export const ensureMistralTtsSetup = async (): Promise<void> => {
  const apiKey = readEnv('MISTRAL_API_KEY')
  if (!apiKey) {
    throw new Error('MISTRAL_API_KEY environment variable is required for Mistral TTS')
  }
}
