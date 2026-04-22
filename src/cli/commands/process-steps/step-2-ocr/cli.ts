import type { OcrPolicy, ProviderSpec, RuntimeOptions } from '~/types'

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

export const collectOcrProviderSpecs = (
  options: Pick<RuntimeOptions, 'useOcrmypdf' | 'usePaddleOcr' | 'mistralOcrModel' | 'mistralOcrModels' | 'glmOcrModel' | 'glmOcrModels' | 'openaiOcrModel' | 'openaiOcrModels' | 'anthropicOcrModel' | 'anthropicOcrModels' | 'geminiOcrModel' | 'geminiOcrModels'>
): ProviderSpec[] => {
  const specs: ProviderSpec[] = []
  const appendModels = (provider: ProviderSpec['provider'], models: string[] | undefined, fallback?: string): void => {
    for (const model of models ?? (fallback ? [fallback] : [])) {
      appendProviderSpec(specs, { provider, model })
    }
  }

  if (options.useOcrmypdf) {
    appendProviderSpec(specs, { provider: 'ocrmypdf', model: 'ocrmypdf' })
  }
  if (options.usePaddleOcr) {
    appendProviderSpec(specs, { provider: 'paddle-ocr', model: 'paddle-ocr' })
  }
  appendModels('mistral-ocr', options.mistralOcrModels, options.mistralOcrModel)
  appendModels('glm-ocr', options.glmOcrModels, options.glmOcrModel)
  appendModels('openai-ocr', options.openaiOcrModels, options.openaiOcrModel)
  appendModels('anthropic-ocr', options.anthropicOcrModels, options.anthropicOcrModel)
  appendModels('gemini-ocr', options.geminiOcrModels, options.geminiOcrModel)

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
