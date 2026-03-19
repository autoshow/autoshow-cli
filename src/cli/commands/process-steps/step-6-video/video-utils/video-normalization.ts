import type { MinimaxVideoModel } from '~/cli/commands/models/model-options'
import type { SoraSeconds, SoraSize, GeminiDurationSeconds, GeminiResolution, MinimaxResolution, MinimaxApiResolution, MinimaxDurationSeconds } from '~/types'


export const clampVideoDuration = (duration: number | undefined): number => {
  if (typeof duration !== 'number' || !Number.isFinite(duration)) return 4
  return Math.min(120, Math.max(1, Math.floor(duration)))
}

export const normalizeSoraSeconds = (duration: number | undefined): SoraSeconds => {
  const d = clampVideoDuration(duration)
  if (d <= 4) return '4'
  if (d <= 8) return '8'
  return '12'
}

export const parseSoraSeconds = (seconds: SoraSeconds): 4 | 8 | 12 => {
  const parsed = Number.parseInt(seconds, 10)
  if (parsed === 4 || parsed === 8 || parsed === 12) {
    return parsed
  }
  return 4
}

export const normalizeSoraSize = (size: string | undefined): SoraSize => {
  if (size === '720x1280' || size === '1280x720' || size === '1024x1792' || size === '1792x1024') {
    return size
  }
  return '720x1280'
}

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
