import { readEnv } from '~/utils/validate/env-utils'

export const ensureHumeTtsSetup = async (): Promise<void> => {
  const apiKey = readEnv('HUME_API_KEY')
  if (!apiKey) {
    throw new Error('HUME_API_KEY environment variable is required for Hume TTS')
  }
}
