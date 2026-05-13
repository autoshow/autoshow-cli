import type { ClercFlagsDefinition } from 'clerc'
import { withHelpGroup } from './flag-utils'
import {
  SUPPORTED_KITTEN_TTS_MODELS,
  SUPPORTED_ELEVENLABS_TTS_MODELS,
  SUPPORTED_MINIMAX_TTS_MODELS,
  SUPPORTED_GROQ_TTS_MODELS,
  SUPPORTED_MISTRAL_TTS_MODELS,
  SUPPORTED_OPENAI_TTS_MODELS,
  SUPPORTED_GEMINI_TTS_MODELS,
  SUPPORTED_RUNWAY_TTS_MODELS,
  SUPPORTED_GEMINI_VIDEO_MODELS,
  SUPPORTED_GLM_VIDEO_MODELS,
  SUPPORTED_GROK_VIDEO_MODELS,
  SUPPORTED_MINIMAX_VIDEO_MODELS,
  SUPPORTED_RUNWAY_VIDEO_MODELS,
  SUPPORTED_ELEVENLABS_MUSIC_MODELS,
  SUPPORTED_MINIMAX_MUSIC_MODELS,
  SUPPORTED_GEMINI_MUSIC_MODELS
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
  'mistral-tts': {
    description: `Enable Mistral Voxtral TTS on LLM output. ${buildModelDescription('Mistral Voxtral TTS model', SUPPORTED_MISTRAL_TTS_MODELS)}`,
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
  'runway-tts': {
    description: `Enable Runway TTS on LLM output. ${buildModelDescription('Runway TTS model', SUPPORTED_RUNWAY_TTS_MODELS)}`,
    type: [String] as [StringConstructor]
  },
  'minimax-tts-voice': {
    description: 'MiniMax TTS voice ID override, or custom clone voice_id when --minimax-tts-ref-audio is set (default: English_expressive_narrator)',
    type: String
  },
  'minimax-tts-ref-audio': {
    description: 'MiniMax TTS source audio path for rapid voice cloning',
    type: String
  },
  'minimax-tts-prompt-audio': {
    description: 'Optional MiniMax TTS prompt audio path for voice cloning quality',
    type: String
  },
  'minimax-tts-prompt-text': {
    description: 'Transcript for --minimax-tts-prompt-audio',
    type: String
  },
  'minimax-tts-clone-noise-reduction': {
    description: 'Enable MiniMax voice clone noise reduction',
    type: Boolean,
    default: false,
    negatable: false
  },
  'minimax-tts-clone-volume-normalization': {
    description: 'Enable MiniMax voice clone volume normalization',
    type: Boolean,
    default: false,
    negatable: false
  },
  'minimax-tts-language-boost': {
    description: 'MiniMax TTS language boost: auto|English|Chinese|Chinese,Yue|Arabic|Spanish|French|German|Japanese|Korean|...',
    type: String
  },
  'minimax-tts-speed': {
    description: 'MiniMax TTS speech speed from 0.5 to 2.0',
    type: String
  },
  'minimax-tts-volume': {
    description: 'MiniMax TTS speech volume greater than 0 and up to 10',
    type: String
  },
  'minimax-tts-pitch': {
    description: 'MiniMax TTS pitch adjustment from -12 to 12',
    type: String
  },
  'minimax-tts-emotion': {
    description: 'MiniMax TTS emotion: happy|sad|angry|fearful|disgusted|surprised|calm|fluent|whisper',
    type: String
  },
  'minimax-tts-english-normalization': {
    description: 'Enable MiniMax English text normalization',
    type: Boolean,
    default: false,
    negatable: false
  },
  'minimax-tts-pronunciation': {
    description: 'MiniMax pronunciation rule for pronunciation_dict.tone; repeatable, e.g. "omg/oh my god"',
    type: [String] as [StringConstructor]
  },
  'openai-voice': {
    description: 'OpenAI TTS voice ID override, including existing custom voice_ IDs (default: alloy)',
    type: String
  },
  'openai-tts-instructions': {
    description: 'OpenAI TTS voice/style instructions',
    type: String
  },
  'openai-tts-speed': {
    description: 'OpenAI TTS speed from 0.25 to 4.0',
    type: String
  },
  'openai-tts-ref-audio': {
    description: 'OpenAI TTS sample audio path used to create a custom voice',
    type: String
  },
  'openai-tts-consent-id': {
    description: 'Existing OpenAI voice consent recording ID for custom voice creation',
    type: String
  },
  'openai-tts-consent-audio': {
    description: 'OpenAI TTS consent recording audio path to upload for custom voice creation',
    type: String
  },
  'openai-tts-consent-language': {
    description: 'OpenAI TTS consent recording BCP 47 language tag (default: en-US)',
    type: String
  },
  'openai-tts-consent-name': {
    description: 'OpenAI TTS consent recording label; defaults to the consent file name',
    type: String
  },
  'openai-tts-voice-name': {
    description: 'OpenAI TTS custom voice label; defaults to AutoShow_<timestamp>',
    type: String
  },
  'gemini-voice': {
    description: 'Gemini TTS voice name override (default: Kore)',
    type: String
  },
  'runway-tts-voice': {
    description: 'Runway TTS preset voice override (default: Leslie)',
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
    description: 'Groq TTS voice ID override (default depends on --groq-tts model)',
    type: String
  },
  'mistral-tts-voice': {
    description: 'Mistral TTS saved/custom voice ID',
    type: String
  },
  'mistral-tts-ref-audio': {
    description: 'Mistral TTS reference audio path for one-off voice cloning',
    type: String
  },
  'elevenlabs-voice': {
    description: 'ElevenLabs voice ID override (default: hpp4J3VqNfWAUOO0d1Us)',
    type: String
  },
  'elevenlabs-tts-pvc-voice': {
    description: 'ElevenLabs trained Professional Voice Clone voice ID for synthesis',
    type: String
  },
  'elevenlabs-tts-ref-audio': {
    description: 'ElevenLabs TTS source audio path for Instant Voice Cloning',
    type: String
  },
  'elevenlabs-tts-voice-name': {
    description: 'ElevenLabs TTS cloned voice label; defaults to AutoShow_<timestamp>',
    type: String
  },
  'elevenlabs-tts-clone-remove-background-noise': {
    description: 'Enable ElevenLabs IVC background noise removal for the reference audio',
    type: Boolean,
    default: false,
    negatable: false
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
  },
  'glm-video': {
    description: `Enable video generation on LLM output. ${buildModelDescription('GLM video model', SUPPORTED_GLM_VIDEO_MODELS)}`,
    type: [String] as [StringConstructor]
  },
  'grok-video': {
    description: `Enable video generation on LLM output. ${buildModelDescription('Grok video model', SUPPORTED_GROK_VIDEO_MODELS)}`,
    type: [String] as [StringConstructor]
  },
  'runway-video': {
    description: `Enable video generation on LLM output. ${buildModelDescription('Runway video model', SUPPORTED_RUNWAY_VIDEO_MODELS)}`,
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
  'gemini-music': {
    description: `Enable music generation on LLM output. ${buildModelDescription('Gemini Lyria music model', SUPPORTED_GEMINI_MUSIC_MODELS)}`,
    type: [String] as [StringConstructor]
  },
  'music-duration': {
    description: 'Music duration in seconds',
    type: String
  },
  'music-lyrics-file': {
    description: 'Lyrics file path (.md or .txt) for MiniMax, deAPI, and Gemini music generation',
    type: String
  },
  'music-instrumental': {
    description: 'Force instrumental generation for providers that support prompt/instrumental mode',
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
