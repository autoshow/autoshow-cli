import type { ClercFlagsDefinition } from 'clerc'
import { batchFlags } from './shared-flags'

export const downloadFlags = {
  password: { description: 'Password for encrypted PDFs', type: String },
  'keep-original-media': {
    description: 'Keep downloaded media in its original format instead of converting to WAV',
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
  ...batchFlags,
} as const satisfies ClercFlagsDefinition
