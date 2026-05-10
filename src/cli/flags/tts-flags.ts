import type { ClercFlagsDefinition } from 'clerc'
import {
  SUPPORTED_KITTEN_TTS_MODELS,
  SUPPORTED_ELEVENLABS_TTS_MODELS,
  SUPPORTED_MINIMAX_TTS_MODELS,
  SUPPORTED_GROQ_TTS_MODELS,
  SUPPORTED_GROK_TTS_MODELS,
  SUPPORTED_MISTRAL_TTS_MODELS,
  SUPPORTED_OPENAI_TTS_MODELS,
  SUPPORTED_GEMINI_TTS_MODELS,
  SUPPORTED_DEEPGRAM_TTS_MODELS,
  SUPPORTED_RUNWAY_TTS_MODELS,
  SUPPORTED_SPEECHIFY_TTS_MODELS,
  SUPPORTED_GCLOUD_TTS_MODELS,
  SUPPORTED_DEAPI_TTS_MODELS
} from '~/cli/commands/setup-and-utilities/models/model-options'
import { buildModelDescription } from '~/cli/commands/setup-and-utilities/models/model-validation'
import { priceFlag } from './shared-flags'

export const ttsFlags = {
  'all-tts': {
    description: 'Enable every supported TTS provider/model for this command',
    type: Boolean,
    default: false,
    negatable: false
  },
  'tts-provider-concurrency': {
    description: 'TTS: max hosted providers/models running in parallel for one item (default 2; --all-tts defaults up to 8)',
    type: String,
    default: '2'
  },
  'tts-local-concurrency': {
    description: 'TTS: max local providers running in parallel for one item (default 1)',
    type: String,
    default: '1'
  },
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
  'grok-tts': {
    description: buildModelDescription('xAI Grok TTS model', SUPPORTED_GROK_TTS_MODELS),
    type: [String] as [StringConstructor]
  },
  'mistral-tts': {
    description: buildModelDescription('Mistral Voxtral TTS model', SUPPORTED_MISTRAL_TTS_MODELS),
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
  'deepgram-tts': {
    description: buildModelDescription('Deepgram TTS model', SUPPORTED_DEEPGRAM_TTS_MODELS),
    type: [String] as [StringConstructor]
  },
  'runway-tts': {
    description: buildModelDescription('Runway TTS model', SUPPORTED_RUNWAY_TTS_MODELS),
    type: [String] as [StringConstructor]
  },
  'deapi-tts': {
    description: buildModelDescription('deAPI TTS model', SUPPORTED_DEAPI_TTS_MODELS),
    type: [String] as [StringConstructor]
  },
  'speechify-tts': {
    description: buildModelDescription('Speechify TTS model', SUPPORTED_SPEECHIFY_TTS_MODELS),
    type: [String] as [StringConstructor]
  },
  'gcloud-tts': {
    description: buildModelDescription('Google Cloud TTS model', SUPPORTED_GCLOUD_TTS_MODELS),
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
  'openai-voice': {
    description: 'OpenAI TTS voice ID override, including existing custom voice_ IDs (default: alloy)',
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
  'deepgram-voice': {
    description: 'Deepgram TTS voice/model override (default: aura-2-thalia-en)',
    type: String
  },
  'deapi-tts-voice': {
    description: 'deAPI TTS voice override (default: af_heart for Kokoro)',
    type: String
  },
  'deapi-tts-ref-audio': {
    description: 'deAPI TTS reference audio path for Qwen3 voice cloning',
    type: String
  },
  'deapi-tts-ref-text': {
    description: 'Optional transcript for the deAPI TTS reference audio',
    type: String
  },
  'speechify-voice': {
    description: 'Speechify TTS voice ID override (default: george)',
    type: String
  },
  'speechify-tts-ref-audio': {
    description: 'Speechify TTS source audio path used to create a custom voice',
    type: String
  },
  'speechify-tts-voice-name': {
    description: 'Created Speechify custom voice label; defaults to AutoShow_<timestamp>',
    type: String
  },
  'speechify-tts-consent-name': {
    description: 'Full name for Speechify custom voice consent',
    type: String
  },
  'speechify-tts-consent-email': {
    description: 'Email address for Speechify custom voice consent',
    type: String
  },
  'speechify-tts-voice-locale': {
    description: 'Speechify custom voice locale (default: en-US)',
    type: String
  },
  'speechify-tts-voice-gender': {
    description: 'Speechify custom voice gender: male|female|notSpecified (default: notSpecified)',
    type: String
  },
  'gcloud-tts-voice': {
    description: 'Google Cloud TTS voice name override (default depends on --gcloud-tts model)',
    type: String
  },
  'gcloud-tts-language': {
    description: 'Google Cloud TTS BCP 47 language tag; inferred from voice or defaults to en-US',
    type: String
  },
  'gcloud-tts-ref-audio': {
    description: 'Google Cloud TTS reference audio path for instant custom voice key generation',
    type: String
  },
  'gcloud-tts-consent-audio': {
    description: 'Google Cloud TTS consent recording audio path for instant custom voice key generation',
    type: String
  },
  'gcloud-tts-consent-language': {
    description: 'Google Cloud TTS consent recording BCP 47 language tag (default: en-US)',
    type: String
  },
  'gcloud-tts-voice-cloning-key': {
    description: 'Existing Google Cloud TTS instant custom voice cloning key',
    type: String
  },
  'gcloud-tts-voice-cloning-key-out': {
    description: 'Write a generated Google Cloud TTS instant custom voice cloning key to this path',
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
    description: 'Groq TTS voice ID override (default: troy)',
    type: String
  },
  'grok-tts-voice': {
    description: 'xAI Grok TTS voice override (default: eve)',
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
  'tts-dialogue-format': {
    description: 'Dialogue input format for multi-speaker TTS: screenplay|labeled',
    type: String
  },
  'tts-speaker-ref-audio': {
    description: 'Speaker reference audio mapping for dialogue TTS, SPEAKER=path; repeatable',
    type: [String] as [StringConstructor]
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
  },
  'elevenlabs-tts-pvc-sample': {
    description: 'ElevenLabs PVC training sample audio path; repeatable',
    type: [String] as [StringConstructor]
  },
  'elevenlabs-tts-pvc-sample-dir': {
    description: 'Directory of ElevenLabs PVC training sample audio files',
    type: String
  },
  'elevenlabs-tts-pvc-language': {
    description: 'ElevenLabs PVC sample language code (default: en)',
    type: String
  },
  'elevenlabs-tts-pvc-description': {
    description: 'ElevenLabs PVC voice description',
    type: String
  },
  'elevenlabs-tts-pvc-captcha-out': {
    description: 'Write the ElevenLabs PVC verification CAPTCHA image to this path',
    type: String
  },
  'elevenlabs-tts-pvc-verify-audio': {
    description: 'Audio recording of the ElevenLabs PVC CAPTCHA reading for verification',
    type: String
  },
  'elevenlabs-tts-pvc-wait': {
    description: 'Wait for ElevenLabs PVC fine tuning before synthesis',
    type: Boolean,
    default: false,
    negatable: false
  },
  ...priceFlag
} as const satisfies ClercFlagsDefinition
