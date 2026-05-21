import { createModelValidator } from '~/cli/commands/setup-and-utilities/models/model-validation'
import type { GeminiVideoModel, GlmVideoModel, GrokVideoModel, MinimaxVideoModel, RunwayVideoModel } from '~/types'

export const SUPPORTED_GEMINI_VIDEO_MODELS = [
  'veo-3.1-fast-generate-preview',
  'veo-3.1-generate-preview',
  'veo-3.1-lite-generate-preview'
] as const satisfies readonly string[]

export const validateGeminiVideoModel = createModelValidator<GeminiVideoModel>(SUPPORTED_GEMINI_VIDEO_MODELS, 'gemini-video')

export const SUPPORTED_MINIMAX_VIDEO_MODELS = [
  'T2V-01',
  'T2V-01-Director',
  'MiniMax-Hailuo-2.3',
  'MiniMax-Hailuo-2.3-Fast',
  'I2V-01-Director',
  'I2V-01-live',
  'I2V-01',
  'S2V-01'
] as const satisfies readonly string[]

export const validateMinimaxVideoModel = createModelValidator<MinimaxVideoModel>(SUPPORTED_MINIMAX_VIDEO_MODELS, 'minimax-video')

export const SUPPORTED_GLM_VIDEO_MODELS = [
  'cogvideox-3',
  'viduq1-text',
  'vidu2-image',
  'vidu2-start-end',
  'vidu2-reference'
] as const satisfies readonly string[]

export const validateGlmVideoModel = createModelValidator<GlmVideoModel>(SUPPORTED_GLM_VIDEO_MODELS, 'glm-video')

export const SUPPORTED_GROK_VIDEO_MODELS = [
  'grok-imagine-video'
] as const satisfies readonly string[]

export const validateGrokVideoModel = createModelValidator<GrokVideoModel>(SUPPORTED_GROK_VIDEO_MODELS, 'grok-video')

export const SUPPORTED_RUNWAY_VIDEO_MODELS = [
  'gen4.5'
] as const satisfies readonly string[]

export const validateRunwayVideoModel = createModelValidator<RunwayVideoModel>(SUPPORTED_RUNWAY_VIDEO_MODELS, 'runway-video')
