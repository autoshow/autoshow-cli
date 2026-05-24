import * as l from '~/utils/logger'
import { readEnv } from '~/utils/validate/env-utils'
import { BFL_DEFAULT_BASE_URL } from '~/utils/base-urls'

export const getBflApiKey = (): string | undefined => readEnv('BFL_API_KEY')

export const getBflBaseUrl = (): string => {
  return BFL_DEFAULT_BASE_URL.replace(/\/+$/, '')
}

export const setupBflImageGen = async (): Promise<void> => {
  const apiKey = getBflApiKey()
  if (apiKey) {
    l.write('success', `BFL_API_KEY found - BFL image generation ready (${getBflBaseUrl()})`)
  } else {
    l.warn('BFL_API_KEY not set - BFL image generation will not work until set')
    l.write('info', 'Set BFL_API_KEY environment variable to use BFL image models')
  }
}

export const ensureBflImageGenSetup = async (): Promise<string> => {
  const apiKey = getBflApiKey()
  if (!apiKey) {
    throw new Error('BFL_API_KEY environment variable is required for BFL image generation')
  }
  return apiKey
}
