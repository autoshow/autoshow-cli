import type { ImageStepEstimate, MusicStepEstimate, RuntimeOptions, VideoStepEstimate } from '~/types'
import { estimateImageCosts } from '~/cli/commands/process-steps/step-5-image/image-utils/image-pricing'
import { estimateVideoCosts } from '~/cli/commands/process-steps/step-6-video/video-utils/video-pricing'
import { estimateMusicCosts } from '~/cli/commands/process-steps/step-7-music/music-utils/music-pricing'
import { normalizeDeapiMusicParams, resolveDeapiMusicPrice } from '~/cli/commands/process-steps/step-7-music/music-services/deapi/deapi-music-pricing'
import {
  getImageEstimation,
  getMusicEstimation,
  getVideoEstimation
} from '~/cli/commands/setup-and-utilities/models/model-loader'
import { applyCostMultiplier } from '~/utils/pricing/cost-helpers'

export const buildImageEstimates = (opts: RuntimeOptions): ImageStepEstimate[] => {
  const hasImage = (opts.geminiImageModels?.length ?? 0) > 0
    || !!opts.geminiImageModel
    || (opts.openaiImageModels?.length ?? 0) > 0
    || !!opts.openaiImageModel
    || (opts.minimaxImageModels?.length ?? 0) > 0
    || !!opts.minimaxImageModel
    || (opts.glmImageModels?.length ?? 0) > 0
    || !!opts.glmImageModel
    || (opts.grokImageModels?.length ?? 0) > 0
    || !!opts.grokImageModel
    || (opts.runwayImageModels?.length ?? 0) > 0
    || !!opts.runwayImageModel
    || (opts.bflImageModels?.length ?? 0) > 0
    || !!opts.bflImageModel
    || (opts.deapiImageModels?.length ?? 0) > 0
    || !!opts.deapiImageModel
  if (!hasImage) return []

  return estimateImageCosts({
    geminiImageModels: opts.geminiImageModels,
    geminiImageModel: opts.geminiImageModel,
    openaiImageModels: opts.openaiImageModels,
    openaiImageModel: opts.openaiImageModel,
    minimaxImageModels: opts.minimaxImageModels,
    minimaxImageModel: opts.minimaxImageModel,
    glmImageModels: opts.glmImageModels,
    glmImageModel: opts.glmImageModel,
    grokImageModels: opts.grokImageModels,
    grokImageModel: opts.grokImageModel,
    runwayImageModels: opts.runwayImageModels,
    runwayImageModel: opts.runwayImageModel,
    bflImageModels: opts.bflImageModels,
    bflImageModel: opts.bflImageModel,
    deapiImageModels: opts.deapiImageModels,
    deapiImageModel: opts.deapiImageModel,
    imageSize: opts.imageSize,
    imageQuality: opts.imageQuality,
    imageCount: opts.imageCount
  }).map((estimate) => {
    const estimation = getImageEstimation(estimate.provider, estimate.model)
    return {
      step: 'image' as const,
      provider: estimate.provider,
      model: estimate.model,
      totalCost: applyCostMultiplier(estimate.totalCost, estimation.costMultiplier),
      costMultiplier: estimation.costMultiplier,
    }
  })
}

export const buildVideoEstimates = (opts: RuntimeOptions): VideoStepEstimate[] => {
  const hasVideo = (opts.geminiVideoModels?.length ?? 0) > 0
    || !!opts.geminiVideoModel
    || (opts.minimaxVideoModels?.length ?? 0) > 0
    || !!opts.minimaxVideoModel
    || (opts.glmVideoModels?.length ?? 0) > 0
    || !!opts.glmVideoModel
    || (opts.grokVideoModels?.length ?? 0) > 0
    || !!opts.grokVideoModel
    || (opts.runwayVideoModels?.length ?? 0) > 0
    || !!opts.runwayVideoModel
    || (opts.deapiVideoModels?.length ?? 0) > 0
    || !!opts.deapiVideoModel
  if (!hasVideo) return []

  return estimateVideoCosts({
    geminiVideoModels: opts.geminiVideoModels,
    geminiVideoModel: opts.geminiVideoModel,
    minimaxVideoModels: opts.minimaxVideoModels,
    minimaxVideoModel: opts.minimaxVideoModel,
    glmVideoModels: opts.glmVideoModels,
    glmVideoModel: opts.glmVideoModel,
    grokVideoModels: opts.grokVideoModels,
    grokVideoModel: opts.grokVideoModel,
    runwayVideoModels: opts.runwayVideoModels,
    runwayVideoModel: opts.runwayVideoModel,
    deapiVideoModels: opts.deapiVideoModels,
    deapiVideoModel: opts.deapiVideoModel,
    videoDuration: opts.videoDuration,
    videoSize: opts.videoSize,
    videoAspectRatio: opts.videoAspectRatio,
    videoResolution: opts.videoResolution,
    videoMode: opts.videoMode
  }).map((estimate) => {
    const estimation = getVideoEstimation(estimate.provider, estimate.model)
    return {
      step: 'video' as const,
      provider: estimate.provider,
      model: estimate.model,
      totalCost: applyCostMultiplier(estimate.totalCost, estimation.costMultiplier),
      costMultiplier: estimation.costMultiplier,
    }
  })
}

export const buildMusicEstimates = async (opts: RuntimeOptions): Promise<MusicStepEstimate[]> => {
  const hasMusic = (opts.elevenlabsMusicModels?.length ?? 0) > 0
    || !!opts.elevenlabsMusicModel
    || (opts.minimaxMusicModels?.length ?? 0) > 0
    || !!opts.minimaxMusicModel
    || (opts.deapiMusicModels?.length ?? 0) > 0
    || !!opts.deapiMusicModel
    || (opts.geminiMusicModels?.length ?? 0) > 0
    || !!opts.geminiMusicModel
  if (!hasMusic) return []

  const estimates = estimateMusicCosts({
    elevenlabsMusicModels: opts.elevenlabsMusicModels,
    elevenlabsMusicModel: opts.elevenlabsMusicModel,
    minimaxMusicModels: opts.minimaxMusicModels,
    minimaxMusicModel: opts.minimaxMusicModel,
    deapiMusicModels: opts.deapiMusicModels,
    deapiMusicModel: opts.deapiMusicModel,
    geminiMusicModels: opts.geminiMusicModels,
    geminiMusicModel: opts.geminiMusicModel,
    musicDuration: opts.musicDuration,
    musicLyricsFile: opts.musicLyricsFile,
    musicInstrumental: opts.musicInstrumental
  })

  const results: MusicStepEstimate[] = []
  for (const estimate of estimates) {
    const estimation = getMusicEstimation(estimate.provider, estimate.model)
    if (estimate.provider === 'deapi') {
      const params = normalizeDeapiMusicParams(
        estimate.model as Parameters<typeof normalizeDeapiMusicParams>[0],
        opts.musicDuration
      )
      const price = await resolveDeapiMusicPrice({
        model: estimate.model as Parameters<typeof resolveDeapiMusicPrice>[0]['model'],
        params
      })
      results.push({
        step: 'music',
        provider: estimate.provider,
        model: estimate.model,
        lyricsSource: estimate.lyricsSource,
        totalCost: price.source === 'provider_quote'
          ? price.totalCost
          : applyCostMultiplier(price.totalCost, estimation.costMultiplier),
        costMultiplier: price.source === 'provider_quote' ? 1 : estimation.costMultiplier,
        ...(price.warning ? { note: price.warning } : estimate.note !== undefined ? { note: estimate.note } : {})
      })
      continue
    }

    results.push({
      step: 'music',
      provider: estimate.provider,
      model: estimate.model,
      lyricsSource: estimate.lyricsSource,
      totalCost: applyCostMultiplier(estimate.totalCost, estimation.costMultiplier),
      costMultiplier: estimation.costMultiplier,
      ...(estimate.note !== undefined ? { note: estimate.note } : {})
    })
  }
  return results
}
