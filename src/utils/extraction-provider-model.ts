import type { ExtractionMetadata } from '~/types'

export type ExtractionProviderModel = {
  provider: string
  model: string
}

const HTML_EXTRACTION_PROVIDER_MODELS: Array<[method: string, provider: string, model: string]> = [
  ['html+defuddle', 'defuddle', 'defuddle'],
  ['html+firecrawl', 'firecrawl', 'firecrawl'],
  ['html+glm-reader', 'glm-reader', 'glm-reader'],
  ['html+spider', 'spider', 'spider'],
  ['html+supadata', 'supadata', 'supadata'],
  ['html+zyte', 'zyte', 'zyte'],
]

export const resolveExtractionProviderModel = (
  metadata: ExtractionMetadata
): ExtractionProviderModel => {
  for (const [method, provider, model] of HTML_EXTRACTION_PROVIDER_MODELS) {
    if (metadata.extractionMethod.includes(method)) {
      return { provider, model }
    }
  }

  if (typeof metadata.ocrService === 'string' && typeof metadata.ocrModel === 'string') {
    return { provider: metadata.ocrService, model: metadata.ocrModel }
  }

  if (metadata.extractionMethod.includes('paddle-ocr')) {
    return { provider: 'paddle-ocr', model: 'paddle-ocr' }
  }
  if (metadata.extractionMethod.includes('ocrmypdf')) {
    return { provider: 'ocrmypdf', model: 'ocrmypdf' }
  }
  if (metadata.extractionMethod.includes('tesseract')) {
    return { provider: 'tesseract', model: 'tesseract' }
  }
  return { provider: 'extract', model: metadata.extractionMethod }
}
