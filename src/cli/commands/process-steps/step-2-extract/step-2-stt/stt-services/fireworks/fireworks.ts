import * as l from '~/utils/logger'
import { readEnv } from '~/utils/validate/env-utils'

export const setupFireworksStt = async (): Promise<void> => {
  const apiKey = readEnv('FIREWORKS_API_KEY')
  if (apiKey) {
    l.write('success', 'FIREWORKS_API_KEY found — Fireworks transcription ready')
  } else {
    l.warn('FIREWORKS_API_KEY not set — Fireworks transcription will not work until set')
    l.write('info', 'Set FIREWORKS_API_KEY environment variable to use Fireworks transcription')
  }
}

export const ensureFireworksSttSetup = async (): Promise<void> => {
  const apiKey = readEnv('FIREWORKS_API_KEY')
  if (!apiKey) {
    throw new Error('FIREWORKS_API_KEY environment variable is required for Fireworks transcription')
  }
}
