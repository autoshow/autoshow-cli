import type { CliFlagsDefinition } from '~/cli/native'
import { allArticleFlags, batchFlags, booleanAllProvidersFlag, ocrInputFlags, ocrTuningFlags, priceFlag, sharedConcurrencyFlags } from './shared-flags'

export const epubInspectFlags = {
  'epub-bun': {
    description: 'EPUB inspect mode with Bun ZIP/XML parser (writes structured EPUB data into run.json)',
    type: Boolean,
    default: false,
    negatable: false
  }
} as const satisfies CliFlagsDefinition

export const ocrCommandFlags = {
  ...booleanAllProvidersFlag,
  provider: {
    description: 'OCR provider[=model]: tesseract|ocrmypdf|paddle-ocr|mistral|glm|kimi|openai|grok|anthropic|gemini|deepinfra|unstructured (default: tesseract); repeatable',
    type: [String] as [StringConstructor]
  },
  ...sharedConcurrencyFlags,
  'primary-ocr': {
    description: 'In multi-provider OCR, write top-level extraction artifacts from one requested provider: tesseract|ocrmypdf|paddle-ocr|mistral|glm|kimi|openai|grok|anthropic|gemini|deepinfra|unstructured (as service or service/model)',
    type: String
  },
  ...ocrInputFlags,
  ...ocrTuningFlags,
  ...allArticleFlags,
  ...batchFlags,
  ...epubInspectFlags,
  ...priceFlag
} as const satisfies CliFlagsDefinition
