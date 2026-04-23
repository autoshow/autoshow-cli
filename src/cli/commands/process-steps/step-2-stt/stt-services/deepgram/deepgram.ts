import * as l from '~/logger'
import { readEnv } from '~/utils/validate/env-utils'

export const setupDeepgramStt = async (): Promise<void> => {
  const apiKey = readEnv('DEEPGRAM_API_KEY')
  if (apiKey) {
    l.write('success', 'DEEPGRAM_API_KEY found — Deepgram transcription ready')
  } else {
    l.warn('DEEPGRAM_API_KEY not set — Deepgram transcription will not work until set')
    l.write('info', 'Set DEEPGRAM_API_KEY environment variable to use Deepgram transcription')
  }
}

export const ensureDeepgramSttSetup = async (): Promise<void> => {
  const apiKey = readEnv('DEEPGRAM_API_KEY')
  if (!apiKey) {
    throw new Error('DEEPGRAM_API_KEY environment variable is required for Deepgram transcription')
  }
}
