import type { MusicProvider, ProcessingOptions, Step7MusicMetadata } from '~/types'

export type MusicGenOptions = Pick<
  ProcessingOptions,
  'elevenlabsMusicModel' | 'minimaxMusicModel' | 'musicDuration' | 'musicLyricsFile' | 'musicInstrumental'
>

export type MusicTarget = {
  service: MusicProvider
  model: string
  run: (prompt: string, outputDir: string) => Promise<{ musicPath: string, metadata: Step7MusicMetadata }>
}
