import type { ClercFlagDefinitionValue, ClercFlagsDefinition } from 'clerc'
import {
  SUPPORTED_KITTEN_TTS_MODELS,
  SUPPORTED_ELEVENLABS_TTS_MODELS,
  SUPPORTED_MINIMAX_TTS_MODELS,
  SUPPORTED_GROQ_TTS_MODELS,
  SUPPORTED_OPENAI_TTS_MODELS,
  SUPPORTED_GEMINI_TTS_MODELS,
  SUPPORTED_SORA_VIDEO_MODELS,
  SUPPORTED_GEMINI_VIDEO_MODELS,
  SUPPORTED_MINIMAX_VIDEO_MODELS,
  SUPPORTED_ELEVENLABS_MUSIC_MODELS,
  SUPPORTED_MINIMAX_MUSIC_MODELS
} from '~/cli/commands/models/model-options'
import {
  transcriptionFlags,
  llmProviderFlags,
  extractFlags,
  advancedExtractFlags,
  batchFlags,
  promptFlag,
  structuredWriteFlags,
  priceFlag
} from './shared-flags'
import { imageGenFlags } from './image-flags'
import { musicGenFlags } from './music-flags'
import { videoGenFlags } from './video-flags'

const KITTEN_TTS_MODELS_DESCRIPTION = `Kitten TTS model: ${SUPPORTED_KITTEN_TTS_MODELS.join('|')}`
const ELEVENLABS_TTS_MODELS_DESCRIPTION = `ElevenLabs TTS model: ${SUPPORTED_ELEVENLABS_TTS_MODELS.join('|')}`
const MINIMAX_TTS_MODELS_DESCRIPTION = `MiniMax TTS model: ${SUPPORTED_MINIMAX_TTS_MODELS.join('|')}`
const GROQ_TTS_MODELS_DESCRIPTION = `Groq TTS model: ${SUPPORTED_GROQ_TTS_MODELS.join('|')}`
const OPENAI_TTS_MODELS_DESCRIPTION = `OpenAI TTS model: ${SUPPORTED_OPENAI_TTS_MODELS.join('|')}`
const GEMINI_TTS_MODELS_DESCRIPTION = `Gemini TTS model: ${SUPPORTED_GEMINI_TTS_MODELS.join('|')}`
const SORA_VIDEO_MODELS_DESCRIPTION = `OpenAI Sora video model: ${SUPPORTED_SORA_VIDEO_MODELS.join('|')}`
const GEMINI_VIDEO_MODELS_DESCRIPTION = `Gemini Veo video model: ${SUPPORTED_GEMINI_VIDEO_MODELS.join('|')}`
const MINIMAX_VIDEO_MODELS_DESCRIPTION = `MiniMax video model: ${SUPPORTED_MINIMAX_VIDEO_MODELS.join('|')}`
const ELEVENLABS_MUSIC_MODELS_DESCRIPTION = `ElevenLabs music model: ${SUPPORTED_ELEVENLABS_MUSIC_MODELS.join('|')}`
const MINIMAX_MUSIC_MODELS_DESCRIPTION = `MiniMax music model: ${SUPPORTED_MINIMAX_MUSIC_MODELS.join('|')}`

type WriteHelpFlagGroup =
  | 'pricing'
  | 'step-1-download'
  | 'step-2-stt'
  | 'step-2-document'
  | 'step-3-write'
  | 'step-4-tts'
  | 'step-5-image'
  | 'step-6-video'
  | 'step-7-music'

const withHelpGroup = (flags: ClercFlagsDefinition, group: WriteHelpFlagGroup): ClercFlagsDefinition => {
  const grouped: ClercFlagsDefinition = {}
  for (const [name, definition] of Object.entries(flags)) {
    const flagDefinition = definition as ClercFlagDefinitionValue
    if (typeof flagDefinition === 'function' || Array.isArray(flagDefinition)) {
      grouped[name] = flagDefinition
      continue
    }

    const existingHelp = (flagDefinition as { help?: Record<string, unknown> }).help
    grouped[name] = {
      ...(flagDefinition as object),
      help: {
        ...(typeof existingHelp === 'object' && existingHelp !== null ? existingHelp : {}),
        group
      }
    } as ClercFlagDefinitionValue
  }
  return grouped
}

const writeTtsFlags = {
  'tts-speaker': {
    description: 'Kitten TTS speaker: Bella|Jasper|Luna|Bruno|Rosie|Hugo|Kiki|Leo',
    type: String,
    default: 'Jasper'
  },
  'kitten-tts': {
    description: `Enable Kitten TTS on LLM output. ${KITTEN_TTS_MODELS_DESCRIPTION}`,
    type: String
  },
  'elevenlabs-tts': {
    description: `Enable ElevenLabs TTS on LLM output. ${ELEVENLABS_TTS_MODELS_DESCRIPTION}`,
    type: String
  },
  'minimax-tts': {
    description: `Enable MiniMax TTS on LLM output. ${MINIMAX_TTS_MODELS_DESCRIPTION}`,
    type: String
  },
  'groq-tts': {
    description: `Enable Groq TTS on LLM output. ${GROQ_TTS_MODELS_DESCRIPTION}`,
    type: String
  },
  'openai-tts': {
    description: `Enable OpenAI TTS on LLM output. ${OPENAI_TTS_MODELS_DESCRIPTION}`,
    type: String
  },
  'gemini-tts': {
    description: `Enable Gemini TTS on LLM output. ${GEMINI_TTS_MODELS_DESCRIPTION}`,
    type: String
  },
  'minimax-tts-voice': {
    description: 'MiniMax TTS voice ID override (default: English_expressive_narrator)',
    type: String
  },
  'openai-voice': {
    description: 'OpenAI TTS voice ID override (default: alloy)',
    type: String
  },
  'gemini-voice': {
    description: 'Gemini TTS voice name override (default: Kore)',
    type: String
  },
  'groq-voice': {
    description: 'Groq TTS voice ID override (default: troy)',
    type: String
  },
  'elevenlabs-voice': {
    description: 'ElevenLabs voice ID override (default: hpp4J3VqNfWAUOO0d1Us)',
    type: String
  }
} as const satisfies ClercFlagsDefinition

const writeVideoModelFlags = {
  'sora-video': {
    description: `Enable video generation on LLM output. ${SORA_VIDEO_MODELS_DESCRIPTION}`,
    type: String
  },
  'gemini-video': {
    description: `Enable video generation on LLM output. ${GEMINI_VIDEO_MODELS_DESCRIPTION}`,
    type: String
  },
  'minimax-video': {
    description: `Enable video generation on LLM output. ${MINIMAX_VIDEO_MODELS_DESCRIPTION}`,
    type: String
  }
} as const satisfies ClercFlagsDefinition

const writeMusicModelFlags = {
  'elevenlabs-music': {
    description: `Enable music generation on LLM output. ${ELEVENLABS_MUSIC_MODELS_DESCRIPTION}`,
    type: String
  },
  'minimax-music': {
    description: `Enable music generation on LLM output. ${MINIMAX_MUSIC_MODELS_DESCRIPTION}`,
    type: String
  },
  'music-duration': {
    description: 'Music duration in seconds',
    type: String
  },
  'music-lyrics-file': {
    description: 'Lyrics file path (.md or .txt) for MiniMax music generation',
    type: String
  },
  'music-instrumental': {
    description: 'Force instrumental generation (ElevenLabs prompt mode)',
    type: Boolean,
    default: false,
    negatable: false
  }
} as const satisfies ClercFlagsDefinition

export const writeFlags = {
  ...withHelpGroup(batchFlags, 'step-1-download'),
  ...withHelpGroup(transcriptionFlags, 'step-2-stt'),
  ...withHelpGroup(extractFlags, 'step-2-document'),
  ...withHelpGroup(advancedExtractFlags, 'step-2-document'),
  ...withHelpGroup(llmProviderFlags, 'step-3-write'),
  ...withHelpGroup(promptFlag, 'step-3-write'),
  ...withHelpGroup(structuredWriteFlags, 'step-3-write'),
  ...withHelpGroup(writeTtsFlags, 'step-4-tts'),
  ...withHelpGroup(imageGenFlags, 'step-5-image'),
  ...withHelpGroup(videoGenFlags, 'step-6-video'),
  ...withHelpGroup(writeVideoModelFlags, 'step-6-video'),
  ...withHelpGroup(musicGenFlags, 'step-7-music'),
  ...withHelpGroup(writeMusicModelFlags, 'step-7-music'),
  ...withHelpGroup(priceFlag, 'pricing')
} as const satisfies ClercFlagsDefinition
