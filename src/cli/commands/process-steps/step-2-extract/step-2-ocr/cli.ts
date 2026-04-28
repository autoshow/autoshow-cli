import type { OcrPolicy, ProviderSpec, RuntimeOptions, Step2ProviderSelectionFilter } from '~/types'
import { collectStep2ProviderSpecs } from '../step-2-shared/provider-registry'

export const collectOcrProviderSpecs = (
  options: Pick<RuntimeOptions, 'useTesseract' | 'useOcrmypdf' | 'usePaddleOcr' | 'step2SelectionOrigins' | 'mistralOcrModel' | 'mistralOcrModels' | 'glmOcrModel' | 'glmOcrModels' | 'openaiOcrModel' | 'openaiOcrModels' | 'anthropicOcrModel' | 'anthropicOcrModels' | 'geminiOcrModel' | 'geminiOcrModels' | 'awsTextractModel' | 'awsTextractModels' | 'gcloudDocaiModel' | 'gcloudDocaiModels' | 'deapiOcrModel' | 'deapiOcrModels'>,
  filter?: Step2ProviderSelectionFilter
): ProviderSpec[] => {
  return collectStep2ProviderSpecs('ocr', options as Record<string, unknown>, filter)
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
  render: {
    outputFormat: options.out,
    languages: options.lang,
    ...(options.password ? { password: options.password } : {})
  },
  concurrency: {
    provider: options.ocrProviderConcurrency,
    local: options.ocrLocalConcurrency
  },
  epubBackend: options.useEpubCalibre ? 'calibre' : options.useEpubBun ? 'bun' : undefined,
  urlBackend: options.urlBackend
})
