import * as l from '~/utils/logger'
import { readEnv } from '~/utils/validate/env-utils'

export const setupRunwayTts = async (): Promise<void> => {
  const apiKey = readEnv('RUNWAYML_API_SECRET')
  if (apiKey) {
    l.write('success', 'RUNWAYML_API_SECRET found - Runway TTS ready')
  } else {
    l.warn('RUNWAYML_API_SECRET not set - Runway TTS will not work until set')
    l.write('info', 'Set RUNWAYML_API_SECRET environment variable to use Runway TTS models')
  }
}

export const ensureRunwayTtsSetup = async (): Promise<void> => {
  const apiKey = readEnv('RUNWAYML_API_SECRET')
  if (!apiKey) {
    throw new Error('RUNWAYML_API_SECRET environment variable is required for Runway TTS')
  }
}
