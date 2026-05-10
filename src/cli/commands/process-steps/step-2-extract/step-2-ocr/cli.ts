import type { ProviderSpec, RuntimeOptions, Step2ProviderSelectionFilter } from '~/types'
import { collectStep2ProviderSpecs } from '../step-2-shared/provider-registry'

export const collectOcrProviderSpecs = (
  options: Pick<RuntimeOptions, 'useTesseract' | 'useOcrmypdf' | 'usePaddleOcr' | 'step2SelectionOrigins' | 'mistralOcrModel' | 'mistralOcrModels' | 'glmOcrModel' | 'glmOcrModels' | 'kimiOcrModel' | 'kimiOcrModels' | 'openaiOcrModel' | 'openaiOcrModels' | 'anthropicOcrModel' | 'anthropicOcrModels' | 'geminiOcrModel' | 'geminiOcrModels' | 'deepinfraOcrModel' | 'deepinfraOcrModels' | 'awsTextractModel' | 'awsTextractModels' | 'gcloudDocaiModel' | 'gcloudDocaiModels'>,
  filter?: Step2ProviderSelectionFilter
): ProviderSpec[] => {
  return collectStep2ProviderSpecs('ocr', options as Record<string, unknown>, filter)
}
