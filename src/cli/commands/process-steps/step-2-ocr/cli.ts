import type { OcrPolicy, ProviderSpec, RuntimeOptions } from '~/types'
import { collectStep2ProviderSpecs, type Step2ProviderSelectionFilter } from '../step-2-shared/provider-registry'

export const collectOcrProviderSpecs = (
  options: Pick<RuntimeOptions, 'useTesseract' | 'useOcrmypdf' | 'usePaddleOcr' | 'step2SelectionOrigins' | 'mistralOcrModel' | 'mistralOcrModels' | 'glmOcrModel' | 'glmOcrModels' | 'openaiOcrModel' | 'openaiOcrModels' | 'anthropicOcrModel' | 'anthropicOcrModels' | 'geminiOcrModel' | 'geminiOcrModels'>,
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
  epubBackend: options.useEpubCalibre ? 'calibre' : options.useEpubBun ? 'bun' : undefined,
  urlBackend: options.urlBackend
})
