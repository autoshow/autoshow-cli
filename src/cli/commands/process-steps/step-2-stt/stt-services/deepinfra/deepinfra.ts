import * as l from '~/logger'
import { readEnv } from '~/utils/validate/env-utils'

export const setupDeepinfraStt = async (): Promise<void> => {
  const apiKey = readEnv('DEEPINFRA_API_KEY')
  if (apiKey) {
    l.write('success', 'DEEPINFRA_API_KEY found — DeepInfra transcription ready')
  } else {
    l.warn('DEEPINFRA_API_KEY not set — DeepInfra transcription will not work until set')
    l.write('info', 'Set DEEPINFRA_API_KEY environment variable to use DeepInfra transcription')
  }
}

export const ensureDeepinfraSttSetup = async (): Promise<void> => {
  const apiKey = readEnv('DEEPINFRA_API_KEY')
  if (!apiKey) {
    throw new Error('DEEPINFRA_API_KEY environment variable is required for DeepInfra transcription')
  }
}
