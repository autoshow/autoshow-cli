import * as l from '~/logger'
import { readEnv } from '~/utils/validate/env-utils'

export const setupSonioxStt = async (): Promise<void> => {
  const apiKey = readEnv('SONIOX_API_KEY')
  if (apiKey) {
    l.write('success', 'SONIOX_API_KEY found — Soniox transcription ready')
  } else {
    l.warn('SONIOX_API_KEY not set — Soniox transcription will not work until set')
    l.write('info', 'Set SONIOX_API_KEY environment variable to use Soniox transcription')
  }
}

export const ensureSonioxSttSetup = async (): Promise<void> => {
  const apiKey = readEnv('SONIOX_API_KEY')
  if (!apiKey) {
    throw new Error('SONIOX_API_KEY environment variable is required for Soniox transcription')
  }
}
