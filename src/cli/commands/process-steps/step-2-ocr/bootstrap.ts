import type { OcrTarget } from '~/types'
import { ensureProviderReady } from '~/features/bootstrap-broker'

const toBootstrapProviderId = (
  target: Pick<OcrTarget, 'service' | 'model'>
): string => {
  switch (target.service) {
    case 'tesseract':
      return 'tesseract'
    case 'ocrmypdf':
      return 'ocrmypdf'
    case 'paddle-ocr':
      return 'paddle-ocr'
    case 'mistral':
      return 'mistral-ocr'
    case 'glm':
      return 'glm-ocr'
  }
}

export const ensureOcrTargetSetup = async (
  target: Pick<OcrTarget, 'service' | 'model'>
): Promise<void> => {
  await ensureProviderReady(toBootstrapProviderId(target))
}
