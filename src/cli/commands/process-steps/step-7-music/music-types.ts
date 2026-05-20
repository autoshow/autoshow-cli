import type * as v from 'valibot'
import type {
  MusicProvider,
  ProcessingOptions,
  ProviderModelBase,
  ProviderTargetBase,
  Step7MusicMetadata
} from '~/types'
import { MinimaxMusicResponseSchema } from './music-services/minimax/run-minimax-music-gen'

export type MusicGenOptions = Pick<
  ProcessingOptions,
  'elevenlabsMusicModels' | 'elevenlabsMusicModel' | 'minimaxMusicModels' | 'minimaxMusicModel' | 'deapiMusicModels' | 'deapiMusicModel' | 'geminiMusicModels' | 'geminiMusicModel' | 'musicDuration' | 'musicLyricsFile' | 'musicInstrumental' | 'musicProviderConcurrency' | 'musicLocalConcurrency'
>

export type MusicTarget = ProviderTargetBase<MusicProvider> & {
  run: (prompt: string, outputDir: string) => Promise<{ musicPath: string, metadata: Step7MusicMetadata }>
}

export type MinimaxMusicResponse = v.InferOutput<typeof MinimaxMusicResponseSchema>

export type MusicCostEstimate = ProviderModelBase<MusicProvider> & {
  totalCost: number
  durationSeconds: number
  lyricsSource: 'provided' | 'generated' | 'none'
  note?: string
}

export type EstimateMusicCostOptions = {
  elevenlabsMusicModels?: string[] | undefined
  elevenlabsMusicModel?: string | undefined
  minimaxMusicModels?: string[] | undefined
  minimaxMusicModel?: string | undefined
  deapiMusicModels?: string[] | undefined
  deapiMusicModel?: string | undefined
  geminiMusicModels?: string[] | undefined
  geminiMusicModel?: string | undefined
  musicDuration?: number | undefined
  musicLyricsFile?: string | undefined
  musicInstrumental?: boolean | undefined
}
