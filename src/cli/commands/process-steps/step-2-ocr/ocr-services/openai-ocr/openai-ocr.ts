import * as l from '~/logger'
import { readEnv } from '~/utils/validate/env-utils'

export const setupOpenAIOcr = async (): Promise<void> => {
  const apiKey = readEnv('OPENAI_API_KEY')
  if (apiKey) {
    l.success('OPENAI_API_KEY found — OpenAI OCR ready')
  } else {
    l.warn('OPENAI_API_KEY not set — OpenAI OCR will not work until set')
    l.info('Set OPENAI_API_KEY environment variable to use OpenAI OCR')
  }
}

export const ensureOpenAIOcrSetup = async (): Promise<void> => {
  const apiKey = readEnv('OPENAI_API_KEY')
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY environment variable is required for OpenAI OCR')
  }
}
