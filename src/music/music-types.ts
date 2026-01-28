export interface ApiError {
  message: string
  stack?: string
  code?: string
  name?: string
  $metadata?: { httpStatusCode?: number }
}

export type MusicOutputFormat = 
  | 'mp3_22050_32' | 'mp3_24000_48' | 'mp3_44100_32' | 'mp3_44100_64' 
  | 'mp3_44100_96' | 'mp3_44100_128' | 'mp3_44100_192'
  | 'pcm_8000' | 'pcm_16000' | 'pcm_22050' | 'pcm_24000' | 'pcm_32000' | 'pcm_44100' | 'pcm_48000'
  | 'ulaw_8000' | 'alaw_8000'
  | 'opus_48000_32' | 'opus_48000_64' | 'opus_48000_96' | 'opus_48000_128' | 'opus_48000_192'

export type MusicModel = 'music_v1'

export type MusicService = 'elevenlabs' | 'minimax'

export type MinimaxAudioFormat = 'mp3' | 'wav' | 'pcm'
export type MinimaxSampleRate = 16000 | 24000 | 32000 | 44100
export type MinimaxBitrate = 32000 | 64000 | 128000 | 256000

export interface MinimaxAudioSetting {
  sample_rate?: MinimaxSampleRate
  bitrate?: MinimaxBitrate
  format?: MinimaxAudioFormat
}

export interface MinimaxMusicOptions {
  outputPath?: string
  prompt?: string
  lyrics: string
  audioSetting?: MinimaxAudioSetting
}

export const MINIMAX_SECTION_TAGS = [
  'Intro', 'Verse', 'Pre Chorus', 'Chorus', 'Interlude',
  'Bridge', 'Outro', 'Post Chorus', 'Transition', 'Break',
  'Hook', 'Build Up', 'Inst', 'Solo'
] as const

export type MinimaxSectionTag = typeof MINIMAX_SECTION_TAGS[number]

export interface TimeRange {
  start_ms: number
  end_ms: number
}

export interface SectionSource {
  song_id: string
  range: TimeRange
  negative_ranges?: TimeRange[]
}

export interface SongSection {
  section_name: string
  positive_local_styles: string[]
  negative_local_styles: string[]
  duration_ms: number
  lines: string[]
  source_from?: SectionSource | null
}

export interface MusicCompositionPlan {
  positive_global_styles: string[]
  negative_global_styles: string[]
  sections: SongSection[]
}

export interface MusicGenerateOptions {
  outputPath?: string
  outputFormat?: MusicOutputFormat
  durationMs?: number
  instrumental?: boolean
  lyrics?: string
  compositionPlan?: MusicCompositionPlan
  respectSectionDurations?: boolean
  withTimestamps?: boolean
  signWithC2pa?: boolean
}

export interface MusicPlanOptions {
  durationMs?: number
  sourceCompositionPlan?: MusicCompositionPlan
}

export interface MusicGenerationResult {
  success: boolean
  path?: string
  error?: string
  details?: string
  duration?: number
  songId?: string
  timestamps?: any
}

export interface MusicPlanResult {
  success: boolean
  plan?: MusicCompositionPlan
  error?: string
  details?: string
}
