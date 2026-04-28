import {
  validateDeapiMusicModel,
  validateElevenlabsMusicModel,
  validateMinimaxMusicModel
} from '~/cli/commands/setup-and-utilities/models/model-options'
import { getMusicModelMeta } from '~/cli/commands/setup-and-utilities/models/model-loader'
import type { EstimateMusicCostOptions, MusicCostEstimate } from '~/types'

const formatRate = (amount: number): string => `${amount.toFixed(2)}¢`
const DEFAULT_ELEVENLABS_MUSIC_DURATION_SECONDS = 180

export const estimateMusicCosts = (options: EstimateMusicCostOptions): MusicCostEstimate[] => {
  const results: MusicCostEstimate[] = []
  const elevenlabsModels = options.elevenlabsMusicModels ?? (options.elevenlabsMusicModel ? [options.elevenlabsMusicModel] : [])
  const minimaxModels = options.minimaxMusicModels ?? (options.minimaxMusicModel ? [options.minimaxMusicModel] : [])
  const deapiModels = options.deapiMusicModels ?? (options.deapiMusicModel ? [options.deapiMusicModel] : [])

  for (const rawModel of elevenlabsModels) {
    const model = validateElevenlabsMusicModel(rawModel)
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

    results.push({
      provider: 'elevenlabs',
      model,
      totalCost: ratePerMinute * (durationSeconds / 60),
      lyricsSource,
      note: options.musicDuration !== undefined
        ? `Estimated using ${formatRate(ratePerMinute)}/minute (business-tier starting rate)`
        : `Estimated using default ${DEFAULT_ELEVENLABS_MUSIC_DURATION_SECONDS}s duration at ${formatRate(ratePerMinute)}/minute`
    })
  }

  for (const rawModel of minimaxModels) {
    const model = validateMinimaxMusicModel(rawModel)
    const modelMeta = getMusicModelMeta('minimax', model)
    const baseCost = modelMeta?.costPerTrackCents
    const lyricsAddonCost = modelMeta?.lyricsCostPerTrackCents ?? 0
    const lyricsSource: MusicCostEstimate['lyricsSource'] = options.musicLyricsFile ? 'provided' : 'generated'

    if (baseCost === undefined) {
      throw new Error(`Rate unavailable in model registry for MiniMax music model: ${model}`)
    }

    const lyricsCost = lyricsSource === 'generated' ? lyricsAddonCost : 0
    results.push({
      provider: 'minimax',
      model,
      totalCost: baseCost + lyricsCost,
      lyricsSource,
      note: lyricsSource === 'generated'
        ? `Includes ${formatRate(lyricsAddonCost)} lyrics generation add-on`
        : 'Assumes provided lyrics; no lyrics-generation add-on'
    })
  }

  for (const rawModel of deapiModels) {
    const model = validateDeapiMusicModel(rawModel)
    const lyricsSource: MusicCostEstimate['lyricsSource'] = options.musicLyricsFile && !options.musicInstrumental ? 'provided' : 'none'
    results.push({
      provider: 'deapi',
      model,
      totalCost: 0,
      lyricsSource,
      note: 'Exact deAPI music pricing is resolved through the provider quote endpoint when DEAPI_API_KEY is available.'
    })
  }

  return results
}
