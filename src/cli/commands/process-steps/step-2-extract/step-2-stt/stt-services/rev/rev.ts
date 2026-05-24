import * as l from '~/utils/logger'
import { REVAI_DEFAULT_BASE_URL } from '~/utils/base-urls'
import { readEnv } from '~/utils/validate/env-utils'

export const getRevBaseUrl = (): string => REVAI_DEFAULT_BASE_URL

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
