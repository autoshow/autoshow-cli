import { readEnv } from '~/utils/validate/env-utils'

export const ensureSonioxSttSetup = async (): Promise<void> => {
  const apiKey = readEnv('SONIOX_API_KEY')
  if (!apiKey) {
    throw new Error('SONIOX_API_KEY environment variable is required for Soniox transcription')
  }
}
