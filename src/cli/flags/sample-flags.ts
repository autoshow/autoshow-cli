import type { CliFlagsDefinition } from '~/cli/native'

export const sampleFlags = {
  out: {
    description: 'Output directory for fixture files (default: input/samples)',
    type: String,
    default: 'input/samples'
  },
  refresh: {
    description: 'Regenerate all fixtures even if manifest is already valid',
    type: Boolean,
    default: false,
    negatable: false
  },
  'verify-only': {
    description: 'Validate fixture set without regenerating',
    type: Boolean,
    default: false,
    negatable: false
  },
  'valid-only': {
    description: 'Skip invalid fixture generation',
    type: Boolean,
    default: false,
    negatable: false
  }
} as const satisfies CliFlagsDefinition
