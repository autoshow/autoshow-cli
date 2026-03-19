import type { ClercFlagsDefinition } from 'clerc'
import { extractFlags, priceFlag } from './shared-flags'

export const extractCommandFlags = {
  ...extractFlags,
  'epub-bun': {
    description: 'EPUB inspect mode with Bun ZIP/XML parser (writes structured EPUB data into metadata.json)',
    type: Boolean,
    default: false,
    negatable: false
  },
  'epub-calibre': {
    description: 'EPUB inspect mode with Calibre CLI tools (writes structured EPUB data into metadata.json)',
    type: Boolean,
    default: false,
    negatable: false
  },
  ...priceFlag
} as const satisfies ClercFlagsDefinition
