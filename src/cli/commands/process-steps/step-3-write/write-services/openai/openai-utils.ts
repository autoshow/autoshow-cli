import { readEnv } from '~/utils/validate/env-utils'
import { OPENAI_DEFAULT_BASE_URL } from '~/utils/base-urls'

export const getOpenAIClientConfig = (): { apiKey: string, baseURL: string } => {
  const apiKey = readEnv('OPENAI_API_KEY')
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY environment variable is required')
  }
  return { apiKey, baseURL: readEnv('OPENAI_BASE_URL') ?? OPENAI_DEFAULT_BASE_URL }
}
