import * as l from '~/logger'
import { readEnv } from '~/utils/validate/env-utils'

export const getGladiaBaseUrl = (): string =>
  readEnv('GLADIA_BASE_URL') ?? 'https://api.gladia.io'

export const setupGladiaStt = async (): Promise<void> => {
  const apiKey = readEnv('GLADIA_API_KEY')
  if (apiKey) {
    l.success(`GLADIA_API_KEY found — Gladia transcription ready (${getGladiaBaseUrl()})`)
  } else {
    l.warn('GLADIA_API_KEY not set — Gladia transcription will not work until set')
    l.info('Set GLADIA_API_KEY environment variable to use Gladia transcription')
  }
}

export const ensureGladiaSttSetup = async (): Promise<void> => {
  const apiKey = readEnv('GLADIA_API_KEY')
  if (!apiKey) {
    throw new Error('GLADIA_API_KEY environment variable is required for Gladia transcription')
  }
}
