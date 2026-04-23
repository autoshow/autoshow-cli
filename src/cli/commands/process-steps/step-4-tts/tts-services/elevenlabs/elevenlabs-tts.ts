import * as l from '~/logger'
import { readEnv } from '~/utils/validate/env-utils'

export const setupElevenLabsTts = async (): Promise<void> => {
  const apiKey = readEnv('ELEVENLABS_API_KEY')
  if (apiKey) {
    l.write('success', 'ELEVENLABS_API_KEY found — ElevenLabs TTS ready')
  } else {
    l.warn('ELEVENLABS_API_KEY not set — ElevenLabs TTS will not work until set')
    l.write('info', 'Set ELEVENLABS_API_KEY environment variable to use ElevenLabs TTS')
  }
}

export const ensureElevenLabsTtsSetup = async (): Promise<void> => {
  const apiKey = readEnv('ELEVENLABS_API_KEY')
  if (!apiKey) {
    throw new Error('ELEVENLABS_API_KEY environment variable is required for ElevenLabs TTS')
  }
}
