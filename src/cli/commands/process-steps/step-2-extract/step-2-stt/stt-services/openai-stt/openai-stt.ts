import * as l from '~/utils/logger'
import { readEnv } from '~/utils/validate/env-utils'

export const setupOpenaiStt = async (): Promise<void> => {
  const apiKey = readEnv('OPENAI_API_KEY')
  if (apiKey) {
    l.write('success', 'OPENAI_API_KEY found - OpenAI transcription ready')
  } else {
    l.warn('OPENAI_API_KEY not set - OpenAI transcription will not work until set')
    l.write('info', 'Set OPENAI_API_KEY environment variable to use OpenAI transcription')
  }
}

export const ensureOpenaiSttSetup = async (): Promise<void> => {
  const apiKey = readEnv('OPENAI_API_KEY')
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY environment variable is required for OpenAI transcription')
  }
}
