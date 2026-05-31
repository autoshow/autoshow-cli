import { readEnv } from '~/utils/validate/env-utils'

export const ensureDeepgramTtsSetup = async (): Promise<void> => {
  const apiKey = readEnv('DEEPGRAM_API_KEY')
  if (!apiKey) {
    throw new Error('DEEPGRAM_API_KEY environment variable is required for Deepgram TTS')
  }
}
