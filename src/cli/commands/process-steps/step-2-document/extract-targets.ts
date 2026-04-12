import type { ExtractionOptions } from '~/types'
import { sanitizeModelName } from '~/cli/commands/process-steps/target-runner'

export type ExtractTarget = {
  service: 'ocrmypdf' | 'paddle-ocr' | 'mistral'
  model: string
}

export const collectExplicitExtractTargets = (
  opts: Pick<ExtractionOptions, 'useOcrmypdf' | 'usePaddleOcr' | 'mistralOcrModel'>
): ExtractTarget[] => {
  const targets: ExtractTarget[] = []

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

  return targets
}

export const getExtractTargetDirectoryName = (target: ExtractTarget): string =>
  `${sanitizeModelName(target.service)}-${sanitizeModelName(target.model)}`

export const buildExtractionOptionsForTarget = (
  opts: ExtractionOptions,
  target: ExtractTarget
): ExtractionOptions => ({
  ...opts,
  useOcrmypdf: target.service === 'ocrmypdf' ? true : undefined,
  usePaddleOcr: target.service === 'paddle-ocr' ? true : undefined,
  mistralOcrModel: target.service === 'mistral' ? target.model : undefined
})
