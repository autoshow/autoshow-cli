import type { GeminiVideoModel, GlmVideoModel, GrokVideoModel, MinimaxVideoModel, RunwayVideoModel, Step6VideoMetadata, VideoGenOptions, VideoMode, VideoTarget } from '~/types'
import { validateGeminiVideoModel, validateGlmVideoModel, validateGrokVideoModel, validateMinimaxVideoModel, validateRunwayVideoModel } from '~/cli/commands/setup-and-utilities/models/model-options'
import { buildSingleArtifactMap, getSingleFileArtifactName } from '~/cli/commands/process-steps/target-runner'
import { CLIUsageError } from '~/utils/error-handler'
import { runGeminiVideoGen } from './video-services/gemini/run-gemini-video-gen'
import { runMinimaxVideoGen } from './video-services/minimax/run-minimax-video-gen'
import { runGlmVideoGen } from './video-services/glm/run-glm-video-gen'
import { runGrokVideoGen } from './video-services/grok/run-grok-video-gen'
import { runRunwayVideoGen } from './video-services/runway/run-runway-video-gen'
import { normalizeGeminiResolution } from './video-utils/video-normalization'
import { validateVideoMediaReferences } from './video-utils/video-media-inputs'

const VIDEO_MODES = ['text', 'image-to-video', 'reference-to-video', 'interpolate', 'extend', 'edit'] as const

const resolveVideoMode = (value: string | undefined): VideoMode => {
  if (value === undefined || value.length === 0) return 'text'
  if ((VIDEO_MODES as readonly string[]).includes(value)) return value as VideoMode
  throw CLIUsageError(`Invalid --video-mode value "${value}". Expected text, image-to-video, reference-to-video, interpolate, extend, or edit.`)
}

const hasValue = (value: unknown): boolean =>
  Array.isArray(value) ? value.length > 0 : value !== undefined && value !== ''

const validateModeInputs = (options: VideoGenOptions, mode: VideoMode): void => {
  const referenceImages = options.videoReferenceImages ?? []
  if (referenceImages.length > 3) {
    throw CLIUsageError('--video-reference-image supports at most 3 reference images.')
  }

  const unexpected: string[] = []
  const addUnexpected = (condition: boolean, flagName: string): void => {
    if (condition) unexpected.push(flagName)
  }

  if (mode === 'text') {
    addUnexpected(hasValue(options.videoInputImage), '--video-input-image')
    addUnexpected(hasValue(options.videoLastFrame), '--video-last-frame')
    addUnexpected(referenceImages.length > 0, '--video-reference-image')
    addUnexpected(hasValue(options.videoInputVideo), '--video-input-video')
  } else if (mode === 'image-to-video') {
    if (!options.videoInputImage) throw CLIUsageError('--video-mode image-to-video requires --video-input-image.')
    addUnexpected(hasValue(options.videoLastFrame), '--video-last-frame')
    addUnexpected(referenceImages.length > 0, '--video-reference-image')
    addUnexpected(hasValue(options.videoInputVideo), '--video-input-video')
  } else if (mode === 'reference-to-video') {
    if (referenceImages.length === 0) throw CLIUsageError('--video-mode reference-to-video requires at least one --video-reference-image.')
    addUnexpected(hasValue(options.videoInputImage), '--video-input-image')
    addUnexpected(hasValue(options.videoLastFrame), '--video-last-frame')
    addUnexpected(hasValue(options.videoInputVideo), '--video-input-video')
  } else if (mode === 'interpolate') {
    if (!options.videoInputImage) throw CLIUsageError('--video-mode interpolate requires --video-input-image.')
    if (!options.videoLastFrame) throw CLIUsageError('--video-mode interpolate requires --video-last-frame.')
    addUnexpected(referenceImages.length > 0, '--video-reference-image')
    addUnexpected(hasValue(options.videoInputVideo), '--video-input-video')
  } else if (mode === 'extend') {
    if (!options.videoInputVideo) throw CLIUsageError('--video-mode extend requires --video-input-video.')
    addUnexpected(hasValue(options.videoInputImage), '--video-input-image')
    addUnexpected(hasValue(options.videoLastFrame), '--video-last-frame')
    addUnexpected(referenceImages.length > 0, '--video-reference-image')
  } else if (mode === 'edit') {
    if (!options.videoInputVideo) throw CLIUsageError('--video-mode edit requires --video-input-video.')
    addUnexpected(hasValue(options.videoInputImage), '--video-input-image')
    addUnexpected(hasValue(options.videoLastFrame), '--video-last-frame')
    addUnexpected(referenceImages.length > 0, '--video-reference-image')
    addUnexpected(hasValue(options.videoDuration), '--video-duration')
    addUnexpected(hasValue(options.videoAspectRatio), '--video-aspect-ratio')
    addUnexpected(hasValue(options.videoResolution), '--video-resolution')
  }

  if (unexpected.length > 0) {
    throw CLIUsageError(`${unexpected.join(', ')} ${unexpected.length === 1 ? 'is' : 'are'} not valid with --video-mode ${mode}.`)
  }
}

const rejectUnsupportedMode = (
  provider: string,
  model: string,
  mode: VideoMode,
  supportedModes: readonly VideoMode[]
): void => {
  if (!supportedModes.includes(mode)) {
    throw CLIUsageError(`--video-mode ${mode} is not supported by ${provider}/${model}.`)
  }
}

const isSupportedOrSkippedForAllVideo = (
  options: VideoGenOptions,
  provider: string,
  model: string,
  mode: VideoMode,
  supportedModes: readonly VideoMode[]
): boolean => {
  if (supportedModes.includes(mode)) return true
  if (options.allVideo) return false
  rejectUnsupportedMode(provider, model, mode, supportedModes)
  return false
}

const isGeminiStandardOrFast = (model: GeminiVideoModel): boolean =>
  model === 'veo-3.1-generate-preview' || model === 'veo-3.1-fast-generate-preview'

const getMinimaxSupportedVideoModes = (model: MinimaxVideoModel): readonly VideoMode[] => {
  if (model === 'S2V-01') return ['reference-to-video']
  if (model === 'MiniMax-Hailuo-2.3') return ['text', 'image-to-video']
  if (model === 'MiniMax-Hailuo-2.3-Fast' || model === 'I2V-01' || model === 'I2V-01-Director' || model === 'I2V-01-live') return ['image-to-video']
  return ['text']
}

const getGlmSupportedVideoModes = (model: GlmVideoModel): readonly VideoMode[] => {
  if (model === 'cogvideox-3') return ['text', 'image-to-video', 'interpolate']
  if (model === 'viduq1-text') return ['text']
  if (model === 'vidu2-image') return ['image-to-video']
  if (model === 'vidu2-start-end') return ['interpolate']
  if (model === 'vidu2-reference') return ['reference-to-video']
  return ['text']
}

export const getVideoArtifactFileName = (
  target: Pick<VideoTarget, 'service' | 'model'>,
  singleTarget: boolean
): string =>
  getSingleFileArtifactName(target, singleTarget, {
    singleFileName: 'generated-video.mp4',
    multiFilePrefix: 'generated-video',
    extension: 'mp4'
  })

export const buildVideoArtifactMap = (metadata: Step6VideoMetadata[]): Record<string, string> =>
  buildSingleArtifactMap(metadata, {
    singleKey: 'video',
    multiKeyPrefix: 'video',
    getService: (entry) => entry.videoGenService,
    getModel: (entry) => entry.videoGenModel,
    getFileName: (entry) => entry.videoFileName
  });

export const collectVideoTargets = (options: VideoGenOptions): VideoTarget[] => {
  const targets: VideoTarget[] = []
  const mode = resolveVideoMode(options.videoMode)
  validateModeInputs(options, mode)

  const geminiModels = options.geminiVideoModels ?? (options.geminiVideoModel ? [options.geminiVideoModel] : [])
  const minimaxModels = options.minimaxVideoModels ?? (options.minimaxVideoModel ? [options.minimaxVideoModel] : [])
  const glmModels = options.glmVideoModels ?? (options.glmVideoModel ? [options.glmVideoModel] : [])
  const grokModels = options.grokVideoModels ?? (options.grokVideoModel ? [options.grokVideoModel] : [])
  const runwayModels = options.runwayVideoModels ?? (options.runwayVideoModel ? [options.runwayVideoModel] : [])
  const hasGrokStorageControls = options.grokVideoStorageFilename || options.grokVideoStorageExpiresAfter !== undefined
  if (hasGrokStorageControls && grokModels.length === 0) {
    throw CLIUsageError('Grok video storage flags require a Grok video provider target.')
  }

  for (const rawModel of geminiModels) {
    const model: GeminiVideoModel = validateGeminiVideoModel(rawModel)
    if (!isSupportedOrSkippedForAllVideo(options, 'gemini', model, mode, ['text', 'image-to-video', 'reference-to-video', 'interpolate', 'extend'])) {
      continue
    }
    if ((mode === 'reference-to-video' || mode === 'extend') && !isGeminiStandardOrFast(model)) {
      if (options.allVideo) continue
      throw CLIUsageError(`--video-mode ${mode} is not supported by gemini/${model}. Use veo-3.1-generate-preview or veo-3.1-fast-generate-preview.`)
    }
    normalizeGeminiResolution(mode === 'extend' ? '720p' : options.videoResolution, model)
    if (options.videoInputImage) {
      validateVideoMediaReferences([options.videoInputImage], { flagName: '--video-input-image', provider: 'gemini', model, kind: 'image' })
    }
    if (options.videoLastFrame) {
      validateVideoMediaReferences([options.videoLastFrame], { flagName: '--video-last-frame', provider: 'gemini', model, kind: 'image' })
    }
    if (options.videoReferenceImages) {
      validateVideoMediaReferences(options.videoReferenceImages, { flagName: '--video-reference-image', provider: 'gemini', model, kind: 'image', maxInputs: 3 })
    }
    if (options.videoInputVideo) {
      validateVideoMediaReferences([options.videoInputVideo], { flagName: '--video-input-video', provider: 'gemini', model, kind: 'video' })
    }

    targets.push({
      service: 'gemini',
      model,
      run: async (prompt, outputDir) => {
        return await runGeminiVideoGen(prompt, outputDir, {
          model,
          mode,
          aspectRatio: options.videoAspectRatio,
          resolution: options.videoResolution,
          durationSeconds: options.videoDuration,
          inputImage: options.videoInputImage,
          lastFrameImage: options.videoLastFrame,
          referenceImages: options.videoReferenceImages,
          inputVideo: options.videoInputVideo
        })
      }
    })
  }

  for (const rawModel of minimaxModels) {
    const model: MinimaxVideoModel = validateMinimaxVideoModel(rawModel)
    if (!isSupportedOrSkippedForAllVideo(options, 'minimax', model, mode, getMinimaxSupportedVideoModes(model))) {
      continue
    }
    if (mode === 'reference-to-video' && (options.videoReferenceImages?.length ?? 0) > 1) {
      throw CLIUsageError('MiniMax S2V-01 supports exactly one --video-reference-image.')
    }
    if (options.videoInputImage) {
      validateVideoMediaReferences([options.videoInputImage], { flagName: '--video-input-image', provider: 'minimax', model, kind: 'image' })
    }
    if (options.videoLastFrame) {
      validateVideoMediaReferences([options.videoLastFrame], { flagName: '--video-last-frame', provider: 'minimax', model, kind: 'image' })
    }
    if (options.videoReferenceImages) {
      validateVideoMediaReferences(options.videoReferenceImages, { flagName: '--video-reference-image', provider: 'minimax', model, kind: 'image', maxInputs: 1 })
    }

    targets.push({
      service: 'minimax',
      model,
      run: async (prompt, outputDir) => {
        return await runMinimaxVideoGen(prompt, outputDir, {
          model,
          mode,
          durationSeconds: options.videoDuration,
          resolution: options.videoResolution,
          inputImage: options.videoInputImage,
          lastFrameImage: options.videoLastFrame,
          referenceImages: options.videoReferenceImages
        })
      }
    })
  }

  for (const rawModel of glmModels) {
    const model: GlmVideoModel = validateGlmVideoModel(rawModel)
    if (!isSupportedOrSkippedForAllVideo(options, 'glm', model, mode, getGlmSupportedVideoModes(model))) {
      continue
    }
    if (options.videoInputImage) {
      validateVideoMediaReferences([options.videoInputImage], { flagName: '--video-input-image', provider: 'glm', model, kind: 'image' })
    }
    if (options.videoLastFrame) {
      validateVideoMediaReferences([options.videoLastFrame], { flagName: '--video-last-frame', provider: 'glm', model, kind: 'image' })
    }
    if (options.videoReferenceImages) {
      validateVideoMediaReferences(options.videoReferenceImages, { flagName: '--video-reference-image', provider: 'glm', model, kind: 'image', maxInputs: 3 })
    }

    targets.push({
      service: 'glm',
      model,
      run: async (prompt, outputDir) => {
        return await runGlmVideoGen(prompt, outputDir, {
          model,
          mode,
          durationSeconds: options.videoDuration,
          size: options.videoSize,
          aspectRatio: options.videoAspectRatio,
          inputImage: options.videoInputImage,
          lastFrameImage: options.videoLastFrame,
          referenceImages: options.videoReferenceImages
        })
      }
    })
  }

  for (const rawModel of grokModels) {
    const model: GrokVideoModel = validateGrokVideoModel(rawModel)
    if (!isSupportedOrSkippedForAllVideo(options, 'grok', model, mode, ['text', 'image-to-video', 'reference-to-video', 'extend', 'edit'])) {
      continue
    }
    if (options.videoInputImage) {
      validateVideoMediaReferences([options.videoInputImage], { flagName: '--video-input-image', provider: 'grok', model, kind: 'image' })
    }
    if (options.videoReferenceImages) {
      validateVideoMediaReferences(options.videoReferenceImages, { flagName: '--video-reference-image', provider: 'grok', model, kind: 'image', maxInputs: 3 })
    }
    if (options.videoInputVideo) {
      validateVideoMediaReferences([options.videoInputVideo], { flagName: '--video-input-video', provider: 'grok', model, kind: 'video' })
    }

    targets.push({
      service: 'grok',
      model,
      run: async (prompt, outputDir) => {
        return await runGrokVideoGen(prompt, outputDir, {
          model,
          mode,
          durationSeconds: options.videoDuration,
          aspectRatio: options.videoAspectRatio,
          resolution: options.videoResolution,
          inputImage: options.videoInputImage,
          referenceImages: options.videoReferenceImages,
          inputVideo: options.videoInputVideo,
          storageFilename: options.grokVideoStorageFilename,
          storageExpiresAfter: options.grokVideoStorageExpiresAfter
        })
      }
    })
  }

  for (const rawModel of runwayModels) {
    const model: RunwayVideoModel = validateRunwayVideoModel(rawModel)
    if (!isSupportedOrSkippedForAllVideo(options, 'runway', model, mode, ['text'])) {
      continue
    }

    targets.push({
      service: 'runway',
      model,
      run: async (prompt, outputDir) => {
        if (prompt === undefined) {
          throw CLIUsageError('Runway video prompt cannot be empty.')
        }
        return await runRunwayVideoGen(prompt, outputDir, {
          model,
          durationSeconds: options.videoDuration,
          aspectRatio: options.videoAspectRatio
        })
      }
    })
  }

  return targets
}
