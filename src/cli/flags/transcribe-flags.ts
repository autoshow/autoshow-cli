import type { ClercFlagsDefinition } from 'clerc'
import { transcriptionFlags, promptFlag, promptOutputFlags, batchFlags, priceFlag } from './shared-flags'

export const transcribeFlags = {
  ...transcriptionFlags,
  ...promptFlag,
  ...promptOutputFlags,
  ...batchFlags,
  ...priceFlag
} as const satisfies ClercFlagsDefinition
