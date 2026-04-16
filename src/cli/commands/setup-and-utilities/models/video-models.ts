import { createModelValidator } from '~/cli/commands/setup-and-utilities/models/model-validation'
import type { GeminiVideoModel, MinimaxVideoModel } from '~/types'
export type { GeminiVideoModel, MinimaxVideoModel } from '~/types'

export const SUPPORTED_GEMINI_VIDEO_MODELS = [
  'veo-3.1-fast-generate-preview',
  'veo-3.1-generate-preview'
] as const satisfies readonly string[]

export const validateGeminiVideoModel = createModelValidator<GeminiVideoModel>(SUPPORTED_GEMINI_VIDEO_MODELS, 'gemini-video')

export const SUPPORTED_MINIMAX_VIDEO_MODELS = [
  'T2V-01',
  'T2V-01-Director',
  'MiniMax-Hailuo-2.3',
  'MiniMax-Hailuo-02'
] as const satisfies readonly string[]

export const validateMinimaxVideoModel = createModelValidator<MinimaxVideoModel>(SUPPORTED_MINIMAX_VIDEO_MODELS, 'minimax-video')
