import type { ExtractionOptions, OcrTarget } from '~/types'
import { sanitizeModelName } from '~/cli/commands/process-steps/target-runner'
import { collectOcrProviderSpecs } from './cli'

export const collectExplicitOcrTargets = (
  opts: Pick<ExtractionOptions, 'useOcrmypdf' | 'usePaddleOcr' | 'mistralOcrModel' | 'glmOcrModel'> & {
    provider?: string[] | undefined
  }
): OcrTarget[] => {
  return collectOcrProviderSpecs(opts as Parameters<typeof collectOcrProviderSpecs>[0]).map((spec) => ({
    service: (spec.provider === 'mistral-ocr'
      ? 'mistral'
      : spec.provider === 'glm-ocr'
        ? 'glm'
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
  useOcrmypdf: target.service === 'ocrmypdf' ? true : undefined,
  usePaddleOcr: target.service === 'paddle-ocr' ? true : undefined,
  mistralOcrModel: target.service === 'mistral' ? target.model : undefined,
  glmOcrModel: target.service === 'glm' ? target.model : undefined
})
