import { l } from '../../logging.ts'

export type TtsEngine = 'elevenlabs' | 'coqui' | 'polly'

export const detectEngine = (options: any): TtsEngine => {
  l.dim('Detecting TTS engine from options')
  const engines = ['elevenlabs', 'polly', 'coqui'].find(e => 
    options[e]
  ) || 'coqui'
  l.dim(`Using ${engines} engine${engines === 'coqui' ? ' (default)' : ''}`)
  return engines as TtsEngine
}