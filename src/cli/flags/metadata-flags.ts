import type { ClercFlagsDefinition } from 'clerc'
import { batchFlags } from './shared-flags'

export const metadataFlags = {
  password: { description: 'Password for encrypted PDFs', type: String },
  save: { description: 'Save metadata.json to disk', type: Boolean },
  ...batchFlags,
} as const satisfies ClercFlagsDefinition
