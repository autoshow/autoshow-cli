import type { ClercFlagDefinitionValue, ClercFlagsDefinition } from 'clerc'
import {
  advancedExtractFlags,
  batchFlags,
  extractFlags,
  promptFlag,
  transcriptionFlags
} from './shared-flags'
import { epubInspectFlags } from './extract-flags'

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
  'whisper',
  'youtube-captions',
  'reverb',
  'gcloud-stt',
  'aws-stt',
  'deepinfra-stt',
  'deapi-stt',
  'aws-region',
  'aws-bucket',
  'elevenlabs-stt',
  'deepgram-stt',
  'soniox-stt',
  'speechmatics-stt',
  'rev-stt',
  'groq-stt',
  'mistral-stt',
  'assemblyai-stt',
  'gladia-stt',
  'supadata-stt',
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
  ...pickFlags(extractFlags, [
    'lang',
    'out',
    'password',
    'ocrmypdf',
    'paddle-ocr',
    'mistral-ocr',
    'glm-ocr',
    'openai-ocr',
    'anthropic-ocr',
    'gemini-ocr'
  ]),
  ...pickFlags(advancedExtractFlags, [
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
