import * as l from '~/utils/logger'
import { readEnv } from '~/utils/validate/env-utils'

export const setupCartesiaTts = async (): Promise<void> => {
  const apiKey = readEnv('CARTESIA_API_KEY')
  if (apiKey) {
    l.write('success', 'CARTESIA_API_KEY found - Cartesia TTS ready')
  } else {
    l.warn('CARTESIA_API_KEY not set - Cartesia TTS will not work until set')
    l.write('info', 'Set CARTESIA_API_KEY environment variable to use Cartesia TTS models')
  }
}

export const ensureCartesiaTtsSetup = async (): Promise<void> => {
  const apiKey = readEnv('CARTESIA_API_KEY')
  if (!apiKey) {
    throw new Error('CARTESIA_API_KEY environment variable is required for Cartesia TTS')
  }
}
