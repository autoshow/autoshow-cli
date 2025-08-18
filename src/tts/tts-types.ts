export interface VoiceSettings {
  stability: number
  similarity_boost: number
  style: number
  use_speaker_boost: boolean
}

export type TtsEngine = 'elevenlabs' | 'coqui' | 'polly' | 'kitten'