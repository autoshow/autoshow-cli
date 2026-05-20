import * as l from '~/utils/logger'
import { readEnv } from '~/utils/validate/env-utils'

const DEFAULT_REVE_BASE_URL = 'https://api.reve.com'

export const getReveApiKey = (): string | undefined => readEnv('REVE_API_KEY')

export const getReveBaseUrl = (): string => {
  const raw = readEnv('REVE_BASE_URL') ?? DEFAULT_REVE_BASE_URL
  return raw.replace(/\/+$/, '')
}

export const setupReveImageGen = async (): Promise<void> => {
  const apiKey = getReveApiKey()
  if (apiKey) {
    l.write('success', `REVE_API_KEY found - Reve image generation ready (${getReveBaseUrl()})`)
  } else {
    l.warn('REVE_API_KEY not set - Reve image generation will not work until set')
    l.write('info', 'Set REVE_API_KEY environment variable to use Reve image models')
  }
}

export const ensureReveImageGenSetup = async (): Promise<string> => {
  const apiKey = getReveApiKey()
  if (!apiKey) {
    throw new Error('REVE_API_KEY environment variable is required for Reve image generation')
  }
  return apiKey
}
