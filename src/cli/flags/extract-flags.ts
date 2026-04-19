import type { ClercFlagsDefinition } from 'clerc'
import { articleFlags, extractFlags, priceFlag, resumeMissingFlag } from './shared-flags'

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
  ...extractFlags,
  ...articleFlags,
  ...resumeMissingFlag,
  ...epubInspectFlags,
  ...priceFlag
} as const satisfies ClercFlagsDefinition
