import * as l from '~/utils/logger'
import { ensureDeapiApiKey, getDeapiApiKey, getDeapiBaseUrl } from '~/utils/deapi'

export const setupDeapiTts = async (): Promise<void> => {
  const apiKey = getDeapiApiKey()
  if (apiKey) {
    l.write('success', `DEAPI_API_KEY found — deAPI TTS ready (${getDeapiBaseUrl()})`)
  } else {
    l.warn('DEAPI_API_KEY not set — deAPI TTS will not work until set')
    l.write('info', 'Set DEAPI_API_KEY environment variable to use deAPI TTS')
  }
}

export const ensureDeapiTtsSetup = async (): Promise<void> => {
  ensureDeapiApiKey('deAPI TTS')
}
