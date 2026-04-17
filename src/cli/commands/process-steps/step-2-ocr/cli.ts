import type { OcrPolicy, ProviderSpec, RuntimeOptions } from '~/types'
import { validateGlmOcrModel, validateMistralOcrModel } from '~/cli/commands/setup-and-utilities/models/model-options'
import { CLIUsageError } from '~/utils/error-handler'

type OcrProviderDefinition = {
  defaultModel?: string | undefined
  normalizeModel?: ((model: string) => string) | undefined
}

const OCR_PROVIDER_DEFINITIONS: Record<string, OcrProviderDefinition> = {
  tesseract: {
    defaultModel: 'tesseract'
  },
  ocrmypdf: {
    defaultModel: 'ocrmypdf'
  },
  'paddle-ocr': {
    defaultModel: 'paddle-ocr'
  },
  'mistral-ocr': {
    defaultModel: 'mistral-ocr-latest',
    normalizeModel: validateMistralOcrModel
  },
  'glm-ocr': {
    defaultModel: 'glm-ocr',
    normalizeModel: validateGlmOcrModel
  }
}

const parseProviderSpec = (
  value: string
): ProviderSpec => {
  const trimmed = value.trim()
  if (trimmed.length === 0) {
    throw CLIUsageError('Invalid --provider value "". Expected <provider[:model]>.')
  }

  const parts = trimmed.split(':')
  const providerToken = parts[0]
  if (typeof providerToken !== 'string') {
    throw CLIUsageError(`Invalid --provider value "${trimmed}". Expected <provider[:model]>.`)
  }

  const provider = providerToken.trim().toLowerCase()
  const definition = OCR_PROVIDER_DEFINITIONS[provider]
  if (!definition) {
    throw CLIUsageError(`Unsupported OCR provider "${provider}" in --provider ${trimmed}.`)
  }

  const rawModel = parts.slice(1).join(':').trim()
  const resolvedModel = rawModel.length > 0 ? rawModel : definition.defaultModel
  const normalizedModel = resolvedModel && definition.normalizeModel
    ? definition.normalizeModel(resolvedModel)
    : resolvedModel

  return normalizedModel
    ? { provider, model: normalizedModel }
    : { provider }
}

const appendProviderSpec = (
  specs: ProviderSpec[],
  spec: ProviderSpec
): void => {
  const key = `${spec.provider}:${spec.model ?? ''}`
  if (specs.some((entry) => `${entry.provider}:${entry.model ?? ''}` === key)) {
    return
  }
  specs.push(spec)
}

export const parseOcrProviderSpec = (value: string): ProviderSpec =>
  parseProviderSpec(value)

export const collectOcrProviderSpecs = (
  options: Pick<RuntimeOptions, 'provider' | 'useOcrmypdf' | 'usePaddleOcr' | 'mistralOcrModel' | 'glmOcrModel'>
): ProviderSpec[] => {
  const specs: ProviderSpec[] = []

  if (options.useOcrmypdf) {
    appendProviderSpec(specs, { provider: 'ocrmypdf', model: 'ocrmypdf' })
  }
  if (options.usePaddleOcr) {
    appendProviderSpec(specs, { provider: 'paddle-ocr', model: 'paddle-ocr' })
  }
  if (options.mistralOcrModel) {
    appendProviderSpec(specs, { provider: 'mistral-ocr', model: options.mistralOcrModel })
  }
  if (options.glmOcrModel) {
    appendProviderSpec(specs, { provider: 'glm-ocr', model: options.glmOcrModel })
  }
  for (const rawSpec of options.provider ?? []) {
    appendProviderSpec(specs, parseOcrProviderSpec(rawSpec))
  }

  return specs
}

export const buildOcrPolicy = (
  options: RuntimeOptions
): OcrPolicy => ({
  providers: collectOcrProviderSpecs(options),
  batch: {
    limit: options.batchLimit,
    all: options.batchAll,
    order: options.batchOrder,
    concurrency: options.batchConcurrency
  },
  resume: {
    ...(options.resumeMissing ? { path: options.resumeMissing } : {})
  },
  render: {
    outputFormat: options.out,
    languages: options.lang,
    ...(options.password ? { password: options.password } : {})
  },
  epubBackend: options.useEpubCalibre ? 'calibre' : options.useEpubBun ? 'bun' : undefined,
  urlBackend: options.urlBackend
})
