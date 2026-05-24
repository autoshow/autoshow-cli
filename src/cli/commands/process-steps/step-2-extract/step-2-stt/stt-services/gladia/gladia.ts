import * as l from '~/utils/logger'
import { GLADIA_DEFAULT_BASE_URL } from '~/utils/base-urls'
import { readEnv } from '~/utils/validate/env-utils'

export const getGladiaBaseUrl = (): string => GLADIA_DEFAULT_BASE_URL

export const setupGladiaStt = async (): Promise<void> => {
  const apiKey = readEnv('GLADIA_API_KEY')
  if (apiKey) {
    l.write('success', `GLADIA_API_KEY found — Gladia transcription ready (${getGladiaBaseUrl()})`)
  } else {
    l.warn('GLADIA_API_KEY not set — Gladia transcription will not work until set')
    l.write('info', 'Set GLADIA_API_KEY environment variable to use Gladia transcription')
  }
}

export const ensureGladiaSttSetup = async (): Promise<void> => {
  const apiKey = readEnv('GLADIA_API_KEY')
  if (!apiKey) {
    throw new Error('GLADIA_API_KEY environment variable is required for Gladia transcription')
  }
}
