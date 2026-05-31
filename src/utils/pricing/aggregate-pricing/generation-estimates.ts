import type { ImageStepEstimate, MusicStepEstimate, RuntimeOptions, VideoStepEstimate } from '~/types'
import { estimateImageCosts } from '~/cli/commands/process-steps/step-5-image/image-utils/image-pricing'
import { estimateVideoCosts } from '~/cli/commands/process-steps/step-6-video/video-utils/video-pricing'
import { estimateMusicCosts } from '~/cli/commands/process-steps/step-7-music/music-utils/music-pricing'
import {
  getImageEstimation,
  getMusicEstimation,
  getVideoEstimation
} from '~/cli/commands/setup-and-utilities/models/model-loader'
import { applyCostMultiplier } from '~/utils/pricing/cost-helpers'
import { tryResolveLocalVideoDurationSeconds } from '~/cli/commands/process-steps/step-6-video/video-utils/video-media-inputs'

export const buildImageEstimates = (opts: RuntimeOptions): ImageStepEstimate[] => {
  const hasImage = (opts.geminiImageModels?.length ?? 0) > 0
    || !!opts.geminiImageModel
    || (opts.openaiImageModels?.length ?? 0) > 0
    || !!opts.openaiImageModel
    || (opts.grokImageModels?.length ?? 0) > 0
    || !!opts.grokImageModel
    || (opts.bflImageModels?.length ?? 0) > 0
    || !!opts.bflImageModel
    || (opts.reveImageModels?.length ?? 0) > 0
    || !!opts.reveImageModel
  if (!hasImage) return []

  return estimateImageCosts({
    geminiImageModels: opts.geminiImageModels,
    geminiImageModel: opts.geminiImageModel,
    openaiImageModels: opts.openaiImageModels,
    openaiImageModel: opts.openaiImageModel,
    grokImageModels: opts.grokImageModels,
    grokImageModel: opts.grokImageModel,
    bflImageModels: opts.bflImageModels,
    bflImageModel: opts.bflImageModel,
    reveImageModels: opts.reveImageModels,
    reveImageModel: opts.reveImageModel,
    imageSize: opts.imageSize,
    imageQuality: opts.imageQuality,
    imageCount: opts.imageCount
  }).map((estimate) => {
    const estimation = getImageEstimation(estimate.provider, estimate.model)
    return {
      step: 'image' as const,
      provider: estimate.provider,
      model: estimate.model,
      imageCount: estimate.imageCount,
      totalCost: applyCostMultiplier(estimate.totalCost, estimation.costMultiplier),
      costMultiplier: estimation.costMultiplier,
    }
  })
}

const countGrokInputImages = (opts: RuntimeOptions): number =>
  (opts.videoInputImage ? 1 : 0) + (opts.videoReferenceImages?.length ?? 0)

export const buildVideoEstimates = async (opts: RuntimeOptions): Promise<VideoStepEstimate[]> => {
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
  if (!hasVideo) return []

  const hasGrokVideo = (opts.grokVideoModels?.length ?? 0) > 0 || !!opts.grokVideoModel
  const grokInputVideoDurationSeconds = hasGrokVideo && opts.videoInputVideo
    ? await tryResolveLocalVideoDurationSeconds(opts.videoInputVideo)
    : undefined

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
    videoDuration: opts.videoDuration,
    videoSize: opts.videoSize,
    videoAspectRatio: opts.videoAspectRatio,
    videoResolution: opts.videoResolution,
    videoMode: opts.videoMode,
    ...(hasGrokVideo ? { grokInputImageCount: countGrokInputImages(opts) } : {}),
    ...(grokInputVideoDurationSeconds !== undefined ? { grokInputVideoDurationSeconds } : {})
  }).map((estimate) => {
    const estimation = getVideoEstimation(estimate.provider, estimate.model)
    return {
      step: 'video' as const,
      provider: estimate.provider,
      model: estimate.model,
      durationSeconds: estimate.durationSeconds,
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
    || (opts.geminiMusicModels?.length ?? 0) > 0
    || !!opts.geminiMusicModel
  if (!hasMusic) return []

  const estimates = estimateMusicCosts({
    elevenlabsMusicModels: opts.elevenlabsMusicModels,
    elevenlabsMusicModel: opts.elevenlabsMusicModel,
    minimaxMusicModels: opts.minimaxMusicModels,
    minimaxMusicModel: opts.minimaxMusicModel,
    geminiMusicModels: opts.geminiMusicModels,
    geminiMusicModel: opts.geminiMusicModel,
    musicDuration: opts.musicDuration,
    musicLyricsFile: opts.musicLyricsFile,
    musicInstrumental: opts.musicInstrumental
  })

  const results: MusicStepEstimate[] = []
  for (const estimate of estimates) {
    const estimation = getMusicEstimation(estimate.provider, estimate.model)
    results.push({
      step: 'music',
      provider: estimate.provider,
      model: estimate.model,
      durationSeconds: estimate.durationSeconds,
      lyricsSource: estimate.lyricsSource,
      totalCost: applyCostMultiplier(estimate.totalCost, estimation.costMultiplier),
      costMultiplier: estimation.costMultiplier,
      ...(estimate.note !== undefined ? { note: estimate.note } : {})
    })
  }
  return results
}
