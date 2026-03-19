import type { ClercFlagsDefinition } from 'clerc'
import { transcriptionFlags, promptFlag, batchFlags, priceFlag } from './shared-flags'

export const transcribeFlags = {
  ...transcriptionFlags,
  ...promptFlag,
  ...batchFlags,
  ...priceFlag
} as const satisfies ClercFlagsDefinition
