import * as l from '~/utils/logger'
import { ensureDeapiApiKey, getDeapiApiKey, getDeapiBaseUrl } from '~/utils/deapi'

export const setupDeapiMusicGen = async (): Promise<void> => {
  const apiKey = getDeapiApiKey()
  if (apiKey) {
    l.write('success', `DEAPI_API_KEY found — deAPI music generation ready (${getDeapiBaseUrl()})`)
  } else {
    l.warn('DEAPI_API_KEY not set — deAPI music generation will not work until set')
    l.write('info', 'Set DEAPI_API_KEY environment variable to use deAPI music generation')
  }
}

export const ensureDeapiMusicGenSetup = async (): Promise<void> => {
  ensureDeapiApiKey('deAPI music generation')
}
