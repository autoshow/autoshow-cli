import type { ClercFlagsDefinition } from 'clerc'
import { batchFlags } from './shared-flags'

export const downloadFlags = {
  password: { description: 'Password for encrypted PDFs', type: String },
  ...batchFlags,
} as const satisfies ClercFlagsDefinition
