import * as l from '~/logger'
import { readEnvFallback } from '~/utils/validate/env-utils'

export const setupMistralStt = async (): Promise<void> => {
  const apiKey = readEnvFallback('MISTRAL_API_KEY')
  if (apiKey) {
    l.success('MISTRAL_API_KEY found — Mistral transcription ready')
  } else {
    l.warn('MISTRAL_API_KEY not set — Mistral transcription will not work until set')
    l.info('Set MISTRAL_API_KEY environment variable to use Mistral transcription')
  }
}

export const ensureMistralSttSetup = async (): Promise<void> => {
  const apiKey = readEnvFallback('MISTRAL_API_KEY')
  if (!apiKey) {
    throw new Error('MISTRAL_API_KEY environment variable is required for Mistral transcription')
  }
}
