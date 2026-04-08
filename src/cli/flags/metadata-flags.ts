import type { ClercFlagsDefinition } from 'clerc'
import { batchFlags } from './shared-flags'

export const metadataFlags = {
  password: { description: 'Password for encrypted PDFs', type: String },
  markdown: { description: 'Output metadata as Markdown frontmatter YAML', type: Boolean },
  save: { description: 'Save metadata.json to disk (and metadata.md with --markdown)', type: Boolean },
  ...batchFlags,
} as const satisfies ClercFlagsDefinition
