import { l } from '@/logging'
import type { TtsEngine } from '@/types'

const p = '[tts/tts-utils/engine-utils]'

export const detectEngine = (options: any): TtsEngine => {
  l.dim(`${p} Detecting TTS engine from options`)
  const engines = ['elevenlabs', 'polly', 'kitten', 'coqui'].find(e => 
    options[e]
  ) || 'coqui'
  l.dim(`${p} Using ${engines} engine${engines === 'coqui' ? ' (default)' : ''}`)
  return engines as TtsEngine
}