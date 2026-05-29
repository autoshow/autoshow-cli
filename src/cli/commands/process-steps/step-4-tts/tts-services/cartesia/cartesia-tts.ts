import { readEnv } from '~/utils/validate/env-utils'

export const ensureCartesiaTtsSetup = async (): Promise<void> => {
  const apiKey = readEnv('CARTESIA_API_KEY')
  if (!apiKey) {
    throw new Error('CARTESIA_API_KEY environment variable is required for Cartesia TTS')
  }
}
