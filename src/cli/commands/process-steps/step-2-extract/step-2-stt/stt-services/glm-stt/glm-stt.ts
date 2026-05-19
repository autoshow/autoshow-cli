import * as l from '~/utils/logger'
import { readEnv } from '~/utils/validate/env-utils'

export const setupGlmStt = async (): Promise<void> => {
  const apiKey = readEnv('GLM_API_KEY')
  if (apiKey) {
    l.write('success', 'GLM_API_KEY found - GLM transcription ready')
  } else {
    l.warn('GLM_API_KEY not set - GLM transcription will not work until set')
    l.write('info', 'Set GLM_API_KEY environment variable to use GLM transcription')
  }
}

export const ensureGlmSttSetup = async (): Promise<void> => {
  const apiKey = readEnv('GLM_API_KEY')
  if (!apiKey) {
    throw new Error('GLM_API_KEY environment variable is required for GLM transcription')
  }
}
