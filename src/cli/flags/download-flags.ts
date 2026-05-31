import type { CliFlagsDefinition } from '~/cli/native'
import { articleFlags, batchFlags } from './shared-flags'
import { withHelpGroup } from './flag-utils'

const downloadDocumentFlags = {
  password: { description: 'Password for encrypted PDFs', type: String }
} as const satisfies CliFlagsDefinition

const mediaDownloadFlags = {
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
  }
} as const satisfies CliFlagsDefinition

export const downloadFlags = {
  ...withHelpGroup(downloadDocumentFlags, 'document-options'),
  ...withHelpGroup(mediaDownloadFlags, 'media-download'),
  ...withHelpGroup(articleFlags, 'article-extraction'),
  ...withHelpGroup(batchFlags, 'batch-processing'),
} as const satisfies CliFlagsDefinition
