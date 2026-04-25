import * as l from '~/utils/logger'
import { readEnv } from '~/utils/validate/env-utils'

export const setupTogetherStt = async (): Promise<void> => {
  const apiKey = readEnv('TOGETHER_API_KEY')
  if (apiKey) {
    l.write('success', 'TOGETHER_API_KEY found — Together transcription ready')
  } else {
    l.warn('TOGETHER_API_KEY not set — Together transcription will not work until set')
    l.write('info', 'Set TOGETHER_API_KEY environment variable to use Together transcription')
  }
}

export const ensureTogetherSttSetup = async (): Promise<void> => {
  const apiKey = readEnv('TOGETHER_API_KEY')
  if (!apiKey) {
    throw new Error('TOGETHER_API_KEY environment variable is required for Together transcription')
  }
}
