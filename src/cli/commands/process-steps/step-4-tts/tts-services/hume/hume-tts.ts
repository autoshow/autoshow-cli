import * as l from '~/utils/logger'
import { readEnv } from '~/utils/validate/env-utils'

export const setupHumeTts = async (): Promise<void> => {
  const apiKey = readEnv('HUME_API_KEY')
  if (apiKey) {
    l.write('success', 'HUME_API_KEY found - Hume TTS ready')
  } else {
    l.warn('HUME_API_KEY not set - Hume TTS will not work until set')
    l.write('info', 'Set HUME_API_KEY environment variable to use Hume TTS models')
  }
}

export const ensureHumeTtsSetup = async (): Promise<void> => {
  const apiKey = readEnv('HUME_API_KEY')
  if (!apiKey) {
    throw new Error('HUME_API_KEY environment variable is required for Hume TTS')
  }
}
