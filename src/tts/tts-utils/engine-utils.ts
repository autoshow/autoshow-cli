import type { TtsEngine } from '@/types'

export const detectEngine = (options: any): TtsEngine => {
  const engines = ['elevenlabs', 'polly', 'kitten', 'coqui'].find(e => 
    options[e]
  ) || 'coqui'
  return engines as TtsEngine
}