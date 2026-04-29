import * as l from '~/utils/logger'
import { readEnv } from '~/utils/validate/env-utils'

export const setupGrokStt = async (): Promise<void> => {
  const apiKey = readEnv('XAI_API_KEY')
  if (apiKey) {
    l.write('success', 'XAI_API_KEY found - Grok STT ready')
  } else {
    l.warn('XAI_API_KEY not set - Grok STT will not work until set')
    l.write('info', 'Set XAI_API_KEY environment variable to use Grok STT')
  }
}

export const ensureGrokSttSetup = async (): Promise<void> => {
  const apiKey = readEnv('XAI_API_KEY')
  if (!apiKey) {
    throw new Error('XAI_API_KEY environment variable is required for Grok STT')
  }
}
