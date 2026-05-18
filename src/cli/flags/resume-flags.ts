import type { CliFlagDefinition, CliFlagsDefinition } from '~/cli/native'
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
  flags: CliFlagsDefinition,
  keys: readonly string[]
): CliFlagsDefinition => {
  const picked: CliFlagsDefinition = {}
  for (const key of keys) {
    const definition = flags[key]
    if (definition !== undefined) {
      picked[key] = definition as CliFlagDefinition
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
  'scrapecreators-lang',
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
} as const satisfies CliFlagsDefinition

const resumeTtsFlags = pickFlags(ttsFlags, [
  'kitten-tts',
  'elevenlabs-tts',
  'minimax-tts',
  'groq-tts',
  'mistral-tts',
  'openai-tts',
  'gemini-tts',
  'deepgram-tts',
  'hume-tts',
  'cartesia-tts',
  'kitten-voice',
  'elevenlabs-voice',
  'elevenlabs-tts-pvc-voice',
  'elevenlabs-tts-ref-audio',
  'elevenlabs-tts-voice-name',
  'elevenlabs-tts-clone-remove-background-noise',
  'minimax-tts-voice',
  'openai-voice',
  'openai-tts-ref-audio',
  'openai-tts-consent-id',
  'openai-tts-consent-audio',
  'openai-tts-consent-language',
  'openai-tts-consent-name',
  'openai-tts-voice-name',
  'gemini-voice',
  'deepgram-voice',
  'hume-tts-voice',
  'hume-tts-voice-provider',
  'cartesia-tts-voice',
  'cartesia-tts-language',
  'groq-voice',
  'mistral-tts-voice',
  'mistral-tts-ref-audio',
  'gemini-speaker-1-name',
  'gemini-speaker-1-voice',
  'gemini-speaker-2-name',
  'gemini-speaker-2-voice',
  'tts-provider-concurrency',
  'tts-local-concurrency'
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
  'image-count',
  'image-input',
  'image-mask',
  'image-response-mode',
  'gemini-person-generation',
  'gemini-search-grounding',
  'image-compression',
  'image-provider-concurrency',
  'image-local-concurrency'
])

const resumeVideoFlags = pickFlags(videoGenFlags, [
  'gemini-video',
  'minimax-video',
  'glm-video',
  'grok-video',
  'runway-video',
  'deapi-video',
  'video-duration',
  'video-size',
  'video-aspect-ratio',
  'video-resolution',
  'video-provider-concurrency',
  'video-local-concurrency'
])

const resumeMusicFlags = pickFlags(musicGenFlags, [
  'elevenlabs-music',
  'minimax-music',
  'deapi-music',
  'gemini-music',
  'music-duration',
  'music-lyrics-file',
  'music-instrumental',
  'music-provider-concurrency',
  'music-local-concurrency'
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
} as const satisfies CliFlagsDefinition
