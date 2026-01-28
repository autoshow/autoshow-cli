import type { TtsEngine } from '../tts-types'

export const detectEngine = (options: any): TtsEngine => {
  const engines = ['elevenlabs', 'polly', 'qwen3', 'chatterbox', 'fishaudio', 'cosyvoice'].find(e => 
    options[e] || (e === 'fishaudio' && options['fishAudio'])
  ) || 'qwen3'
  return engines as TtsEngine
}
