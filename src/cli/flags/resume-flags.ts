import type { ClercFlagDefinitionValue, ClercFlagsDefinition } from 'clerc'
import {
  ocrTuningFlags,
  batchFlags,
  ocrInputFlags,
  promptFlag,
  transcriptionFlags
} from './shared-flags'
import { epubInspectFlags } from './ocr-flags'
import { ttsFlags } from './tts-flags'
import { imageGenFlags } from './image-flags'
import { videoGenFlags } from './video-flags'
import { musicGenFlags } from './music-flags'
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

const resumeTtsFlags = pickFlags(ttsFlags, [
  'kitten-tts',
  'elevenlabs-tts',
  'minimax-tts',
  'groq-tts',
  'mistral-tts',
  'openai-tts',
  'gemini-tts',
  'runway-tts',
  'deepgram-tts',
  'kitten-voice',
  'elevenlabs-voice',
  'minimax-tts-voice',
  'openai-voice',
  'gemini-voice',
  'runway-tts-voice',
  'deepgram-voice',
  'groq-voice',
  'mistral-tts-voice',
  'mistral-tts-ref-audio',
  'gemini-speaker-1-name',
  'gemini-speaker-1-voice',
  'gemini-speaker-2-name',
  'gemini-speaker-2-voice'
])

const resumeImageFlags = pickFlags(imageGenFlags, [
  'gemini-image',
  'openai-image',
  'minimax-image',
  'glm-image',
  'grok-image',
  'runway-image',
  'bfl-image',
  'deapi-image',
  'image-aspect-ratio',
  'image-size',
  'image-quality',
  'image-format',
  'image-background',
  'imagen-count'
])

const resumeVideoFlags = pickFlags(videoGenFlags, [
  'gemini-video',
  'minimax-video',
  'glm-video',
  'grok-video',
  'runway-video',
  'video-duration',
  'video-size',
  'video-aspect-ratio',
  'video-resolution'
])

const resumeMusicFlags = pickFlags(musicGenFlags, [
  'elevenlabs-music',
  'minimax-music',
  'deapi-music',
  'gemini-music',
  'music-duration',
  'music-lyrics-file',
  'music-instrumental'
])

export const resumeFlags = {
  ...resumeSttFlags,
  ...promptFlag,
  ...pickFlags(batchFlags, ['batch-concurrency']),
  ...resumeOcrFlags,
  ...resumeTtsFlags,
  ...resumeImageFlags,
  ...resumeVideoFlags,
  ...resumeMusicFlags
} as const satisfies ClercFlagsDefinition
