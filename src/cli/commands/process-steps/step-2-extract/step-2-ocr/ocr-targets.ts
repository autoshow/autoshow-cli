import type { ExtractionOptions, OcrTarget, Step2ProviderSelectionFilter, Step2ProviderSelectionOrigin } from '~/types'
import { CLIUsageError } from '~/utils/error-handler'
import { sanitizeModelName } from '~/cli/commands/process-steps/target-runner'
import { collectOcrProviderSpecs } from './cli'

const providerToOcrService = (provider: string): OcrTarget['service'] => {
  if (provider === 'mistral-ocr') return 'mistral'
  if (provider === 'glm-ocr') return 'glm'
  if (provider === 'kimi-ocr') return 'kimi'
  if (provider === 'openai-ocr') return 'openai'
  if (provider === 'anthropic-ocr') return 'anthropic'
  if (provider === 'gemini-ocr') return 'gemini'
  if (provider === 'deepinfra-ocr') return 'deepinfra'
  if (provider === 'unstructured-ocr') return 'unstructured'
  return provider as OcrTarget['service']
}

export const collectExplicitOcrTargets = (
  opts: Pick<ExtractionOptions, 'useTesseract' | 'useOcrmypdf' | 'usePaddleOcr' | 'mistralOcrModel' | 'glmOcrModel' | 'kimiOcrModel' | 'openaiOcrModel' | 'anthropicOcrModel' | 'geminiOcrModel' | 'deepinfraOcrModel' | 'awsTextractModel' | 'gcloudDocaiModel' | 'unstructuredOcrModel'> & {
    step2SelectionOrigins?: Partial<Record<string, Step2ProviderSelectionOrigin>> | undefined
    provider?: string[] | undefined
  },
  filter?: Step2ProviderSelectionFilter
): OcrTarget[] => {
  return collectOcrProviderSpecs(opts as Parameters<typeof collectOcrProviderSpecs>[0], filter).map((spec) => ({
    service: providerToOcrService(spec.provider),
    model: spec.model ?? spec.provider
  }))
}

export const resolvePrimaryOcrTarget = (
  requestedTargets: OcrTarget[],
  primaryOcr: string | undefined
): OcrTarget | undefined => {
  const requested = primaryOcr?.trim()
  if (!requested) {
    return undefined
  }

  const slashIndex = requested.indexOf('/')
  const matches = slashIndex === -1
    ? requestedTargets.filter((target) => target.service === requested)
    : requestedTargets.filter((target) =>
        target.service === requested.slice(0, slashIndex) && target.model === requested.slice(slashIndex + 1)
      )

  if (matches.length === 1) {
    return matches[0]
  }

  if (matches.length > 1) {
    throw CLIUsageError(`--primary-ocr ${requested} matches multiple requested OCR providers. Use service/model.`)
  }

  const available = requestedTargets.map((target) => `${target.service}/${target.model}`).join(', ')
  throw CLIUsageError(`--primary-ocr ${requested} does not match a requested OCR provider. Requested: ${available}`)
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
  kimiOcrModel: target.service === 'kimi' ? target.model : undefined,
  openaiOcrModel: target.service === 'openai' ? target.model : undefined,
  anthropicOcrModel: target.service === 'anthropic' ? target.model : undefined,
  geminiOcrModel: target.service === 'gemini' ? target.model : undefined,
  deepinfraOcrModel: target.service === 'deepinfra' ? target.model : undefined,
  awsTextractModel: target.service === 'aws-textract' ? target.model : undefined,
  gcloudDocaiModel: target.service === 'gcloud-docai' ? target.model : undefined,
  unstructuredOcrModel: target.service === 'unstructured' ? target.model : undefined
})
