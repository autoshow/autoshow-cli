export interface VoiceSettings {
  stability: number
  similarity_boost: number
  style: number
  use_speaker_boost: boolean
}

export type TtsEngine = 'elevenlabs' | 'coqui' | 'polly' | 'kitten' | 'qwen3' | 'chatterbox' | 'fishaudio' | 'cosyvoice'

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

export type FishAudioLanguage = 
  | 'en' | 'zh' | 'ja' | 'de' | 'fr' | 'es' 
  | 'ko' | 'ar' | 'ru' | 'nl' | 'it' | 'pl' | 'pt'

export interface FishAudioOptions {
  language?: FishAudioLanguage | string
  apiUrl?: string              // API server URL  
  refAudio?: string            // Voice cloning reference
  refText?: string             // Reference audio transcript
  emotion?: string             // Emotion marker to prepend
  device?: 'cpu' | 'cuda' | 'mps'
}

export type CosyVoiceLanguage = 
  | 'auto' | 'zh' | 'en' | 'ja' | 'ko' | 'de' | 'es' | 'fr' | 'it' | 'ru'

export type CosyVoiceMode = 'instruct' | 'zero_shot' | 'cross_lingual'

export interface CosyVoiceOptions {
  mode?: CosyVoiceMode              // Default: instruct
  language?: CosyVoiceLanguage      // Default: auto
  apiUrl?: string                   // Docker API URL (default: http://localhost:50000)
  refAudio?: string                 // Reference audio for zero_shot mode (optional)
  refText?: string                  // Transcript of reference audio (optional)
  instruct?: string                 // Instruction text (e.g., "Speak slowly", "Cantonese dialect")
  stream?: boolean                  // Enable streaming (default: false)
}