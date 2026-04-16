import * as l from '~/logger'
import { readEnvFallback } from '~/utils/validate/env-utils'

export const setupMistralOcr = async (): Promise<void> => {
  const apiKey = readEnvFallback('MISTRAL_API_KEY')
  if (apiKey) {
    l.success('MISTRAL_API_KEY found — Mistral OCR ready')
  } else {
    l.warn('MISTRAL_API_KEY not set — Mistral OCR will not work until set')
    l.info('Set MISTRAL_API_KEY environment variable to use Mistral OCR')
  }
}

export const ensureMistralOcrSetup = async (): Promise<void> => {
  const apiKey = readEnvFallback('MISTRAL_API_KEY')
  if (!apiKey) {
    throw new Error('MISTRAL_API_KEY environment variable is required for Mistral OCR')
  }
}
