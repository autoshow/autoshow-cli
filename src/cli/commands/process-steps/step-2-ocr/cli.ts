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
  options: Pick<RuntimeOptions, 'useOcrmypdf' | 'usePaddleOcr' | 'mistralOcrModel' | 'glmOcrModel'>
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
