import type { CliFlagsDefinition } from '~/cli/native'
import { omitFlags, withHelpGroup } from './flag-utils'
import {
  transcriptionFlags,
  llmProviderFlags,
  ocrInputFlags,
  ocrTuningFlags,
  batchFlags,
  promptFlag,
  priceFlag,
  sharedConcurrencyFlags,
  stepProviderSelectorFlags
} from './shared-flags'
import { ttsCommandFlags } from './tts-flags'
import { imageGenFlags } from './image-flags'
import { musicGenFlags } from './music-flags'
import { videoGenFlags } from './video-flags'

export const CONFIG_COMMAND_HELP_FLAG_GROUPS = [
  ['config', 'Config'],
  ['document-options', 'Document Options'],
  ['metadata-output', 'Metadata Output'],
  ['media-download', 'Media Download Options'],
  ['provider-selection', 'Provider Selection'],
  ['pipeline', 'Pipeline Selection'],
  ['step-1-download', 'Step 1 - Download'],
  ['batch-download', 'Batch / Download'],
  ['step-2-stt', 'Step 2 - Transcribe'],
  ['transcription', 'Transcription / STT'],
  ['step-2-ocr', 'Step 2 - OCR'],
  ['extraction', 'Extraction'],
  ['ocr-document', 'OCR / Document Extraction'],
  ['article-extraction', 'Article Extraction'],
  ['batch-processing', 'Batch Processing'],
  ['epub-inspect', 'EPUB Inspect'],
  ['transcript-video', 'Transcript Video'],
  ['step-3-write', 'Step 3 - Write'],
  ['writing', 'Writing'],
  ['step-4-tts', 'Step 4 - Text to Speech'],
  ['tts-options', 'TTS Options'],
  ['tts-minimax', 'MiniMax TTS'],
  ['tts-openai', 'OpenAI TTS'],
  ['tts-deepgram', 'Deepgram TTS'],
  ['tts-speechify', 'Speechify TTS'],
  ['tts-hume', 'Hume TTS'],
  ['tts-gemini', 'Gemini TTS'],
  ['tts-dialogue', 'Multi-Speaker / Dialogue'],
  ['tts-elevenlabs', 'ElevenLabs TTS'],
  ['step-5-image', 'Step 5 - Image'],
  ['image-options', 'Image Options'],
  ['image-inputs', 'Image Inputs'],
  ['image-provider-options', 'Provider-Specific Image Options'],
  ['step-6-video', 'Step 6 - Video'],
  ['video-options', 'Video Options'],
  ['video-inputs', 'Video Inputs'],
  ['grok-storage', 'Grok Storage Options'],
  ['step-7-music', 'Step 7 - Music'],
  ['hosted-music', 'Hosted Music'],
  ['pricing', 'Pricing'],
  ['output', 'Output'],
  ['lyric-video', 'Lyric Video']
] as const


const configFlags = {
  show: {
    description: 'Print the effective config and resolved path',
    type: Boolean,
    default: false,
    negatable: false
  },
  reset: {
    description: 'Clear the config file back to empty defaults',
    type: Boolean,
    default: false,
    negatable: false
  }
} as const satisfies CliFlagsDefinition

const pricingFlags = {
  'max-cents': {
    description: 'Budget limit in cents — commands exceeding this fail unless --allow-over-budget is set',
    type: String
  }
} as const satisfies CliFlagsDefinition

const configTtsFlags = omitFlags(ttsCommandFlags, [
  'provider',
  'all-providers',
  'provider-concurrency',
  'local-concurrency',
  'output-dir',
  'price'
])
const configOcrInputFlags = omitFlags(ocrInputFlags, ['password'])

export const configCommandFlags = {
  ...withHelpGroup(configFlags, 'config'),
  ...withHelpGroup(pricingFlags, 'pricing'),
  ...withHelpGroup(batchFlags, 'step-1-download'),
  ...withHelpGroup(sharedConcurrencyFlags, 'pricing'),
  ...withHelpGroup({ stt: stepProviderSelectorFlags.stt }, 'step-2-stt'),
  ...withHelpGroup(transcriptionFlags, 'step-2-stt'),
  ...withHelpGroup({ ocr: stepProviderSelectorFlags.ocr }, 'step-2-ocr'),
  ...withHelpGroup(configOcrInputFlags, 'step-2-ocr'),
  ...withHelpGroup(ocrTuningFlags, 'step-2-ocr'),
  ...withHelpGroup(llmProviderFlags, 'step-3-write'),
  ...withHelpGroup(promptFlag, 'step-3-write'),
  ...withHelpGroup({ tts: stepProviderSelectorFlags.tts }, 'step-4-tts'),
  ...withHelpGroup(configTtsFlags, 'step-4-tts'),
  ...withHelpGroup({ image: stepProviderSelectorFlags.image }, 'step-5-image'),
  ...withHelpGroup(imageGenFlags, 'step-5-image'),
  ...withHelpGroup({ video: stepProviderSelectorFlags.video }, 'step-6-video'),
  ...withHelpGroup(videoGenFlags, 'step-6-video'),
  ...withHelpGroup({ music: stepProviderSelectorFlags.music }, 'step-7-music'),
  ...withHelpGroup(musicGenFlags, 'step-7-music'),
  ...withHelpGroup(priceFlag, 'pricing')
} as const satisfies CliFlagsDefinition
