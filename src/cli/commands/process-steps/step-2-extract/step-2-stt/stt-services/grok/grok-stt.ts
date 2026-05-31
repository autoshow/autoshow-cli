import { readEnv } from '~/utils/validate/env-utils'

export const ensureGrokSttSetup = async (): Promise<void> => {
  const apiKey = readEnv('XAI_API_KEY')
  if (!apiKey) {
    throw new Error('XAI_API_KEY environment variable is required for Grok STT')
  }
}
