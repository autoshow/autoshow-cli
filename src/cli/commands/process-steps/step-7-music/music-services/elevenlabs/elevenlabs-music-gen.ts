import { readEnv } from '~/utils/validate/env-utils'

export const ensureElevenLabsMusicGenSetup = async (): Promise<void> => {
  const apiKey = readEnv('ELEVENLABS_API_KEY')
  if (!apiKey) {
    throw new Error('ELEVENLABS_API_KEY environment variable is required for ElevenLabs music generation')
  }
}
