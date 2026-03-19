import {
  validateElevenlabsMusicModel,
  validateMinimaxMusicModel
} from '~/cli/commands/models/model-options'
import { getMusicModelMeta } from '~/cli/commands/models/model-loader'
import type { EstimateMusicCostOptions, MusicCostEstimate } from '~/types'

const formatRate = (amount: number): string => `${amount.toFixed(2)}¢`
const DEFAULT_ELEVENLABS_MUSIC_DURATION_SECONDS = 180

export const estimateMusicCost = (options: EstimateMusicCostOptions): MusicCostEstimate | null => {
  const hasElevenlabs = typeof options.elevenlabsMusicModel === 'string' && options.elevenlabsMusicModel.length > 0
  const hasMinimax = typeof options.minimaxMusicModel === 'string' && options.minimaxMusicModel.length > 0
  const providerCount = [hasElevenlabs, hasMinimax].filter(Boolean).length

  if (providerCount > 1) {
    throw new Error('Cannot estimate music cost when multiple providers are selected')
  }

  if (hasElevenlabs) {
    const model = validateElevenlabsMusicModel(options.elevenlabsMusicModel as string)
    const modelMeta = getMusicModelMeta('elevenlabs', model)
    const ratePerMinute = modelMeta?.costPerMinuteCents
    const lyricsSource: MusicCostEstimate['lyricsSource'] = options.musicInstrumental ? 'none' : 'generated'

    if (ratePerMinute === undefined) {
      throw new Error(`Rate unavailable in model registry for ElevenLabs music model: ${model}`)
    }

    const durationSeconds = options.musicDuration ?? DEFAULT_ELEVENLABS_MUSIC_DURATION_SECONDS
    if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) {
      throw new Error(`Invalid music duration: ${durationSeconds}`)
    }

    return {
      provider: 'elevenlabs',
      model,
      totalCost: ratePerMinute * (durationSeconds / 60),
      lyricsSource,
      note: options.musicDuration !== undefined
        ? `Estimated using ${formatRate(ratePerMinute)}/minute (business-tier starting rate)`
        : `Estimated using default ${DEFAULT_ELEVENLABS_MUSIC_DURATION_SECONDS}s duration at ${formatRate(ratePerMinute)}/minute`
    }
  }

  if (hasMinimax) {
    const model = validateMinimaxMusicModel(options.minimaxMusicModel as string)
    const modelMeta = getMusicModelMeta('minimax', model)
    const baseCost = modelMeta?.costPerTrackCents
    const lyricsAddonCost = modelMeta?.lyricsCostPerTrackCents ?? 0
    const lyricsSource: MusicCostEstimate['lyricsSource'] = options.musicLyricsFile ? 'provided' : 'generated'

    if (baseCost === undefined) {
      throw new Error(`Rate unavailable in model registry for MiniMax music model: ${model}`)
    }

    const lyricsCost = lyricsSource === 'generated' ? lyricsAddonCost : 0
    return {
      provider: 'minimax',
      model,
      totalCost: baseCost + lyricsCost,
      lyricsSource,
      note: lyricsSource === 'generated'
        ? `Includes ${formatRate(lyricsAddonCost)} lyrics generation add-on`
        : 'Assumes provided lyrics; no lyrics-generation add-on'
    }
  }

  return null
}
