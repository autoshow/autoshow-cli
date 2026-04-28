import * as l from '~/utils/logger'
import { ensureDeapiApiKey, getDeapiApiKey, getDeapiBaseUrl } from '~/utils/deapi'

export const setupDeapiVideoGen = async (): Promise<void> => {
  const apiKey = getDeapiApiKey()
  if (apiKey) {
    l.write('success', `DEAPI_API_KEY found — deAPI video generation ready (${getDeapiBaseUrl()})`)
  } else {
    l.warn('DEAPI_API_KEY not set — deAPI video generation will not work until set')
    l.write('info', 'Set DEAPI_API_KEY environment variable to use deAPI video generation')
  }
}

export const ensureDeapiVideoGenSetup = async (): Promise<void> => {
  ensureDeapiApiKey('deAPI video generation')
}
