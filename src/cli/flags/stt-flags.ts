import type { ClercFlagsDefinition } from 'clerc'
import { transcriptionFlags, resumeMissingFlag, promptFlag, batchFlags, priceFlag } from './shared-flags'

export const sttFlags = {
  ...transcriptionFlags,
  ...resumeMissingFlag,
  ...promptFlag,
  ...batchFlags,
  ...priceFlag
} as const satisfies ClercFlagsDefinition
