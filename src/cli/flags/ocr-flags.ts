import type { CliFlagsDefinition } from '~/cli/native'
import { allArticleFlags, batchFlags, ocrInputFlags, ocrTuningFlags, priceFlag } from './shared-flags'

export const epubInspectFlags = {
  'epub-bun': {
    description: 'EPUB inspect mode with Bun ZIP/XML parser (writes structured EPUB data into run.json)',
    type: Boolean,
    default: false,
    negatable: false
  },
  'epub-calibre': {
    description: 'Compatibility alias for Bun EPUB inspect mode (writes structured EPUB data into run.json)',
    type: Boolean,
    default: false,
    negatable: false
  }
} as const satisfies CliFlagsDefinition

export const ocrCommandFlags = {
  'all-ocr': {
    description: 'Enable every supported OCR engine/provider model for this command',
    type: Boolean,
    default: false,
    negatable: false
  },
  'primary-ocr': {
    description: 'In multi-provider OCR, write top-level extraction artifacts from one requested provider (service or service/model)',
    type: String
  },
  ...ocrInputFlags,
  ...ocrTuningFlags,
  ...allArticleFlags,
  ...batchFlags,
  ...epubInspectFlags,
  ...priceFlag
} as const satisfies CliFlagsDefinition
