import * as l from '~/utils/logger'
import { ensureDeapiApiKey, getDeapiApiKey, getDeapiBaseUrl } from '~/utils/deapi'

export const setupDeapiImageGen = async (): Promise<void> => {
  const apiKey = getDeapiApiKey()
  if (apiKey) {
    l.write('success', `DEAPI_API_KEY found — deAPI image generation ready (${getDeapiBaseUrl()})`)
  } else {
    l.warn('DEAPI_API_KEY not set — deAPI image generation will not work until set')
    l.write('info', 'Set DEAPI_API_KEY environment variable to use deAPI image generation')
  }
}

export const ensureDeapiImageGenSetup = async (): Promise<void> => {
  ensureDeapiApiKey('deAPI image generation')
}
