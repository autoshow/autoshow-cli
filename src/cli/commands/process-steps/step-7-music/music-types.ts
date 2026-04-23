import type * as v from 'valibot'
import type {
  MusicProvider,
  ProcessingOptions,
  ProviderModelBase,
  Step7MusicMetadata
} from '~/types'
import { MinimaxMusicResponseSchema } from './music-services/minimax/run-minimax-music-gen'

export type MusicGenOptions = Pick<
  ProcessingOptions,
  'elevenlabsMusicModels' | 'elevenlabsMusicModel' | 'minimaxMusicModels' | 'minimaxMusicModel' | 'musicDuration' | 'musicLyricsFile' | 'musicInstrumental'
>

export type MusicTarget = {
  service: MusicProvider
  model: string
  run: (prompt: string, outputDir: string) => Promise<{ musicPath: string, metadata: Step7MusicMetadata }>
}

export type MinimaxMusicResponse = v.InferOutput<typeof MinimaxMusicResponseSchema>

export type MusicCostEstimate = ProviderModelBase<MusicProvider> & {
  totalCost: number
  lyricsSource: 'provided' | 'generated' | 'none'
  note?: string
}

export type EstimateMusicCostOptions = {
  elevenlabsMusicModels?: string[] | undefined
  elevenlabsMusicModel?: string | undefined
  minimaxMusicModels?: string[] | undefined
  minimaxMusicModel?: string | undefined
  musicDuration?: number | undefined
  musicLyricsFile?: string | undefined
  musicInstrumental?: boolean | undefined
}
