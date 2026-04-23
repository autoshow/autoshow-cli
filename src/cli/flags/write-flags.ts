import type { ClercFlagsDefinition } from 'clerc'
import { withHelpGroup } from './flag-utils'
import {
  SUPPORTED_KITTEN_TTS_MODELS,
  SUPPORTED_ELEVENLABS_TTS_MODELS,
  SUPPORTED_MINIMAX_TTS_MODELS,
  SUPPORTED_GROQ_TTS_MODELS,
  SUPPORTED_OPENAI_TTS_MODELS,
  SUPPORTED_GEMINI_TTS_MODELS,
  SUPPORTED_GEMINI_VIDEO_MODELS,
  SUPPORTED_MINIMAX_VIDEO_MODELS,
  SUPPORTED_ELEVENLABS_MUSIC_MODELS,
  SUPPORTED_MINIMAX_MUSIC_MODELS
} from '~/cli/commands/setup-and-utilities/models/model-options'
import { buildModelDescription } from '~/cli/commands/setup-and-utilities/models/model-validation'
import {
  transcriptionFlags,
  llmProviderFlags,
  ocrInputFlags,
  ocrTuningFlags,
  articleFlags,
  // Shared separately because write should still expose batch and EPUB inspect flags without resume-only surface area.
  batchFlags,
  promptFlag,
  priceFlag
} from './shared-flags'
import { epubInspectFlags } from './ocr-flags'
import { imageGenFlags } from './image-flags'
import { musicGenFlags } from './music-flags'
import { videoGenFlags } from './video-flags'

const writeTtsFlags = {
  'kitten-voice': {
    description: 'Kitten TTS speaker: Bella|Jasper|Luna|Bruno|Rosie|Hugo|Kiki|Leo',
    type: String,
    default: 'Jasper'
  },
  'kitten-tts': {
    description: `Enable Kitten TTS on LLM output. ${buildModelDescription('Kitten TTS model', SUPPORTED_KITTEN_TTS_MODELS)}`,
    type: [String] as [StringConstructor]
  },
  'elevenlabs-tts': {
    description: `Enable ElevenLabs TTS on LLM output. ${buildModelDescription('ElevenLabs TTS model', SUPPORTED_ELEVENLABS_TTS_MODELS)}`,
    type: [String] as [StringConstructor]
  },
  'minimax-tts': {
    description: `Enable MiniMax TTS on LLM output. ${buildModelDescription('MiniMax TTS model', SUPPORTED_MINIMAX_TTS_MODELS)}`,
    type: [String] as [StringConstructor]
  },
  'groq-tts': {
    description: `Enable Groq TTS on LLM output. ${buildModelDescription('Groq TTS model', SUPPORTED_GROQ_TTS_MODELS)}`,
    type: [String] as [StringConstructor]
  },
  'openai-tts': {
    description: `Enable OpenAI TTS on LLM output. ${buildModelDescription('OpenAI TTS model', SUPPORTED_OPENAI_TTS_MODELS)}`,
    type: [String] as [StringConstructor]
  },
  'gemini-tts': {
    description: `Enable Gemini TTS on LLM output. ${buildModelDescription('Gemini TTS model', SUPPORTED_GEMINI_TTS_MODELS)}`,
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
  'gemini-speaker-1-name': {
    description: 'Gemini multispeaker speaker 1 name override (requires all Gemini speaker flags)',
    type: String
  },
  'gemini-speaker-1-voice': {
    description: 'Gemini multispeaker speaker 1 voice name override (requires all Gemini speaker flags)',
    type: String
  },
  'gemini-speaker-2-name': {
    description: 'Gemini multispeaker speaker 2 name override (requires all Gemini speaker flags)',
    type: String
  },
  'gemini-speaker-2-voice': {
    description: 'Gemini multispeaker speaker 2 voice name override (requires all Gemini speaker flags)',
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
  'gemini-video': {
    description: `Enable video generation on LLM output. ${buildModelDescription('Gemini Veo video model', SUPPORTED_GEMINI_VIDEO_MODELS)}`,
    type: [String] as [StringConstructor]
  },
  'minimax-video': {
    description: `Enable video generation on LLM output. ${buildModelDescription('MiniMax video model', SUPPORTED_MINIMAX_VIDEO_MODELS)}`,
    type: [String] as [StringConstructor]
  }
} as const satisfies ClercFlagsDefinition

const writeMusicModelFlags = {
  'elevenlabs-music': {
    description: `Enable music generation on LLM output. ${buildModelDescription('ElevenLabs music model', SUPPORTED_ELEVENLABS_MUSIC_MODELS)}`,
    type: [String] as [StringConstructor]
  },
  'minimax-music': {
    description: `Enable music generation on LLM output. ${buildModelDescription('MiniMax music model', SUPPORTED_MINIMAX_MUSIC_MODELS)}`,
    type: [String] as [StringConstructor]
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

const writeTextInputFlags = {
  'text-input': {
    description: 'Treat local .md/.txt files and directories as raw source text instead of URL lists',
    type: Boolean,
    default: false,
    negatable: false
  },
  'prompt-file': {
    description: 'Prepend prompt instructions from a local text file before named prompt presets',
    type: String
  },
  'rendered-text': {
    description: 'Save rendered step-3 markdown output alongside JSON output',
    type: Boolean,
    default: false,
    negatable: false
  },
  'rendered-out-dir': {
    description: 'Also write rendered step-3 markdown files to this directory using source-based filenames',
    type: String
  },
  'track-list': {
    description: 'Optional tracks.md file used to prepend track-number headers on saved rendered text',
    type: String
  }
} as const satisfies ClercFlagsDefinition

const writeLlmShortcutFlags = {
  'all-llm': {
    description: 'Enable every supported LLM provider/model for this command',
    type: Boolean,
    default: false,
    negatable: false
  }
} as const satisfies ClercFlagsDefinition

export const writeFlags = {
  ...withHelpGroup(batchFlags, 'step-1-download'),
  ...withHelpGroup(transcriptionFlags, 'step-2-stt'),
  ...withHelpGroup(ocrInputFlags, 'step-2-ocr'),
  ...withHelpGroup(ocrTuningFlags, 'step-2-ocr'),
  ...withHelpGroup(articleFlags, 'step-2-ocr'),
  ...withHelpGroup(epubInspectFlags, 'step-2-ocr'),
  ...withHelpGroup(writeLlmShortcutFlags, 'step-3-write'),
  ...withHelpGroup(llmProviderFlags, 'step-3-write'),
  ...withHelpGroup(promptFlag, 'step-3-write'),
  ...withHelpGroup(writeTextInputFlags, 'step-3-write'),
  ...withHelpGroup(writeTtsFlags, 'step-4-tts'),
  ...withHelpGroup(imageGenFlags, 'step-5-image'),
  ...withHelpGroup(videoGenFlags, 'step-6-video'),
  ...withHelpGroup(writeVideoModelFlags, 'step-6-video'),
  ...withHelpGroup(musicGenFlags, 'step-7-music'),
  ...withHelpGroup(writeMusicModelFlags, 'step-7-music'),
  ...withHelpGroup(priceFlag, 'pricing')
} as const satisfies ClercFlagsDefinition
