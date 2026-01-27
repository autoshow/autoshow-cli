import type { TtsEngine } from '../tts-types'

export const detectEngine = (options: any): TtsEngine => {
  const engines = ['elevenlabs', 'polly', 'kitten', 'qwen3', 'chatterbox', 'fishaudio', 'cosyvoice', 'coqui'].find(e => 
    options[e] || (e === 'fishaudio' && options['fishAudio'])
  ) || 'coqui'
  return engines as TtsEngine
}
