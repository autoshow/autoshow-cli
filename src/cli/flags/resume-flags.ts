import type { CliFlagsDefinition } from '~/cli/native'
import {
  batchFlags,
  booleanAllProvidersFlag,
  promptFlag,
  sharedConcurrencyFlags
} from './shared-flags'
import { omitFlags } from './flag-utils'
import { ocrCommandFlags } from './ocr-flags'
import { sttFlags } from './stt-flags'
import { genericTtsOptionFlags, ttsFlags } from './tts-flags'
import { imageGenFlags } from './image-flags'
import { videoGenFlags } from './video-flags'
import { musicGenFlags } from './music-flags'

const resumeProviderSelectionFlags = {
  ...booleanAllProvidersFlag,
  provider: {
    description: [
      'STT: whisper|reverb|deepinfra|elevenlabs|deepgram|soniox|speechmatics|rev|groq|grok|mistral|assemblyai|gladia|happyscribe|supadata|scrapecreators|openai|gemini|glm|together (default: whisper=tiny)',
      'OCR: tesseract|ocrmypdf|paddle-ocr|mistral|glm|kimi|openai|grok|anthropic|gemini|deepinfra|unstructured (default: tesseract)',
      'TTS: kitten|elevenlabs|minimax|groq|grok|mistral|openai|gemini|deepgram|speechify|hume|cartesia',
      'image: gemini|openai|grok|bfl|reve',
      'video: gemini|minimax|glm|grok|runway',
      'music: elevenlabs|minimax|gemini',
      'repeatable as provider[=model]'
    ].join('\n'),
    type: [String] as [StringConstructor]
  },
  ...sharedConcurrencyFlags
} as const satisfies CliFlagsDefinition

const resumeSttFlags = omitFlags(sttFlags, [
  'batch-limit',
  'batch-all',
  'batch-order',
  'price',
  'provider',
  'all-providers',
  'provider-concurrency',
  'local-concurrency'
])

const resumeOcrFlags = omitFlags(ocrCommandFlags, [
  'batch-limit',
  'batch-all',
  'batch-order',
  'all-url',
  'url-backend',
  'url-provider-concurrency',
  'url-request-timeout-ms',
  'url-request-attempts',
  'primary-ocr',
  'price',
  'provider',
  'all-providers',
  'provider-concurrency',
  'local-concurrency'
])

const resumeTtsFlags = {
  ...genericTtsOptionFlags,
  ...omitFlags(ttsFlags, [
    'price',
    'all-tts',
    'tts-provider-concurrency',
    'tts-local-concurrency',
    'kitten-tts',
    'elevenlabs-tts',
    'minimax-tts',
    'groq-tts',
    'grok-tts',
    'mistral-tts',
    'openai-tts',
    'gemini-tts',
    'deepgram-tts',
    'speechify-tts',
    'hume-tts',
    'cartesia-tts',
    'kitten-voice',
    'minimax-tts-voice',
    'minimax-tts-speed',
    'openai-voice',
    'openai-tts-instructions',
    'openai-tts-speed',
    'openai-tts-ref-audio',
    'openai-tts-consent-audio',
    'openai-tts-consent-language',
    'openai-tts-consent-name',
    'openai-tts-voice-name',
    'gemini-voice',
    'deepgram-voice',
    'deepgram-tts-speed',
    'speechify-voice',
    'speechify-tts-language',
    'speechify-tts-ref-audio',
    'speechify-tts-voice-name',
    'speechify-tts-consent-name',
    'speechify-tts-consent-email',
    'hume-tts-voice',
    'cartesia-tts-voice',
    'cartesia-tts-language',
    'grok-tts-voice',
    'grok-tts-language',
    'grok-tts-text-normalization',
    'groq-voice',
    'mistral-tts-voice',
    'mistral-tts-ref-audio',
    'mistral-tts-voice-name',
    'elevenlabs-voice',
    'elevenlabs-tts-ref-audio',
    'elevenlabs-tts-voice-name',
    'elevenlabs-tts-language-code',
    'elevenlabs-tts-speed',
    'elevenlabs-tts-text-normalization',
    'minimax-tts-english-normalization',
    'elevenlabs-tts-output-format',
    'speechify-tts-audio-format',
    'deepgram-tts-encoding',
  ])
}
const resumeImageFlags = omitFlags(imageGenFlags, ['price'])
const resumeVideoFlags = omitFlags(videoGenFlags, ['price'])
const resumeMusicFlags = omitFlags(musicGenFlags, ['price'])

export const resumeFlags = {
  ...resumeProviderSelectionFlags,
  ...resumeSttFlags,
  ...promptFlag,
  'batch-concurrency': batchFlags['batch-concurrency'],
  ...resumeOcrFlags,
  ...resumeTtsFlags,
  ...resumeImageFlags,
  ...resumeVideoFlags,
  ...resumeMusicFlags
} as const satisfies CliFlagsDefinition
