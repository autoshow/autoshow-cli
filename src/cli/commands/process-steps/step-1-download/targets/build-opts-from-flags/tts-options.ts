import {
  validateDeepgramTtsVoice,
  validateElevenLabsTtsTextNormalization,
  validateGcloudTtsVoice,
  validateGrokTtsLanguage,
  validateGrokTtsVoice,
  validateGroqTtsVoice,
  validateKittenTtsModel,
  validateKittenTtsSpeaker,
  validateMinimaxTtsEmotion,
  validateMinimaxTtsLanguageBoost,
  validateHumeTtsVoice,
  validateHumeTtsVoiceProvider,
  validateCartesiaTtsVoice,
  validateSpeechifyTtsAudioFormat,
  validateSpeechifyTtsVoice
} from '~/cli/commands/setup-and-utilities/models/model-options'
import type { RuntimeOptions } from '~/types'
import {
  parseOptionalNumberFlag,
  parseTtsDialogueFormat,
  readBooleanFlag,
  readOptionalRawStringFlag,
  readOptionalStringFlag,
  readOptionalStringListFlag,
  readStringFlag
} from '../options/flag-readers'
import {
  DEFAULT_KITTEN_TTS_SPEAKER,
  type readRuntimeModelOptions,
  validateCliValue
} from '../options/model-options'

type RuntimeModelOptions = ReturnType<typeof readRuntimeModelOptions>

type TtsRuntimeOptionKey =
  | 'ttsSpeaker'
  | 'kittenTtsModels'
  | 'kittenTtsModel'
  | 'groqTtsModels'
  | 'groqTtsModel'
  | 'groqVoiceId'
  | 'grokTtsModels'
  | 'grokTtsModel'
  | 'grokTtsVoice'
  | 'grokTtsLanguage'
  | 'grokTtsTextNormalization'
  | 'mistralTtsModels'
  | 'mistralTtsModel'
  | 'mistralTtsVoice'
  | 'mistralTtsRefAudio'
  | 'mistralTtsVoiceName'
  | 'ttsDialogueFormat'
  | 'ttsSpeakerRefAudios'
  | 'openaiTtsModels'
  | 'openaiTtsModel'
  | 'openaiVoiceId'
  | 'openaiTtsInstructions'
  | 'openaiTtsSpeed'
  | 'openaiTtsRefAudio'
  | 'openaiTtsConsentId'
  | 'openaiTtsConsentAudio'
  | 'openaiTtsConsentLanguage'
  | 'openaiTtsConsentName'
  | 'openaiTtsVoiceName'
  | 'geminiTtsModels'
  | 'geminiTtsModel'
  | 'geminiVoiceId'
  | 'geminiSpeaker1Name'
  | 'geminiSpeaker1Voice'
  | 'geminiSpeaker2Name'
  | 'geminiSpeaker2Voice'
  | 'elevenlabsTtsModels'
  | 'elevenlabsTtsModel'
  | 'elevenlabsVoiceId'
  | 'elevenlabsTtsPvcVoice'
  | 'elevenlabsTtsRefAudio'
  | 'elevenlabsTtsVoiceName'
  | 'elevenlabsTtsCloneRemoveBackgroundNoise'
  | 'elevenlabsTtsOutputFormat'
  | 'elevenlabsTtsLanguageCode'
  | 'elevenlabsTtsStability'
  | 'elevenlabsTtsSimilarityBoost'
  | 'elevenlabsTtsStyle'
  | 'elevenlabsTtsUseSpeakerBoost'
  | 'elevenlabsTtsSpeed'
  | 'elevenlabsTtsSeed'
  | 'elevenlabsTtsTextNormalization'
  | 'elevenlabsTtsPronunciationDictionaryLocators'
  | 'elevenlabsTtsOptimizeStreamingLatency'
  | 'elevenlabsTtsPvcAsIvc'
  | 'elevenlabsTtsPvcSamples'
  | 'elevenlabsTtsPvcSampleDir'
  | 'elevenlabsTtsPvcLanguage'
  | 'elevenlabsTtsPvcDescription'
  | 'elevenlabsTtsPvcCaptchaOut'
  | 'elevenlabsTtsPvcVerifyAudio'
  | 'elevenlabsTtsPvcWait'
  | 'deepgramTtsModels'
  | 'deepgramTtsModel'
  | 'deepgramVoiceId'
  | 'deepgramTtsEncoding'
  | 'deepgramTtsContainer'
  | 'deepgramTtsBitRate'
  | 'deepgramTtsSampleRate'
  | 'deepgramTtsSpeed'
  | 'minimaxTtsModels'
  | 'minimaxTtsModel'
  | 'minimaxTtsVoice'
  | 'minimaxTtsLanguageBoost'
  | 'minimaxTtsSpeed'
  | 'minimaxTtsVolume'
  | 'minimaxTtsPitch'
  | 'minimaxTtsEmotion'
  | 'minimaxTtsEnglishNormalization'
  | 'minimaxTtsPronunciations'
  | 'speechifyTtsModels'
  | 'speechifyTtsModel'
  | 'speechifyVoice'
  | 'speechifyTtsAudioFormat'
  | 'speechifyTtsLanguage'
  | 'speechifyTtsRefAudio'
  | 'speechifyTtsVoiceName'
  | 'speechifyTtsConsentName'
  | 'speechifyTtsConsentEmail'
  | 'speechifyTtsVoiceLocale'
  | 'speechifyTtsVoiceGender'
  | 'humeTtsModels'
  | 'humeTtsModel'
  | 'humeTtsVoice'
  | 'humeTtsVoiceProvider'
  | 'cartesiaTtsModels'
  | 'cartesiaTtsModel'
  | 'cartesiaTtsVoice'
  | 'cartesiaTtsLanguage'
  | 'gcloudTtsModels'
  | 'gcloudTtsModel'
  | 'gcloudTtsVoice'
  | 'gcloudTtsLanguage'
  | 'gcloudTtsRefAudio'
  | 'gcloudTtsConsentAudio'
  | 'gcloudTtsConsentLanguage'
  | 'gcloudTtsVoiceCloningKey'
  | 'gcloudTtsVoiceCloningKeyOut'

type TtsRuntimeOptions = Pick<RuntimeOptions, TtsRuntimeOptionKey>

export const buildTtsOptions = (
  flags: Record<string, unknown>,
  rawFlagArgs: string[],
  modelOptions: RuntimeModelOptions
): TtsRuntimeOptions => {
  const {
    kittenTtsModelValues,
    kittenTtsModelValue,
    elevenlabsTtsModels,
    elevenlabsTtsModel,
    minimaxTtsModels,
    minimaxTtsModel,
    groqTtsModels,
    groqTtsModel,
    grokTtsModels,
    grokTtsModel,
    mistralTtsModels,
    mistralTtsModel,
    openaiTtsModels,
    openaiTtsModel,
    geminiTtsModels,
    geminiTtsModel,
    deepgramTtsModels,
    deepgramTtsModel,
    speechifyTtsModels,
    speechifyTtsModel,
    humeTtsModels,
    humeTtsModel,
    cartesiaTtsModels,
    cartesiaTtsModel,
    gcloudTtsModels,
    gcloudTtsModel,
  } = modelOptions

  return {
    ttsSpeaker: (() => {
      const raw = readStringFlag(flags, 'kitten-voice', DEFAULT_KITTEN_TTS_SPEAKER)
      return kittenTtsModelValue !== undefined
        ? validateCliValue(validateKittenTtsSpeaker, raw)
        : raw
    })(),
    kittenTtsModels: kittenTtsModelValues,
    kittenTtsModel: kittenTtsModelValue === undefined ? undefined : validateCliValue(validateKittenTtsModel, kittenTtsModelValue),
    groqTtsModels,
    groqTtsModel,
    grokTtsModels,
    grokTtsModel,
    grokTtsVoice: (() => {
      const value = readOptionalStringFlag(flags, 'grok-tts-voice')
      if (value === undefined) return undefined
      if (grokTtsModels === undefined) return value
      return validateCliValue(validateGrokTtsVoice, value)
    })(),
    grokTtsLanguage: (() => {
      const value = readOptionalStringFlag(flags, 'grok-tts-language')
      if (value === undefined) return undefined
      return validateCliValue(validateGrokTtsLanguage, value)
    })(),
    grokTtsTextNormalization: readBooleanFlag(flags, 'grok-tts-text-normalization'),
    mistralTtsModels,
    mistralTtsModel,
    mistralTtsVoice: readOptionalStringFlag(flags, 'mistral-tts-voice'),
    mistralTtsRefAudio: readOptionalStringFlag(flags, 'mistral-tts-ref-audio'),
    mistralTtsVoiceName: readOptionalRawStringFlag(rawFlagArgs, 'mistral-tts-voice-name') ?? readOptionalStringFlag(flags, 'mistral-tts-voice-name'),
    ttsDialogueFormat: parseTtsDialogueFormat(readOptionalStringFlag(flags, 'tts-dialogue-format')),
    ttsSpeakerRefAudios: readOptionalStringListFlag(flags, 'tts-speaker-ref-audio'),
    openaiTtsModels,
    openaiTtsModel,
    geminiTtsModels,
    geminiTtsModel,
    deepgramTtsModels,
    deepgramTtsModel,
    speechifyTtsModels,
    speechifyTtsModel,
    speechifyVoice: (() => {
      const value = readOptionalStringFlag(flags, 'speechify-voice')
      if (value === undefined) return undefined
      if (speechifyTtsModels === undefined) return value
      return validateCliValue(validateSpeechifyTtsVoice, value)
    })(),
    speechifyTtsAudioFormat: (() => {
      const value = readOptionalStringFlag(flags, 'speechify-tts-audio-format')
      if (value === undefined) return undefined
      return validateCliValue(validateSpeechifyTtsAudioFormat, value)
    })(),
    speechifyTtsLanguage: readOptionalStringFlag(flags, 'speechify-tts-language'),
    speechifyTtsRefAudio: readOptionalStringFlag(flags, 'speechify-tts-ref-audio'),
    speechifyTtsVoiceName: readOptionalRawStringFlag(rawFlagArgs, 'speechify-tts-voice-name') ?? readOptionalStringFlag(flags, 'speechify-tts-voice-name'),
    speechifyTtsConsentName: readOptionalRawStringFlag(rawFlagArgs, 'speechify-tts-consent-name') ?? readOptionalStringFlag(flags, 'speechify-tts-consent-name'),
    speechifyTtsConsentEmail: readOptionalStringFlag(flags, 'speechify-tts-consent-email'),
    speechifyTtsVoiceLocale: readOptionalStringFlag(flags, 'speechify-tts-voice-locale'),
    speechifyTtsVoiceGender: readOptionalStringFlag(flags, 'speechify-tts-voice-gender'),
    humeTtsModels,
    humeTtsModel,
    humeTtsVoice: (() => {
      const value = readOptionalRawStringFlag(rawFlagArgs, 'hume-tts-voice') ?? readOptionalStringFlag(flags, 'hume-tts-voice')
      if (value === undefined) return undefined
      if (humeTtsModels === undefined) return value
      return validateCliValue(validateHumeTtsVoice, value)
    })(),
    humeTtsVoiceProvider: (() => {
      const value = readOptionalStringFlag(flags, 'hume-tts-voice-provider')
      if (value === undefined) return undefined
      return validateCliValue(validateHumeTtsVoiceProvider, value)
    })(),
    cartesiaTtsModels,
    cartesiaTtsModel,
    cartesiaTtsVoice: (() => {
      const value = readOptionalStringFlag(flags, 'cartesia-tts-voice')
      if (value === undefined) return undefined
      if (cartesiaTtsModels === undefined) return value
      return validateCliValue(validateCartesiaTtsVoice, value)
    })(),
    cartesiaTtsLanguage: readOptionalStringFlag(flags, 'cartesia-tts-language'),
    gcloudTtsModels,
    gcloudTtsModel,
    gcloudTtsVoice: (() => {
      const value = readOptionalStringFlag(flags, 'gcloud-tts-voice')
      if (value === undefined) return undefined
      if (gcloudTtsModels === undefined) return value
      return validateCliValue(validateGcloudTtsVoice, value)
    })(),
    gcloudTtsLanguage: readOptionalStringFlag(flags, 'gcloud-tts-language'),
    gcloudTtsRefAudio: readOptionalStringFlag(flags, 'gcloud-tts-ref-audio'),
    gcloudTtsConsentAudio: readOptionalStringFlag(flags, 'gcloud-tts-consent-audio'),
    gcloudTtsConsentLanguage: readOptionalStringFlag(flags, 'gcloud-tts-consent-language'),
    gcloudTtsVoiceCloningKey: readOptionalStringFlag(flags, 'gcloud-tts-voice-cloning-key'),
    gcloudTtsVoiceCloningKeyOut: readOptionalStringFlag(flags, 'gcloud-tts-voice-cloning-key-out'),
    groqVoiceId: (() => {
      const value = readOptionalStringFlag(flags, 'groq-voice')
      if (value === undefined) return undefined
      if (groqTtsModels === undefined) return value
      return validateCliValue(validateGroqTtsVoice, value)
    })(),
    openaiVoiceId: readOptionalStringFlag(flags, 'openai-voice'),
    openaiTtsInstructions: readOptionalRawStringFlag(rawFlagArgs, 'openai-tts-instructions') ?? readOptionalStringFlag(flags, 'openai-tts-instructions'),
    openaiTtsSpeed: parseOptionalNumberFlag(readOptionalStringFlag(flags, 'openai-tts-speed'), 'openai-tts-speed', { min: 0.25, max: 4 }),
    openaiTtsRefAudio: readOptionalStringFlag(flags, 'openai-tts-ref-audio'),
    openaiTtsConsentId: readOptionalStringFlag(flags, 'openai-tts-consent-id'),
    openaiTtsConsentAudio: readOptionalStringFlag(flags, 'openai-tts-consent-audio'),
    openaiTtsConsentLanguage: readOptionalStringFlag(flags, 'openai-tts-consent-language'),
    openaiTtsConsentName: readOptionalRawStringFlag(rawFlagArgs, 'openai-tts-consent-name') ?? readOptionalStringFlag(flags, 'openai-tts-consent-name'),
    openaiTtsVoiceName: readOptionalRawStringFlag(rawFlagArgs, 'openai-tts-voice-name') ?? readOptionalStringFlag(flags, 'openai-tts-voice-name'),
    geminiVoiceId: readOptionalStringFlag(flags, 'gemini-voice'),
    deepgramVoiceId: (() => {
      const value = readOptionalStringFlag(flags, 'deepgram-voice')
      if (value === undefined) return undefined
      if (deepgramTtsModels === undefined) return value
      return validateCliValue(validateDeepgramTtsVoice, value)
    })(),
    deepgramTtsEncoding: readOptionalStringFlag(flags, 'deepgram-tts-encoding'),
    deepgramTtsContainer: readOptionalStringFlag(flags, 'deepgram-tts-container'),
    deepgramTtsBitRate: parseOptionalNumberFlag(readOptionalStringFlag(flags, 'deepgram-tts-bit-rate'), 'deepgram-tts-bit-rate', { min: 1, max: 1000000, integer: true }),
    deepgramTtsSampleRate: parseOptionalNumberFlag(readOptionalStringFlag(flags, 'deepgram-tts-sample-rate'), 'deepgram-tts-sample-rate', { min: 1, max: 192000, integer: true }),
    deepgramTtsSpeed: parseOptionalNumberFlag(readOptionalStringFlag(flags, 'deepgram-tts-speed'), 'deepgram-tts-speed', { min: 0.5, max: 2 }),
    geminiSpeaker1Name: readOptionalRawStringFlag(rawFlagArgs, 'gemini-speaker-1-name') ?? readOptionalStringFlag(flags, 'gemini-speaker-1-name'),
    geminiSpeaker1Voice: readOptionalRawStringFlag(rawFlagArgs, 'gemini-speaker-1-voice') ?? readOptionalStringFlag(flags, 'gemini-speaker-1-voice'),
    geminiSpeaker2Name: readOptionalRawStringFlag(rawFlagArgs, 'gemini-speaker-2-name') ?? readOptionalStringFlag(flags, 'gemini-speaker-2-name'),
    geminiSpeaker2Voice: readOptionalRawStringFlag(rawFlagArgs, 'gemini-speaker-2-voice') ?? readOptionalStringFlag(flags, 'gemini-speaker-2-voice'),
    elevenlabsTtsModels,
    elevenlabsTtsModel,
    elevenlabsTtsPvcVoice: readOptionalStringFlag(flags, 'elevenlabs-tts-pvc-voice'),
    elevenlabsTtsRefAudio: readOptionalStringFlag(flags, 'elevenlabs-tts-ref-audio'),
    elevenlabsTtsVoiceName: readOptionalRawStringFlag(rawFlagArgs, 'elevenlabs-tts-voice-name') ?? readOptionalStringFlag(flags, 'elevenlabs-tts-voice-name'),
    elevenlabsTtsCloneRemoveBackgroundNoise: readBooleanFlag(flags, 'elevenlabs-tts-clone-remove-background-noise'),
    elevenlabsTtsOutputFormat: readOptionalStringFlag(flags, 'elevenlabs-tts-output-format'),
    elevenlabsTtsLanguageCode: readOptionalStringFlag(flags, 'elevenlabs-tts-language-code'),
    elevenlabsTtsStability: parseOptionalNumberFlag(readOptionalStringFlag(flags, 'elevenlabs-tts-stability'), 'elevenlabs-tts-stability', { min: 0, max: 1 }),
    elevenlabsTtsSimilarityBoost: parseOptionalNumberFlag(readOptionalStringFlag(flags, 'elevenlabs-tts-similarity-boost'), 'elevenlabs-tts-similarity-boost', { min: 0, max: 1 }),
    elevenlabsTtsStyle: parseOptionalNumberFlag(readOptionalStringFlag(flags, 'elevenlabs-tts-style'), 'elevenlabs-tts-style', { min: 0, max: 1 }),
    elevenlabsTtsUseSpeakerBoost: readBooleanFlag(flags, 'elevenlabs-tts-use-speaker-boost'),
    elevenlabsTtsSpeed: parseOptionalNumberFlag(readOptionalStringFlag(flags, 'elevenlabs-tts-speed'), 'elevenlabs-tts-speed', { min: 0.7, max: 1.2 }),
    elevenlabsTtsSeed: parseOptionalNumberFlag(readOptionalStringFlag(flags, 'elevenlabs-tts-seed'), 'elevenlabs-tts-seed', { min: 0, max: 4294967295, integer: true }),
    elevenlabsTtsTextNormalization: (() => {
      const value = readOptionalStringFlag(flags, 'elevenlabs-tts-text-normalization')
      if (value === undefined) return undefined
      return validateCliValue(validateElevenLabsTtsTextNormalization, value)
    })(),
    elevenlabsTtsPronunciationDictionaryLocators: readOptionalStringListFlag(flags, 'elevenlabs-tts-pronunciation-dictionary-locator'),
    elevenlabsTtsOptimizeStreamingLatency: parseOptionalNumberFlag(readOptionalStringFlag(flags, 'elevenlabs-tts-optimize-streaming-latency'), 'elevenlabs-tts-optimize-streaming-latency', { min: 0, max: 4, integer: true }),
    elevenlabsTtsPvcAsIvc: readBooleanFlag(flags, 'elevenlabs-tts-pvc-as-ivc'),
    elevenlabsTtsPvcSamples: readOptionalStringListFlag(flags, 'elevenlabs-tts-pvc-sample'),
    elevenlabsTtsPvcSampleDir: readOptionalStringFlag(flags, 'elevenlabs-tts-pvc-sample-dir'),
    elevenlabsTtsPvcLanguage: readOptionalStringFlag(flags, 'elevenlabs-tts-pvc-language'),
    elevenlabsTtsPvcDescription: readOptionalRawStringFlag(rawFlagArgs, 'elevenlabs-tts-pvc-description') ?? readOptionalStringFlag(flags, 'elevenlabs-tts-pvc-description'),
    elevenlabsTtsPvcCaptchaOut: readOptionalStringFlag(flags, 'elevenlabs-tts-pvc-captcha-out'),
    elevenlabsTtsPvcVerifyAudio: readOptionalStringFlag(flags, 'elevenlabs-tts-pvc-verify-audio'),
    elevenlabsTtsPvcWait: readBooleanFlag(flags, 'elevenlabs-tts-pvc-wait'),
    minimaxTtsModels,
    minimaxTtsModel,
    minimaxTtsVoice: readOptionalStringFlag(flags, 'minimax-tts-voice'),
    minimaxTtsLanguageBoost: (() => {
      const value = readOptionalStringFlag(flags, 'minimax-tts-language-boost')
      if (value === undefined) return undefined
      return validateCliValue(validateMinimaxTtsLanguageBoost, value)
    })(),
    minimaxTtsSpeed: parseOptionalNumberFlag(readOptionalStringFlag(flags, 'minimax-tts-speed'), 'minimax-tts-speed', { min: 0.5, max: 2 }),
    minimaxTtsVolume: parseOptionalNumberFlag(readOptionalStringFlag(flags, 'minimax-tts-volume'), 'minimax-tts-volume', { min: 0, max: 10, exclusiveMin: true }),
    minimaxTtsPitch: parseOptionalNumberFlag(readOptionalStringFlag(flags, 'minimax-tts-pitch'), 'minimax-tts-pitch', { min: -12, max: 12, integer: true }),
    minimaxTtsEmotion: (() => {
      const value = readOptionalStringFlag(flags, 'minimax-tts-emotion')
      if (value === undefined) return undefined
      return validateCliValue(validateMinimaxTtsEmotion, value)
    })(),
    minimaxTtsEnglishNormalization: readBooleanFlag(flags, 'minimax-tts-english-normalization'),
    minimaxTtsPronunciations: readOptionalStringListFlag(flags, 'minimax-tts-pronunciation'),
    elevenlabsVoiceId: readOptionalStringFlag(flags, 'elevenlabs-voice'),
  }
}
