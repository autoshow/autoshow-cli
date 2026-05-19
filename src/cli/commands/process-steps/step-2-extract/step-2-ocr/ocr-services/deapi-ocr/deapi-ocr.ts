import * as l from '~/utils/logger'
import { ensureDeapiApiKey, getDeapiApiKey, getDeapiBaseUrl } from '~/utils/deapi'

export const setupDeapiOcr = async (): Promise<void> => {
  const apiKey = getDeapiApiKey()
  if (apiKey) {
    l.write('success', `DEAPI_API_KEY found — deAPI OCR ready (${getDeapiBaseUrl()})`)
  } else {
    l.warn('DEAPI_API_KEY not set — deAPI OCR will not work until set')
    l.write('info', 'Set DEAPI_API_KEY environment variable to use deAPI OCR')
  }
}

export const ensureDeapiOcrSetup = async (): Promise<void> => {
  ensureDeapiApiKey('deAPI OCR')
}
