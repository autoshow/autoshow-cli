import type { ClercFlagsDefinition } from 'clerc'
import { articleFlags, batchFlags } from './shared-flags'

export const downloadFlags = {
  password: { description: 'Password for encrypted PDFs', type: String },
  'keep-original-media': {
    description: 'Keep downloaded media in its original/downloaded format instead of creating the normalized compressed audio artifact',
    type: Boolean,
    default: false,
    negatable: false
  },
  'best-quality': {
    description: 'Download the best available video+audio media and skip audio-only normalization',
    type: Boolean,
    default: false,
    negatable: false
  },
  'flat-batch': {
    description: 'Batch download: place primary media files directly in the batch output directory',
    type: Boolean,
    default: false,
    negatable: false
  },
  ...articleFlags,
  ...batchFlags,
} as const satisfies ClercFlagsDefinition
