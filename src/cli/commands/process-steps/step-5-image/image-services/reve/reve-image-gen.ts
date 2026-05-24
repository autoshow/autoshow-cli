import * as l from '~/utils/logger'
import { readEnv } from '~/utils/validate/env-utils'
import { REVE_DEFAULT_BASE_URL } from '~/utils/base-urls'

export const getReveApiKey = (): string | undefined => readEnv('REVE_API_KEY')

export const getReveBaseUrl = (): string => {
  return REVE_DEFAULT_BASE_URL.replace(/\/+$/, '')
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
