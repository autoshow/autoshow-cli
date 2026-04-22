import type { ClercFlagsDefinition } from 'clerc'
import { transcriptionFlags, promptFlag, batchFlags, priceFlag } from './shared-flags'

export const sttFlags = {
  'all-stt': {
    description: 'Enable every supported STT provider/model for this command',
    type: Boolean,
    default: false,
    negatable: false
  },
  ...transcriptionFlags,
  ...promptFlag,
  ...batchFlags,
  ...priceFlag
} as const satisfies ClercFlagsDefinition
