import type { OcrSourceKind } from './normalize'

export type OcrProviderKey = 'tesseract' | 'ocrmypdf' | 'paddle-ocr' | 'mistral-ocr' | 'glm-ocr' | 'openai-ocr' | 'anthropic-ocr' | 'gemini-ocr'

type OcrProviderCapability = {
  supports: OcrSourceKind[]
  fallbackOrder: OcrProviderKey[]
}

export const OCR_CAPABILITY_MATRIX: Record<OcrProviderKey, OcrProviderCapability> = {
  tesseract: {
    supports: ['pdf', 'image', 'office-pdf', 'rtf-pdf', 'cbz-images'],
    fallbackOrder: ['paddle-ocr', 'mistral-ocr', 'ocrmypdf']
  },
  ocrmypdf: {
    supports: ['pdf', 'office-pdf', 'rtf-pdf'],
    fallbackOrder: ['tesseract', 'paddle-ocr']
  },
  'paddle-ocr': {
    supports: ['pdf', 'image', 'office-pdf', 'rtf-pdf', 'cbz-images'],
    fallbackOrder: ['tesseract', 'mistral-ocr']
  },
  'mistral-ocr': {
    supports: ['pdf', 'image', 'office-pdf', 'rtf-pdf', 'cbz-images'],
    fallbackOrder: ['glm-ocr', 'paddle-ocr', 'tesseract']
  },
  'glm-ocr': {
    supports: ['article', 'pdf', 'image', 'office-pdf', 'rtf-pdf', 'cbz-images'],
    fallbackOrder: ['mistral-ocr', 'paddle-ocr', 'tesseract']
  },
  'openai-ocr': {
    supports: ['pdf', 'image', 'office-pdf', 'rtf-pdf', 'cbz-images'],
    fallbackOrder: ['glm-ocr', 'mistral-ocr', 'paddle-ocr', 'tesseract']
  },
  'anthropic-ocr': {
    supports: ['pdf', 'image', 'office-pdf', 'rtf-pdf', 'cbz-images'],
    fallbackOrder: ['openai-ocr', 'glm-ocr', 'mistral-ocr', 'paddle-ocr', 'tesseract']
  },
  'gemini-ocr': {
    supports: ['pdf', 'image', 'office-pdf', 'rtf-pdf', 'cbz-images'],
    fallbackOrder: ['anthropic-ocr', 'openai-ocr', 'glm-ocr', 'mistral-ocr', 'paddle-ocr', 'tesseract']
  }
}

export const getCompatibleOcrProviders = (
  sourceKind: OcrSourceKind
): OcrProviderKey[] =>
  Object.entries(OCR_CAPABILITY_MATRIX)
    .filter(([, capability]) => capability.supports.includes(sourceKind))
    .map(([provider]) => provider as OcrProviderKey)

export const supportsOcrSourceKind = (
  provider: OcrProviderKey,
  sourceKind: OcrSourceKind
): boolean => OCR_CAPABILITY_MATRIX[provider].supports.includes(sourceKind)

export const getOcrFallbackOrder = (
  provider: OcrProviderKey
): OcrProviderKey[] => OCR_CAPABILITY_MATRIX[provider].fallbackOrder
