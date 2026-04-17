export type CaptionCue = {
  index: number
  start: number
  end: number
  text: string
}

export type LyricsCueSource = 'caption-file' | 'whisper-words' | 'whisper-segments'

export type LyricsRenderSummary = {
  encoder: string
  backgroundMode: 'image' | 'spectrogram'
}
