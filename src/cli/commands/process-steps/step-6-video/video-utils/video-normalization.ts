import type {
  GeminiDurationSeconds,
  GeminiResolution,
  DeapiVideoFps,
  DeapiVideoModel,
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
  RunwayRatio
} from '~/types'
import { CLIUsageError } from '~/utils/error-handler'

export const normalizeGeminiDuration = (duration: number | undefined): GeminiDurationSeconds => {
  if (typeof duration !== 'number' || !Number.isFinite(duration)) return 4
  const n = Math.floor(duration)
  if (n <= 4) return 4
  if (n <= 6) return 6
  return 8
}

export const normalizeGeminiResolution = (resolution: string | undefined): GeminiResolution => {
  if (resolution === '1080p') return '1080p'
  return '720p'
}

export const isMinimaxHailuoModel = (model: MinimaxVideoModel): boolean => {
  return model === 'MiniMax-Hailuo-2.3' || model === 'MiniMax-Hailuo-02'
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
  if (model === 'viduq1-text') return 5
  if (typeof duration !== 'number' || !Number.isFinite(duration)) return 5
  return Math.floor(duration) <= 5 ? 5 : 10
}

export const normalizeGlmSize = (model: GlmVideoModel, size: string | undefined): string => {
  if (model === 'viduq1-text') return '1920x1080'
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

export const normalizeGrokVideoResolution = (resolution: string | undefined): GrokVideoResolution => {
  return resolution === '720p' ? '720p' : '480p'
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

type DeapiVideoModelSpec = {
  minWidth: number
  maxWidth: number
  defaultWidth: number
  minHeight: number
  maxHeight: number
  defaultHeight: number
  minFrames: number
  maxFrames: number
  defaultFrames: number
  fps: DeapiVideoFps
}

const DEAPI_VIDEO_MODEL_SPECS: Record<DeapiVideoModel, DeapiVideoModelSpec> = {
  Ltxv_13B_0_9_8_Distilled_FP8: {
    minWidth: 256,
    maxWidth: 768,
    defaultWidth: 512,
    minHeight: 256,
    maxHeight: 768,
    defaultHeight: 512,
    minFrames: 30,
    maxFrames: 120,
    defaultFrames: 120,
    fps: 30
  },
  Ltx2_19B_Dist_FP8: {
    minWidth: 512,
    maxWidth: 1024,
    defaultWidth: 768,
    minHeight: 512,
    maxHeight: 1024,
    defaultHeight: 768,
    minFrames: 49,
    maxFrames: 241,
    defaultFrames: 120,
    fps: 24
  },
  Ltx2_3_22B_Dist_INT8: {
    minWidth: 512,
    maxWidth: 1024,
    defaultWidth: 768,
    minHeight: 512,
    maxHeight: 1024,
    defaultHeight: 768,
    minFrames: 49,
    maxFrames: 241,
    defaultFrames: 120,
    fps: 24
  }
}

const parseSize = (size: string): { width: number, height: number } | undefined => {
  const match = /^(\d{2,5})x(\d{2,5})$/i.exec(size.trim())
  if (!match) {
    return undefined
  }
  return {
    width: Number.parseInt(match[1]!, 10),
    height: Number.parseInt(match[2]!, 10)
  }
}

const clamp = (value: number, min: number, max: number): number =>
  Math.max(min, Math.min(max, value))

export const getDeapiVideoFps = (model: DeapiVideoModel): DeapiVideoFps =>
  DEAPI_VIDEO_MODEL_SPECS[model].fps

export const normalizeDeapiVideoFrames = (
  model: DeapiVideoModel,
  durationSeconds: number | undefined
): number => {
  const spec = DEAPI_VIDEO_MODEL_SPECS[model]
  if (typeof durationSeconds !== 'number' || !Number.isFinite(durationSeconds)) {
    return spec.defaultFrames
  }

  const requestedFrames = Math.round(Math.max(0, durationSeconds) * spec.fps)
  return clamp(requestedFrames, spec.minFrames, spec.maxFrames)
}

export const normalizeDeapiVideoDuration = (
  model: DeapiVideoModel,
  durationSeconds: number | undefined
): number => {
  const frames = normalizeDeapiVideoFrames(model, durationSeconds)
  return frames / getDeapiVideoFps(model)
}

export const normalizeDeapiVideoSize = (
  model: DeapiVideoModel,
  size: string | undefined
): { width: number, height: number } => {
  const spec = DEAPI_VIDEO_MODEL_SPECS[model]
  if (size === undefined || size.length === 0) {
    return { width: spec.defaultWidth, height: spec.defaultHeight }
  }

  const parsed = parseSize(size)
  if (!parsed) {
    throw CLIUsageError(`Invalid --video-size value "${size}" for deAPI. Expected WIDTHxHEIGHT, e.g. ${spec.defaultWidth}x${spec.defaultHeight}.`)
  }

  return {
    width: clamp(parsed.width, spec.minWidth, spec.maxWidth),
    height: clamp(parsed.height, spec.minHeight, spec.maxHeight)
  }
}
