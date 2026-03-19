import * as l from '~/logger'
import { readEnvFallback } from '~/utils/validate/env-utils'

export const setupElevenLabsMusicGen = async (): Promise<void> => {
  const apiKey = readEnvFallback('ELEVENLABS_API_KEY')
  if (apiKey) {
    l.success('ELEVENLABS_API_KEY found — ElevenLabs music generation ready')
  } else {
    l.warn('ELEVENLABS_API_KEY not set — ElevenLabs music generation will not work until set')
    l.info('Set ELEVENLABS_API_KEY environment variable to use ElevenLabs music generation')
  }
}

export const ensureElevenLabsMusicGenSetup = async (): Promise<void> => {
  const apiKey = readEnvFallback('ELEVENLABS_API_KEY')
  if (!apiKey) {
    throw new Error('ELEVENLABS_API_KEY environment variable is required for ElevenLabs music generation')
  }
}
