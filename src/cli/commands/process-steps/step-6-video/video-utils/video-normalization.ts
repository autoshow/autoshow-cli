import type {
  GeminiDurationSeconds,
  GeminiResolution,
  GlmVideoDurationSeconds,
  GlmVideoFps,
  GlmVideoModel,
  GlmVideoQuality,
  GrokVideoDurationSeconds,
  GrokVideoResolution,
  MinimaxApiResolution,
  MinimaxDurationSeconds,
  MinimaxResolution,
  MinimaxVideoModel,
  RunwayDurationSeconds,
  RunwayRatio,
  VideoMode
} from '~/types'
import { CLIUsageError } from '~/utils/error-handler'

export const normalizeGeminiDuration = (
  duration: number | undefined,
  resolution?: GeminiResolution | string | undefined,
  mode?: VideoMode | undefined
): GeminiDurationSeconds => {
  if (resolution === '1080p' || resolution === '4k' || mode === 'reference-to-video' || mode === 'extend') return 8
  if (typeof duration !== 'number' || !Number.isFinite(duration)) return 4
  const n = Math.floor(duration)
  if (n <= 4) return 4
  if (n <= 6) return 6
  return 8
}

export const normalizeGeminiResolution = (
  resolution: string | undefined,
  model?: string | undefined
): GeminiResolution => {
  if (resolution === undefined || resolution === '') return '720p'
  if (resolution !== '720p' && resolution !== '1080p' && resolution !== '4k') {
    throw CLIUsageError(`Invalid --video-resolution value "${resolution}" for Gemini. Expected 720p, 1080p, or 4k.`)
  }
  if (resolution === '4k' && model === 'veo-3.1-lite-generate-preview') {
    throw CLIUsageError('Gemini Veo 3.1 Lite does not support --video-resolution 4k. Use veo-3.1-generate-preview or veo-3.1-fast-generate-preview for 4k.')
  }
  if (resolution === '4k') return '4k'
  if (resolution === '1080p') return '1080p'
  return '720p'
}

export const isMinimaxHailuoModel = (model: MinimaxVideoModel): boolean => {
  return model === 'MiniMax-Hailuo-2.3'
    || model === 'MiniMax-Hailuo-2.3-Fast'
}

export const normalizeMinimaxResolution = (
  model: MinimaxVideoModel,
  resolution: string | undefined
): MinimaxResolution => {
  if (!isMinimaxHailuoModel(model)) {
    return '720p'
  }
  return resolution === '1080p' ? '1080p' : '720p'
}

export const normalizeMinimaxResolutionForApi = (
  model: MinimaxVideoModel,
  resolution: string | undefined
): MinimaxApiResolution => {
  if (resolution === '1080p') {
    return isMinimaxHailuoModel(model) ? '1080P' : '720P'
  }
  return isMinimaxHailuoModel(model) ? '768P' : '720P'
}

export const normalizeMinimaxDuration = (
  model: MinimaxVideoModel,
  resolution: MinimaxResolution,
  duration: number | undefined
): MinimaxDurationSeconds => {
  if (!isMinimaxHailuoModel(model)) {
    return 6
  }
  if (resolution === '1080p') {
    return 6
  }
  if (typeof duration !== 'number' || !Number.isFinite(duration)) {
    return 6
  }
  return Math.floor(duration) <= 6 ? 6 : 10
}

export const normalizeMinimaxDurationForApi = (
  model: MinimaxVideoModel,
  resolution: MinimaxApiResolution,
  duration: number | undefined
): MinimaxDurationSeconds => {
  if (!isMinimaxHailuoModel(model)) {
    return 6
  }
  if (resolution === '1080P') {
    return 6
  }
  if (typeof duration !== 'number' || !Number.isFinite(duration)) {
    return 6
  }
  return Math.floor(duration) <= 6 ? 6 : 10
}

const GLM_COGVIDEOX_SIZES = new Set([
  '1280x720',
  '720x1280',
  '1024x1024',
  '1920x1080',
  '1080x1920',
  '2048x1080',
  '3840x2160'
])

export const normalizeGlmDuration = (
  model: GlmVideoModel,
  duration: number | undefined
): GlmVideoDurationSeconds => {
  if (model.startsWith('viduq1-')) return 5
  if (model.startsWith('vidu2-')) return 4
  if (typeof duration !== 'number' || !Number.isFinite(duration)) return 5
  return Math.floor(duration) <= 5 ? 5 : 10
}

const GLM_VIDU2_SIZES = new Set([
  '720x480',
  '1280x720'
])

export const normalizeGlmSize = (model: GlmVideoModel, size: string | undefined): string => {
  if (model.startsWith('viduq1-')) return '1920x1080'
  if (model.startsWith('vidu2-')) return size && GLM_VIDU2_SIZES.has(size) ? size : '1280x720'
  return size && GLM_COGVIDEOX_SIZES.has(size) ? size : '1920x1080'
}

export const normalizeGlmQuality = (quality: string | undefined): GlmVideoQuality => {
  return quality === 'quality' ? 'quality' : 'speed'
}

export const normalizeGlmFps = (fps: number | undefined): GlmVideoFps => {
  return fps === 60 ? 60 : 30
}

export const normalizeGlmAspectRatio = (aspectRatio: string | undefined): string => {
  const allowed = new Set(['16:9', '9:16', '1:1', '4:3', '3:4'])
  return aspectRatio && allowed.has(aspectRatio) ? aspectRatio : '16:9'
}

export const normalizeGrokVideoDuration = (duration: number | undefined): GrokVideoDurationSeconds => {
  if (typeof duration !== 'number' || !Number.isFinite(duration)) return 8
  return Math.min(15, Math.max(1, Math.floor(duration))) as GrokVideoDurationSeconds
}

export const normalizeGrokVideoExtensionDuration = (duration: number | undefined): number => {
  if (typeof duration !== 'number' || !Number.isFinite(duration)) return 6
  return Math.min(10, Math.max(1, Math.floor(duration)))
}

export const normalizeGrokVideoResolution = (resolution: string | undefined): GrokVideoResolution => {
  if (resolution === undefined || resolution === '') return '480p'
  if (resolution === '480p' || resolution === '720p') return resolution
  throw CLIUsageError(`Invalid --video-resolution value "${resolution}" for Grok. Expected 480p or 720p.`)
}

export const normalizeGrokVideoAspectRatio = (aspectRatio: string | undefined): string => {
  const allowed = new Set(['1:1', '16:9', '9:16', '4:3', '3:4', '3:2', '2:3'])
  return aspectRatio && allowed.has(aspectRatio) ? aspectRatio : '16:9'
}

export const normalizeRunwayDuration = (duration: number | undefined): RunwayDurationSeconds => {
  if (typeof duration !== 'number' || !Number.isFinite(duration)) return 5
  return Math.min(10, Math.max(2, Math.floor(duration))) as RunwayDurationSeconds
}

export const normalizeRunwayRatio = (aspectRatio: string | undefined): RunwayRatio => {
  if (aspectRatio === '9:16' || aspectRatio === '720:1280') return '720:1280'
  return '1280:720'
}
