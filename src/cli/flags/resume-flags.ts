import type { ClercFlagDefinitionValue, ClercFlagsDefinition } from 'clerc'
import {
  ocrTuningFlags,
  batchFlags,
  ocrInputFlags,
  promptFlag,
  transcriptionFlags
} from './shared-flags'
import { epubInspectFlags } from './ocr-flags'
import { getStep2ProviderSelectionFlagNames } from '~/cli/commands/process-steps/step-2-extract/step-2-shared/provider-registry'

const pickFlags = (
  flags: ClercFlagsDefinition,
  keys: readonly string[]
): ClercFlagsDefinition => {
  const picked: ClercFlagsDefinition = {}
  for (const key of keys) {
    const definition = flags[key]
    if (definition !== undefined) {
      picked[key] = definition as ClercFlagDefinitionValue
    }
  }
  return picked
}

const resumeSttFlags = pickFlags(transcriptionFlags, [
  ...getStep2ProviderSelectionFlagNames('stt'),
  'youtube-captions',
  'aws-region',
  'aws-bucket',
  'happyscribe-organization-id',
  'supadata-lang',
  'speaker-count',
  'split',
  'stt-provider-concurrency',
  'stt-local-concurrency',
  'stt-segment-concurrency',
  'stt-preflight-concurrency',
  'refresh-cache',
  'no-cache'
])

const resumeOcrFlags = {
  ...pickFlags(ocrInputFlags, [
    ...getStep2ProviderSelectionFlagNames('ocr'),
    'lang',
    'out',
    'password',
    'ocr-provider-concurrency',
    'ocr-local-concurrency'
  ]),
  ...pickFlags(ocrTuningFlags, [
    'dpi',
    'psm',
    'oem',
    'page-separator',
    'preserve-spaces',
    'rotate'
  ]),
  ...epubInspectFlags
} as const satisfies ClercFlagsDefinition

export const resumeFlags = {
  ...resumeSttFlags,
  ...promptFlag,
  ...pickFlags(batchFlags, ['batch-concurrency']),
  ...resumeOcrFlags
} as const satisfies ClercFlagsDefinition
