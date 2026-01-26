export interface VoiceSettings {
  stability: number
  similarity_boost: number
  style: number
  use_speaker_boost: boolean
}

export type TtsEngine = 'elevenlabs' | 'coqui' | 'polly' | 'kitten' | 'qwen3' | 'chatterbox'

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

export type ChatterboxModel = 'turbo' | 'standard' | 'multilingual'

export type ChatterboxLanguage = 
  | 'ar' | 'da' | 'de' | 'el' | 'en' | 'es' | 'fi' | 'fr' 
  | 'he' | 'hi' | 'it' | 'ja' | 'ko' | 'ms' | 'nl' | 'no' 
  | 'pl' | 'pt' | 'ru' | 'sv' | 'sw' | 'tr' | 'zh'

export interface ChatterboxOptions {
  model?: ChatterboxModel
  refAudio?: string           // Voice cloning reference (10s clip)
  languageId?: ChatterboxLanguage  // For multilingual model
  exaggeration?: number       // 0.0-1.0, for standard model
  cfgWeight?: number          // 0.0-1.0, for standard model
  device?: 'cpu' | 'mps' | 'cuda'
  dtype?: 'float32' | 'float16' | 'bfloat16'
}