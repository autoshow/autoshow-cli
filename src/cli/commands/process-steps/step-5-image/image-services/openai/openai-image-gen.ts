import * as l from '~/logger'
import { readEnv } from '~/utils/validate/env-utils'

export const setupOpenAIImageGen = async (): Promise<void> => {
  const apiKey = readEnv('OPENAI_API_KEY')
  if (apiKey) {
    l.success('OPENAI_API_KEY found — OpenAI image generation ready')
  } else {
    l.warn('OPENAI_API_KEY not set — OpenAI image generation will not work until set')
    l.info('Set OPENAI_API_KEY environment variable to use OpenAI image models')
  }
}

export const ensureOpenAIImageGenSetup = async (): Promise<void> => {
  const apiKey = readEnv('OPENAI_API_KEY')
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY environment variable is required for OpenAI image generation')
  }
}
