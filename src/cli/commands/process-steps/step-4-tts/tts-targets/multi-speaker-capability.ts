import type { TtsProvider, MultiSpeakerStrategy, TtsOptions, SpeakerVoiceMapping } from '~/types'

const MULTI_SPEAKER_CAPABILITY: Partial<Record<TtsProvider, MultiSpeakerStrategy>> = {
  gemini: 'native',
  openai: 'segment-and-concat',
  elevenlabs: 'segment-and-concat',
  minimax: 'segment-and-concat',
  groq: 'segment-and-concat',
  grok: 'segment-and-concat',
  mistral: 'segment-and-concat',
  deepgram: 'segment-and-concat',
  speechify: 'segment-and-concat',
  hume: 'segment-and-concat',
  cartesia: 'segment-and-concat',
  kitten: 'segment-and-concat',
}

const REF_AUDIO_PROVIDERS = new Set<TtsProvider>(['mistral', 'openai', 'elevenlabs', 'speechify'])

const VOICE_ID_FIELD_BY_PROVIDER: Partial<Record<TtsProvider, keyof TtsOptions>> = {
  openai: 'openaiVoiceId',
  gemini: 'geminiVoiceId',
  deepgram: 'deepgramVoiceId',
  groq: 'groqVoiceId',
  grok: 'grokTtsVoice',
  mistral: 'mistralTtsVoice',
  elevenlabs: 'elevenlabsVoiceId',
  speechify: 'speechifyVoice',
  hume: 'humeTtsVoice',
  cartesia: 'cartesiaTtsVoice',
  minimax: 'minimaxTtsVoice',
  kitten: 'ttsSpeaker',
}

const REF_AUDIO_FIELD_BY_PROVIDER: Partial<Record<TtsProvider, keyof TtsOptions>> = {
  mistral: 'mistralTtsRefAudio',
  openai: 'openaiTtsRefAudio',
  elevenlabs: 'elevenlabsTtsRefAudio',
  speechify: 'speechifyTtsRefAudio',
}

export const getMultiSpeakerStrategy = (
  provider: TtsProvider
): MultiSpeakerStrategy | undefined =>
  MULTI_SPEAKER_CAPABILITY[provider]

export const supportsRefAudioMultiSpeaker = (provider: TtsProvider): boolean =>
  REF_AUDIO_PROVIDERS.has(provider)

export const overrideVoiceForProvider = (
  service: TtsProvider,
  opts: TtsOptions,
  mapping: SpeakerVoiceMapping
): TtsOptions => {
  const overridden = { ...opts }
  if (mapping.voiceKind === 'ref-audio') {
    const field = REF_AUDIO_FIELD_BY_PROVIDER[service]
    if (!field) {
      throw new Error(`Provider ${service} does not support reference audio for multi-speaker TTS.`)
    }
    ;(overridden as Record<string, unknown>)[field] = mapping.voice
  } else {
    const field = VOICE_ID_FIELD_BY_PROVIDER[service]
    if (!field) {
      throw new Error(`Provider ${service} does not support voice ID override for multi-speaker TTS.`)
    }
    ;(overridden as Record<string, unknown>)[field] = mapping.voice
  }
  return overridden
}
