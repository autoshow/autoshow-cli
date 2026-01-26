import type { TtsEngine } from '../tts-types'

export const detectEngine = (options: any): TtsEngine => {
  const engines = ['elevenlabs', 'polly', 'kitten', 'qwen3', 'coqui'].find(e => 
    options[e]
  ) || 'coqui'
  return engines as TtsEngine
}
