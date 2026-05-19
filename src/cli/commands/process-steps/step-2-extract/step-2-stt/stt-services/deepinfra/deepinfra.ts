import { readEnv } from '~/utils/validate/env-utils'

export const ensureDeepinfraSttSetup = async (): Promise<void> => {
  const apiKey = readEnv('DEEPINFRA_API_KEY')
  if (!apiKey) {
    throw new Error('DEEPINFRA_API_KEY environment variable is required for DeepInfra transcription')
  }
}
