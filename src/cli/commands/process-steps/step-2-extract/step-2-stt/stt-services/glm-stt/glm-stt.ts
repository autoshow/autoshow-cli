import { readEnv } from '~/utils/validate/env-utils'

export const ensureGlmSttSetup = async (): Promise<void> => {
  const apiKey = readEnv('GLM_API_KEY')
  if (!apiKey) {
    throw new Error('GLM_API_KEY environment variable is required for GLM transcription')
  }
}
