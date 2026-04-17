import * as l from '~/logger'
import { readEnv } from '~/utils/validate/env-utils'

export const getSpeechmaticsBaseUrl = (): string =>
  readEnv('SPEECHMATICS_BASE_URL') ?? 'https://eu1.asr.api.speechmatics.com'

export const setupSpeechmaticsStt = async (): Promise<void> => {
  const apiKey = readEnv('SPEECHMATICS_API_KEY')
  if (apiKey) {
    l.success(`SPEECHMATICS_API_KEY found — Speechmatics transcription ready (${getSpeechmaticsBaseUrl()})`)
  } else {
    l.warn('SPEECHMATICS_API_KEY not set — Speechmatics transcription will not work until set')
    l.info('Set SPEECHMATICS_API_KEY environment variable to use Speechmatics transcription')
  }
}

export const ensureSpeechmaticsSttSetup = async (): Promise<void> => {
  const apiKey = readEnv('SPEECHMATICS_API_KEY')
  if (!apiKey) {
    throw new Error('SPEECHMATICS_API_KEY environment variable is required for Speechmatics transcription')
  }
}
