export interface VoiceSettings {
  stability: number
  similarity_boost: number
  style: number
  use_speaker_boost: boolean
}

export type TtsEngine = 'elevenlabs' | 'coqui' | 'polly' | 'kitten' | 'qwen3'

export type Qwen3Mode = 'custom' | 'design' | 'clone'

export type Qwen3Speaker = 
  | 'Vivian' 
  | 'Serena' 
  | 'Uncle_Fu' 
  | 'Dylan' 
  | 'Eric' 
  | 'Ryan' 
  | 'Aiden' 
  | 'Ono_Anna' 
  | 'Sohee'

export type Qwen3Language = 
  | 'Auto'
  | 'Chinese'
  | 'English'
  | 'Japanese'
  | 'Korean'
  | 'German'
  | 'French'
  | 'Russian'
  | 'Portuguese'
  | 'Spanish'
  | 'Italian'

export interface Qwen3Options {
  model?: string
  speaker?: Qwen3Speaker | string
  language?: Qwen3Language | string
  instruct?: string
  mode?: Qwen3Mode
  refAudio?: string
  refText?: string
  speed?: number
  maxChunk?: number
}