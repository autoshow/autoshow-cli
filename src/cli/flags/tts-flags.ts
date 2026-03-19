import type { ClercFlagsDefinition } from 'clerc'
import {
  SUPPORTED_KITTEN_TTS_MODELS,
  SUPPORTED_ELEVENLABS_TTS_MODELS,
  SUPPORTED_MINIMAX_TTS_MODELS,
  SUPPORTED_GROQ_TTS_MODELS,
  SUPPORTED_OPENAI_TTS_MODELS,
  SUPPORTED_GEMINI_TTS_MODELS
} from '~/cli/commands/models/model-options'
import { priceFlag } from './shared-flags'

const KITTEN_TTS_MODELS_DESCRIPTION = `Kitten TTS model: ${SUPPORTED_KITTEN_TTS_MODELS.join('|')}`
const ELEVENLABS_TTS_MODELS_DESCRIPTION = `ElevenLabs TTS model: ${SUPPORTED_ELEVENLABS_TTS_MODELS.join('|')}`
const MINIMAX_TTS_MODELS_DESCRIPTION = `MiniMax TTS model: ${SUPPORTED_MINIMAX_TTS_MODELS.join('|')}`
const GROQ_TTS_MODELS_DESCRIPTION = `Groq TTS model: ${SUPPORTED_GROQ_TTS_MODELS.join('|')}`
const OPENAI_TTS_MODELS_DESCRIPTION = `OpenAI TTS model: ${SUPPORTED_OPENAI_TTS_MODELS.join('|')}`
const GEMINI_TTS_MODELS_DESCRIPTION = `Gemini TTS model: ${SUPPORTED_GEMINI_TTS_MODELS.join('|')}`

export const ttsFlags = {
  'tts-speaker': {
    description: 'Kitten TTS speaker: Bella|Jasper|Luna|Bruno|Rosie|Hugo|Kiki|Leo',
    type: String,
    default: 'Jasper'
  },
  'kitten-tts': {
    description: KITTEN_TTS_MODELS_DESCRIPTION,
    type: String
  },
  'elevenlabs-tts': {
    description: ELEVENLABS_TTS_MODELS_DESCRIPTION,
    type: String
  },
  'minimax-tts': {
    description: MINIMAX_TTS_MODELS_DESCRIPTION,
    type: String
  },
  'groq-tts': {
    description: GROQ_TTS_MODELS_DESCRIPTION,
    type: String
  },
  'openai-tts': {
    description: OPENAI_TTS_MODELS_DESCRIPTION,
    type: String
  },
  'gemini-tts': {
    description: GEMINI_TTS_MODELS_DESCRIPTION,
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
  },
  ...priceFlag
} as const satisfies ClercFlagsDefinition
