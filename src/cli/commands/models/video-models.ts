import { CLIUsageError } from '~/utils/error-handler'
import type { SoraVideoModel, GeminiVideoModel, MinimaxVideoModel } from '~/types'
export type { SoraVideoModel, GeminiVideoModel, MinimaxVideoModel } from '~/types'

const formatAllowedValues = (values: readonly string[]): string => values.join(', ')

export const SUPPORTED_SORA_VIDEO_MODELS = [
  'sora-2',
  'sora-2-pro',
] as const satisfies readonly string[]

export const validateSoraVideoModel = (model: string): SoraVideoModel => {
  if (!SUPPORTED_SORA_VIDEO_MODELS.includes(model as SoraVideoModel)) {
    throw CLIUsageError(
      `Invalid --sora-video model "${model}". Allowed values: ${formatAllowedValues(SUPPORTED_SORA_VIDEO_MODELS)}`
    )
  }
  return model as SoraVideoModel
}

export const SUPPORTED_GEMINI_VIDEO_MODELS = [
  'veo-3.1-fast-generate-preview',
  'veo-3.1-generate-preview'
] as const satisfies readonly string[]

export const validateGeminiVideoModel = (model: string): GeminiVideoModel => {
  if (!SUPPORTED_GEMINI_VIDEO_MODELS.includes(model as GeminiVideoModel)) {
    throw CLIUsageError(
      `Invalid --gemini-video model "${model}". Allowed values: ${formatAllowedValues(SUPPORTED_GEMINI_VIDEO_MODELS)}`
    )
  }
  return model as GeminiVideoModel
}

export const SUPPORTED_MINIMAX_VIDEO_MODELS = [
  'T2V-01',
  'T2V-01-Director',
  'MiniMax-Hailuo-2.3',
  'MiniMax-Hailuo-02'
] as const satisfies readonly string[]

export const validateMinimaxVideoModel = (model: string): MinimaxVideoModel => {
  if (!SUPPORTED_MINIMAX_VIDEO_MODELS.includes(model as MinimaxVideoModel)) {
    throw CLIUsageError(
      `Invalid --minimax-video model "${model}". Allowed values: ${formatAllowedValues(SUPPORTED_MINIMAX_VIDEO_MODELS)}`
    )
  }
  return model as MinimaxVideoModel
}
