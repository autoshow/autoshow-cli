import type { ExtractionOptions } from '~/types'
import { sanitizeModelName } from '~/cli/commands/process-steps/target-runner'

export type OcrTarget = {
  service: 'ocrmypdf' | 'paddle-ocr' | 'mistral' | 'glm'
  model: string
}

export const collectExplicitOcrTargets = (
  opts: Pick<ExtractionOptions, 'useOcrmypdf' | 'usePaddleOcr' | 'mistralOcrModel' | 'glmOcrModel'>
): OcrTarget[] => {
  const targets: OcrTarget[] = []

  if (opts.useOcrmypdf === true) {
    targets.push({
      service: 'ocrmypdf',
      model: 'ocrmypdf'
    })
  }

  if (opts.usePaddleOcr === true) {
    targets.push({
      service: 'paddle-ocr',
      model: 'paddle-ocr'
    })
  }

  if (typeof opts.mistralOcrModel === 'string' && opts.mistralOcrModel.length > 0) {
    targets.push({
      service: 'mistral',
      model: opts.mistralOcrModel
    })
  }

  if (typeof opts.glmOcrModel === 'string' && opts.glmOcrModel.length > 0) {
    targets.push({
      service: 'glm',
      model: opts.glmOcrModel
    })
  }

  return targets
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
