import * as l from '~/utils/logger'
import { readEnv } from '~/utils/validate/env-utils'

export const getRevBaseUrl = (): string =>
  readEnv('REVAI_BASE_URL') ?? 'https://api.rev.ai/speechtotext/v1'

export const setupRevStt = async (): Promise<void> => {
  const accessToken = readEnv('REVAI_ACCESS_TOKEN')
  if (accessToken) {
    l.write('success', `REVAI_ACCESS_TOKEN found — Rev transcription ready (${getRevBaseUrl()})`)
  } else {
    l.warn('REVAI_ACCESS_TOKEN not set — Rev transcription will not work until set')
    l.write('info', 'Set REVAI_ACCESS_TOKEN environment variable to use Rev transcription')
  }
}

export const ensureRevSttSetup = async (): Promise<void> => {
  const accessToken = readEnv('REVAI_ACCESS_TOKEN')
  if (!accessToken) {
    throw new Error('REVAI_ACCESS_TOKEN environment variable is required for Rev transcription')
  }
}
