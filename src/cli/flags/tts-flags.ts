import type { ClercFlagsDefinition } from 'clerc'
import {
  SUPPORTED_KITTEN_TTS_MODELS,
  SUPPORTED_ELEVENLABS_TTS_MODELS,
  SUPPORTED_MINIMAX_TTS_MODELS,
  SUPPORTED_GROQ_TTS_MODELS,
  SUPPORTED_OPENAI_TTS_MODELS,
  SUPPORTED_GEMINI_TTS_MODELS
} from '~/cli/commands/setup-and-utilities/models/model-options'
import { buildModelDescription } from '~/cli/commands/setup-and-utilities/models/model-validation'
import { priceFlag } from './shared-flags'

export const ttsFlags = {
  'kitten-voice': {
    description: 'Kitten TTS speaker: Bella|Jasper|Luna|Bruno|Rosie|Hugo|Kiki|Leo',
    type: String,
    default: 'Jasper'
  },
  'kitten-tts': {
    description: buildModelDescription('Kitten TTS model', SUPPORTED_KITTEN_TTS_MODELS),
    type: [String] as [StringConstructor]
  },
  'elevenlabs-tts': {
    description: buildModelDescription('ElevenLabs TTS model', SUPPORTED_ELEVENLABS_TTS_MODELS),
    type: [String] as [StringConstructor]
  },
  'minimax-tts': {
    description: buildModelDescription('MiniMax TTS model', SUPPORTED_MINIMAX_TTS_MODELS),
    type: [String] as [StringConstructor]
  },
  'groq-tts': {
    description: buildModelDescription('Groq TTS model', SUPPORTED_GROQ_TTS_MODELS),
    type: [String] as [StringConstructor]
  },
  'openai-tts': {
    description: buildModelDescription('OpenAI TTS model', SUPPORTED_OPENAI_TTS_MODELS),
    type: [String] as [StringConstructor]
  },
  'gemini-tts': {
    description: buildModelDescription('Gemini TTS model', SUPPORTED_GEMINI_TTS_MODELS),
    type: [String] as [StringConstructor]
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
  },
  ...priceFlag
} as const satisfies ClercFlagsDefinition
