import type { ClercFlagsDefinition } from 'clerc'
import { transcriptionFlags, resumeMissingFlag, promptFlag, promptOutputFlags, batchFlags, priceFlag } from './shared-flags'

export const sttFlags = {
  ...transcriptionFlags,
  ...resumeMissingFlag,
  ...promptFlag,
  ...promptOutputFlags,
  ...batchFlags,
  ...priceFlag
} as const satisfies ClercFlagsDefinition
