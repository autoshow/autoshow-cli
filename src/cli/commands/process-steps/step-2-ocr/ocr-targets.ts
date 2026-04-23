import type { ExtractionOptions, OcrTarget, Step2ProviderSelectionOrigin } from '~/types'
import { sanitizeModelName } from '~/cli/commands/process-steps/target-runner'
import { collectOcrProviderSpecs } from './cli'
import type { Step2ProviderSelectionFilter } from '../step-2-shared/provider-registry'

export const collectExplicitOcrTargets = (
  opts: Pick<ExtractionOptions, 'useTesseract' | 'useOcrmypdf' | 'usePaddleOcr' | 'mistralOcrModel' | 'glmOcrModel' | 'openaiOcrModel' | 'anthropicOcrModel' | 'geminiOcrModel'> & {
    step2SelectionOrigins?: Partial<Record<string, Step2ProviderSelectionOrigin>> | undefined
    provider?: string[] | undefined
  },
  filter?: Step2ProviderSelectionFilter
): OcrTarget[] => {
  return collectOcrProviderSpecs(opts as Parameters<typeof collectOcrProviderSpecs>[0], filter).map((spec) => ({
    service: (spec.provider === 'mistral-ocr'
      ? 'mistral'
        : spec.provider === 'glm-ocr'
          ? 'glm'
        : spec.provider === 'openai-ocr'
          ? 'openai'
          : spec.provider === 'anthropic-ocr'
            ? 'anthropic'
          : spec.provider === 'gemini-ocr'
            ? 'gemini'
        : spec.provider) as OcrTarget['service'],
    model: spec.model ?? spec.provider
  }))
}

export const getOcrTargetDirectoryName = (target: OcrTarget): string =>
  `${sanitizeModelName(target.service)}-${sanitizeModelName(target.model)}`

export const buildExtractionOptionsForTarget = (
  opts: ExtractionOptions,
  target: OcrTarget
): ExtractionOptions => ({
  ...opts,
  useTesseract: target.service === 'tesseract' ? true : undefined,
  useOcrmypdf: target.service === 'ocrmypdf' ? true : undefined,
  usePaddleOcr: target.service === 'paddle-ocr' ? true : undefined,
  mistralOcrModel: target.service === 'mistral' ? target.model : undefined,
  glmOcrModel: target.service === 'glm' ? target.model : undefined,
  openaiOcrModel: target.service === 'openai' ? target.model : undefined,
  anthropicOcrModel: target.service === 'anthropic' ? target.model : undefined,
  geminiOcrModel: target.service === 'gemini' ? target.model : undefined
})
