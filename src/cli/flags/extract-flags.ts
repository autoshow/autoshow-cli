import type { ClercFlagsDefinition } from 'clerc'
import { articleFlags, batchFlags, extractFlags, priceFlag } from './shared-flags'

export const epubInspectFlags = {
  'epub-bun': {
    description: 'EPUB inspect mode with Bun ZIP/XML parser (writes structured EPUB data into run.json)',
    type: Boolean,
    default: false,
    negatable: false
  },
  'epub-calibre': {
    description: 'EPUB inspect mode with Calibre CLI tools (writes structured EPUB data into run.json)',
    type: Boolean,
    default: false,
    negatable: false
  }
} as const satisfies ClercFlagsDefinition

export const extractCommandFlags = {
  'all-ocr': {
    description: 'Enable every supported OCR engine/provider model for this command',
    type: Boolean,
    default: false,
    negatable: false
  },
  ...extractFlags,
  ...articleFlags,
  ...batchFlags,
  ...epubInspectFlags,
  ...priceFlag
} as const satisfies ClercFlagsDefinition
