import { readEnv } from '~/utils/validate/env-utils'

export const ensureSpeechifyTtsSetup = async (): Promise<void> => {
  const apiKey = readEnv('SPEECHIFY_API_KEY')
  if (!apiKey) {
    throw new Error('SPEECHIFY_API_KEY environment variable is required for Speechify TTS')
  }
}
