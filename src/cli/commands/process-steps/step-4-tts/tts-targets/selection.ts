import type { GeminiMultiSpeakerConfig, SpeakerVoiceRegistry, TtsOptions } from '~/types'
import {
  isMultiSpeakerRequested,
  parseSpeakerRefAudioMappings,
  parseSpeakerVoiceMappings
} from '../dialogue-normalizer'
import { resolveGeminiMultiSpeakerConfig } from '../tts-services/gemini/gemini-tts-config'

export type TtsTargetSelection = {
  kittenModels: string[]
  elevenlabsModels: string[]
  minimaxModels: string[]
  groqModels: string[]
  grokModels: string[]
  mistralModels: string[]
  openaiModels: string[]
  geminiModels: string[]
  deepgramModels: string[]
  speechifyModels: string[]
  humeModels: string[]
  cartesiaModels: string[]
  geminiMultiSpeakerConfig: GeminiMultiSpeakerConfig | undefined
  speakerVoiceRegistry: SpeakerVoiceRegistry | undefined
  multiSpeakerRequested: boolean
  minimaxVoiceId: string | undefined
  minimaxLanguageBoost: string | undefined
  minimaxSpeed: number | undefined
  minimaxVolume: number | undefined
  minimaxPitch: number | undefined
  minimaxEmotion: string | undefined
  minimaxEnglishNormalization: boolean
  minimaxPronunciations: string[] | undefined
  openaiCloneRefAudioPath: string | undefined
  openaiCloneConsentId: string | undefined
  openaiCloneConsentAudioPath: string | undefined
  openaiCloneConsentLanguage: string | undefined
  openaiCloneConsentName: string | undefined
  openaiCloneVoiceName: string | undefined
  openaiVoiceId: string | undefined
  openaiInstructions: string | undefined
  openaiSpeed: number | undefined
  deepgramEncoding: string | undefined
  deepgramContainer: string | undefined
  deepgramBitRate: number | undefined
  deepgramSampleRate: number | undefined
  deepgramSpeed: number | undefined
  elevenLabsCloneRefAudioPath: string | undefined
  elevenLabsCloneVoiceName: string | undefined
  elevenLabsCloneRemoveBackgroundNoise: boolean
  elevenLabsVoiceId: string | undefined
  elevenLabsOutputFormat: string | undefined
  elevenLabsLanguageCode: string | undefined
  elevenLabsStability: number | undefined
  elevenLabsSimilarityBoost: number | undefined
  elevenLabsStyle: number | undefined
  elevenLabsUseSpeakerBoost: boolean
  elevenLabsSpeed: number | undefined
  elevenLabsSeed: number | undefined
  elevenLabsTextNormalization: string | undefined
  elevenLabsPronunciationDictionaryLocators: string[] | undefined
  elevenLabsOptimizeStreamingLatency: number | undefined
  speechifyCustomVoiceRefAudioPath: string | undefined
  speechifyCustomVoiceName: string | undefined
  speechifyCustomVoiceConsentName: string | undefined
  speechifyCustomVoiceConsentEmail: string | undefined
  speechifyCustomVoiceLocale: string | undefined
  speechifyCustomVoiceGender: string | undefined
  speechifyVoiceId: string | undefined
  speechifyAudioFormat: string | undefined
  speechifyLanguage: string | undefined
  humeVoice: string | undefined
  humeVoiceProvider: string | undefined
  cartesiaVoiceId: string | undefined
  cartesiaLanguage: string | undefined
  groqVoiceId: string | undefined
  grokVoiceId: string | undefined
  grokLanguage: string | undefined
  grokTextNormalization: boolean
  mistralVoiceId: string | undefined
  mistralRefAudioPath: string | undefined
  mistralVoiceName: string | undefined
  geminiVoiceId: string | undefined
  deepgramVoiceId: string | undefined
  hasOpenAICloneFlags: boolean
  hasElevenLabsCloneFlags: boolean
  hasSpeechifyCustomVoiceFlags: boolean
  hasElevenLabsVoiceNameOnly: boolean
  dialogueRequested: boolean
}

const selectModels = (
  models: string[] | undefined,
  model: string | undefined
): string[] => models ?? (model ? [model] : [])

const trimmed = (value: string | undefined): string | undefined => value?.trim() || undefined

export const createTtsTargetSelection = (options: TtsOptions): TtsTargetSelection => {
  const openaiCloneRefAudioPath = trimmed(options.openaiTtsRefAudio)
  const openaiCloneConsentId = trimmed(options.openaiTtsConsentId)
  const openaiCloneConsentAudioPath = trimmed(options.openaiTtsConsentAudio)
  const openaiCloneConsentLanguage = trimmed(options.openaiTtsConsentLanguage)
  const openaiCloneConsentName = trimmed(options.openaiTtsConsentName)
  const openaiCloneVoiceName = trimmed(options.openaiTtsVoiceName)
  const elevenLabsCloneRefAudioPath = trimmed(options.elevenlabsTtsRefAudio)
  const elevenLabsCloneVoiceName = trimmed(options.elevenlabsTtsVoiceName)
  const elevenLabsPronunciationDictionaryLocators = options.elevenlabsTtsPronunciationDictionaryLocators?.map((item) => item.trim()).filter(Boolean)
  const speechifyCustomVoiceRefAudioPath = trimmed(options.speechifyTtsRefAudio)
  const speechifyCustomVoiceName = trimmed(options.speechifyTtsVoiceName)
  const speechifyCustomVoiceConsentName = trimmed(options.speechifyTtsConsentName)
  const speechifyCustomVoiceConsentEmail = trimmed(options.speechifyTtsConsentEmail)
  const speechifyCustomVoiceLocale = trimmed(options.speechifyTtsVoiceLocale)
  const speechifyCustomVoiceGender = trimmed(options.speechifyTtsVoiceGender)
  const hasOpenAICloneFlags = Boolean(
    openaiCloneRefAudioPath
    || openaiCloneConsentId
    || openaiCloneConsentAudioPath
    || openaiCloneConsentLanguage
    || openaiCloneConsentName
    || openaiCloneVoiceName
  )
  const hasElevenLabsCloneFlags = Boolean(
    elevenLabsCloneRefAudioPath
    || options.elevenlabsTtsCloneRemoveBackgroundNoise === true
  )
  const hasSpeechifyCustomVoiceFlags = Boolean(
    speechifyCustomVoiceRefAudioPath
    || speechifyCustomVoiceName
    || speechifyCustomVoiceConsentName
    || speechifyCustomVoiceConsentEmail
    || speechifyCustomVoiceLocale
    || speechifyCustomVoiceGender
  )
  const hasElevenLabsVoiceNameOnly = Boolean(
    elevenLabsCloneVoiceName
    && !hasElevenLabsCloneFlags
  )

  const multiSpeaker = isMultiSpeakerRequested(options)
  const speakerVoiceRegistry = multiSpeaker
    ? ((options.ttsSpeakers?.length ?? 0) > 0
      ? parseSpeakerVoiceMappings(options.ttsSpeakers)
      : parseSpeakerRefAudioMappings(options.ttsSpeakerRefAudios))
    : undefined

  return {
    kittenModels: selectModels(options.kittenTtsModels, options.kittenTtsModel),
    elevenlabsModels: selectModels(options.elevenlabsTtsModels, options.elevenlabsTtsModel),
    minimaxModels: selectModels(options.minimaxTtsModels, options.minimaxTtsModel),
    groqModels: selectModels(options.groqTtsModels, options.groqTtsModel),
    grokModels: selectModels(options.grokTtsModels, options.grokTtsModel),
    mistralModels: selectModels(options.mistralTtsModels, options.mistralTtsModel),
    openaiModels: selectModels(options.openaiTtsModels, options.openaiTtsModel),
    geminiModels: selectModels(options.geminiTtsModels, options.geminiTtsModel),
    deepgramModels: selectModels(options.deepgramTtsModels, options.deepgramTtsModel),
    speechifyModels: selectModels(options.speechifyTtsModels, options.speechifyTtsModel),
    humeModels: selectModels(options.humeTtsModels, options.humeTtsModel),
    cartesiaModels: selectModels(options.cartesiaTtsModels, options.cartesiaTtsModel),
    geminiMultiSpeakerConfig: resolveGeminiMultiSpeakerConfig(options),
    speakerVoiceRegistry,
    multiSpeakerRequested: multiSpeaker,
    minimaxVoiceId: trimmed(options.minimaxTtsVoice),
    minimaxLanguageBoost: trimmed(options.minimaxTtsLanguageBoost),
    minimaxSpeed: options.minimaxTtsSpeed,
    minimaxVolume: options.minimaxTtsVolume,
    minimaxPitch: options.minimaxTtsPitch,
    minimaxEmotion: trimmed(options.minimaxTtsEmotion),
    minimaxEnglishNormalization: options.minimaxTtsEnglishNormalization === true,
    minimaxPronunciations: options.minimaxTtsPronunciations?.map((item) => item.trim()).filter(Boolean),
    openaiCloneRefAudioPath,
    openaiCloneConsentId,
    openaiCloneConsentAudioPath,
    openaiCloneConsentLanguage,
    openaiCloneConsentName,
    openaiCloneVoiceName,
    openaiVoiceId: trimmed(options.openaiVoiceId),
    openaiInstructions: trimmed(options.openaiTtsInstructions),
    openaiSpeed: options.openaiTtsSpeed,
    deepgramEncoding: trimmed(options.deepgramTtsEncoding),
    deepgramContainer: trimmed(options.deepgramTtsContainer),
    deepgramBitRate: options.deepgramTtsBitRate,
    deepgramSampleRate: options.deepgramTtsSampleRate,
    deepgramSpeed: options.deepgramTtsSpeed,
    elevenLabsCloneRefAudioPath,
    elevenLabsCloneVoiceName,
    elevenLabsCloneRemoveBackgroundNoise: options.elevenlabsTtsCloneRemoveBackgroundNoise === true,
    elevenLabsVoiceId: trimmed(options.elevenlabsVoiceId),
    elevenLabsOutputFormat: trimmed(options.elevenlabsTtsOutputFormat),
    elevenLabsLanguageCode: trimmed(options.elevenlabsTtsLanguageCode),
    elevenLabsStability: options.elevenlabsTtsStability,
    elevenLabsSimilarityBoost: options.elevenlabsTtsSimilarityBoost,
    elevenLabsStyle: options.elevenlabsTtsStyle,
    elevenLabsUseSpeakerBoost: options.elevenlabsTtsUseSpeakerBoost === true,
    elevenLabsSpeed: options.elevenlabsTtsSpeed,
    elevenLabsSeed: options.elevenlabsTtsSeed,
    elevenLabsTextNormalization: trimmed(options.elevenlabsTtsTextNormalization),
    elevenLabsPronunciationDictionaryLocators,
    elevenLabsOptimizeStreamingLatency: options.elevenlabsTtsOptimizeStreamingLatency,
    speechifyCustomVoiceRefAudioPath,
    speechifyCustomVoiceName,
    speechifyCustomVoiceConsentName,
    speechifyCustomVoiceConsentEmail,
    speechifyCustomVoiceLocale,
    speechifyCustomVoiceGender,
    speechifyVoiceId: trimmed(options.speechifyVoice),
    speechifyAudioFormat: trimmed(options.speechifyTtsAudioFormat),
    speechifyLanguage: trimmed(options.speechifyTtsLanguage),
    humeVoice: trimmed(options.humeTtsVoice),
    humeVoiceProvider: trimmed(options.humeTtsVoiceProvider),
    cartesiaVoiceId: trimmed(options.cartesiaTtsVoice),
    cartesiaLanguage: trimmed(options.cartesiaTtsLanguage),
    groqVoiceId: trimmed(options.groqVoiceId),
    grokVoiceId: trimmed(options.grokTtsVoice),
    grokLanguage: trimmed(options.grokTtsLanguage),
    grokTextNormalization: options.grokTtsTextNormalization === true,
    mistralVoiceId: trimmed(options.mistralTtsVoice),
    mistralRefAudioPath: trimmed(options.mistralTtsRefAudio),
    mistralVoiceName: trimmed(options.mistralTtsVoiceName),
    geminiVoiceId: trimmed(options.geminiVoiceId),
    deepgramVoiceId: trimmed(options.deepgramVoiceId),
    hasOpenAICloneFlags,
    hasElevenLabsCloneFlags,
    hasSpeechifyCustomVoiceFlags,
    hasElevenLabsVoiceNameOnly,
    dialogueRequested: multiSpeaker
  }
}
