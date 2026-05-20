import {
  isMinimaxInstrumentalMusicModel,
  validateDeapiMusicModel,
  validateElevenlabsMusicModel,
  validateGeminiMusicModel,
  validateMinimaxMusicModel
} from '~/cli/commands/setup-and-utilities/models/model-options'
import { getMusicModelMeta } from '~/cli/commands/setup-and-utilities/models/model-loader'
import type { EstimateMusicCostOptions, MusicCostEstimate } from '~/types'

const formatRate = (amount: number): string => `${amount.toFixed(2)}¢`
const DEFAULT_ELEVENLABS_MUSIC_DURATION_SECONDS = 180
const DEFAULT_MINIMAX_MUSIC_DURATION_SECONDS = 120
const DEFAULT_DEAPI_MUSIC_DURATION_SECONDS = 30
const GEMINI_CLIP_MUSIC_DURATION_SECONDS = 30
const DEFAULT_GEMINI_PRO_MUSIC_DURATION_SECONDS = 120

const assertValidMusicDuration = (durationSeconds: number | undefined): void => {
  if (durationSeconds !== undefined && (!Number.isFinite(durationSeconds) || durationSeconds <= 0)) {
    throw new Error(`Invalid music duration: ${durationSeconds}`)
  }
}

export const estimateMusicCosts = (options: EstimateMusicCostOptions): MusicCostEstimate[] => {
  assertValidMusicDuration(options.musicDuration)

  const results: MusicCostEstimate[] = []
  const elevenlabsModels = options.elevenlabsMusicModels ?? (options.elevenlabsMusicModel ? [options.elevenlabsMusicModel] : [])
  const minimaxModels = options.minimaxMusicModels ?? (options.minimaxMusicModel ? [options.minimaxMusicModel] : [])
  const deapiModels = options.deapiMusicModels ?? (options.deapiMusicModel ? [options.deapiMusicModel] : [])
  const geminiModels = options.geminiMusicModels ?? (options.geminiMusicModel ? [options.geminiMusicModel] : [])

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
      durationSeconds,
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
    const supportsInstrumental = isMinimaxInstrumentalMusicModel(model)
    const lyricsSource: MusicCostEstimate['lyricsSource'] = options.musicInstrumental && supportsInstrumental
      ? 'none'
      : options.musicLyricsFile ? 'provided' : 'generated'

    if (baseCost === undefined) {
      throw new Error(`Rate unavailable in model registry for MiniMax music model: ${model}`)
    }

    const lyricsCost = lyricsSource === 'generated' ? lyricsAddonCost : 0
    results.push({
      provider: 'minimax',
      model,
      durationSeconds: DEFAULT_MINIMAX_MUSIC_DURATION_SECONDS,
      totalCost: baseCost + lyricsCost,
      lyricsSource,
      note: lyricsSource === 'generated'
        ? `Includes ${formatRate(lyricsAddonCost)} lyrics generation add-on`
        : lyricsSource === 'none'
          ? 'Instrumental mode omits lyrics generation'
          : 'Assumes provided lyrics; no lyrics-generation add-on'
    })
  }

  for (const rawModel of deapiModels) {
    const model = validateDeapiMusicModel(rawModel)
    const lyricsSource: MusicCostEstimate['lyricsSource'] = options.musicLyricsFile && !options.musicInstrumental ? 'provided' : 'none'
    results.push({
      provider: 'deapi',
      model,
      durationSeconds: options.musicDuration ?? DEFAULT_DEAPI_MUSIC_DURATION_SECONDS,
      totalCost: 0,
      lyricsSource,
      note: 'Exact deAPI music pricing is resolved through the provider quote endpoint when DEAPI_API_KEY is available.'
    })
  }

  for (const rawModel of geminiModels) {
    const model = validateGeminiMusicModel(rawModel)
    const modelMeta = getMusicModelMeta('gemini', model)
    const baseCost = modelMeta?.costPerTrackCents
    const lyricsSource: MusicCostEstimate['lyricsSource'] = options.musicInstrumental
      ? 'none'
      : options.musicLyricsFile
        ? 'provided'
        : 'generated'

    if (baseCost === undefined) {
      throw new Error(`Rate unavailable in model registry for Gemini music model: ${model}`)
    }

    results.push({
      provider: 'gemini',
      model,
      durationSeconds: model === 'lyria-3-clip-preview'
        ? GEMINI_CLIP_MUSIC_DURATION_SECONDS
        : options.musicDuration ?? DEFAULT_GEMINI_PRO_MUSIC_DURATION_SECONDS,
      totalCost: baseCost,
      lyricsSource,
      note: model === 'lyria-3-clip-preview'
        ? 'Gemini Lyria 3 Clip is billed per 30-second song request.'
        : `Gemini Lyria 3 Pro is billed per song request; timing estimate uses ${options.musicDuration ?? DEFAULT_GEMINI_PRO_MUSIC_DURATION_SECONDS}s.`
    })
  }

  return results
}
