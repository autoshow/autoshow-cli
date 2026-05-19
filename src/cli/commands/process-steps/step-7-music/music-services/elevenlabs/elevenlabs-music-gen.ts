import * as l from '~/utils/logger'
import { readEnv } from '~/utils/validate/env-utils'

export const setupElevenLabsMusicGen = async (): Promise<void> => {
  const apiKey = readEnv('ELEVENLABS_API_KEY')
  if (apiKey) {
    l.write('success', 'ELEVENLABS_API_KEY found — ElevenLabs music generation ready')
  } else {
    l.warn('ELEVENLABS_API_KEY not set — ElevenLabs music generation will not work until set')
    l.write('info', 'Set ELEVENLABS_API_KEY environment variable to use ElevenLabs music generation')
  }
}

export const ensureElevenLabsMusicGenSetup = async (): Promise<void> => {
  const apiKey = readEnv('ELEVENLABS_API_KEY')
  if (!apiKey) {
    throw new Error('ELEVENLABS_API_KEY environment variable is required for ElevenLabs music generation')
  }
}
