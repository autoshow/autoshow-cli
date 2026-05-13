import type { GeminiMultiSpeakerConfig, TtsOptions } from '~/types'
import { isDialogueTtsRequested } from '../dialogue-normalizer'
import { isElevenLabsTtsPvcSetupRequested } from '../tts-services/elevenlabs/elevenlabs-pvc'
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
  runwayModels: string[]
  speechifyModels: string[]
  gcloudModels: string[]
  deapiModels: string[]
  geminiMultiSpeakerConfig: GeminiMultiSpeakerConfig | undefined
  minimaxCloneRefAudioPath: string | undefined
  minimaxClonePromptAudioPath: string | undefined
  minimaxClonePromptText: string | undefined
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
  elevenLabsPvcVoiceId: string | undefined
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
  elevenLabsPvcAsIvc: boolean
  elevenLabsPvcSamplePaths: string[] | undefined
  elevenLabsPvcSampleDir: string | undefined
  elevenLabsPvcLanguage: string | undefined
  elevenLabsPvcDescription: string | undefined
  elevenLabsPvcCaptchaOut: string | undefined
  elevenLabsPvcVerifyAudio: string | undefined
  elevenLabsPvcWait: boolean
  speechifyCustomVoiceRefAudioPath: string | undefined
  speechifyCustomVoiceName: string | undefined
  speechifyCustomVoiceConsentName: string | undefined
  speechifyCustomVoiceConsentEmail: string | undefined
  speechifyCustomVoiceLocale: string | undefined
  speechifyCustomVoiceGender: string | undefined
  speechifyVoiceId: string | undefined
  speechifyAudioFormat: string | undefined
  speechifyLanguage: string | undefined
  gcloudVoiceCloningKey: string | undefined
  gcloudRefAudioPath: string | undefined
  gcloudConsentAudioPath: string | undefined
  gcloudConsentLanguage: string | undefined
  gcloudVoiceCloningKeyOut: string | undefined
  gcloudVoiceId: string | undefined
  gcloudLanguage: string | undefined
  groqVoiceId: string | undefined
  grokVoiceId: string | undefined
  grokLanguage: string | undefined
  grokTextNormalization: boolean
  mistralVoiceId: string | undefined
  mistralRefAudioPath: string | undefined
  mistralVoiceName: string | undefined
  geminiVoiceId: string | undefined
  deepgramVoiceId: string | undefined
  runwayVoiceId: string | undefined
  deapiVoiceId: string | undefined
  deapiRefAudioPath: string | undefined
  deapiRefText: string | undefined
  deapiLanguage: string | undefined
  deapiSpeed: number | undefined
  deapiFormat: string | undefined
  deapiSampleRate: number | undefined
  deapiInstruction: string | undefined
  hasElevenLabsPvcActionFlags: boolean
  hasElevenLabsPvcSetupFlags: boolean
  hasMinimaxCloneFlags: boolean
  hasOpenAICloneFlags: boolean
  hasElevenLabsCloneFlags: boolean
  hasSpeechifyCustomVoiceFlags: boolean
  hasGcloudIcvFlags: boolean
  hasElevenLabsVoiceNameOnly: boolean
  dialogueRequested: boolean
}

const selectModels = (
  models: string[] | undefined,
  model: string | undefined
): string[] => models ?? (model ? [model] : [])

const trimmed = (value: string | undefined): string | undefined => value?.trim() || undefined

export const createTtsTargetSelection = (options: TtsOptions): TtsTargetSelection => {
  const minimaxCloneRefAudioPath = trimmed(options.minimaxTtsRefAudio)
  const minimaxClonePromptAudioPath = trimmed(options.minimaxTtsPromptAudio)
  const minimaxClonePromptText = trimmed(options.minimaxTtsPromptText)
  const openaiCloneRefAudioPath = trimmed(options.openaiTtsRefAudio)
  const openaiCloneConsentId = trimmed(options.openaiTtsConsentId)
  const openaiCloneConsentAudioPath = trimmed(options.openaiTtsConsentAudio)
  const openaiCloneConsentLanguage = trimmed(options.openaiTtsConsentLanguage)
  const openaiCloneConsentName = trimmed(options.openaiTtsConsentName)
  const openaiCloneVoiceName = trimmed(options.openaiTtsVoiceName)
  const elevenLabsCloneRefAudioPath = trimmed(options.elevenlabsTtsRefAudio)
  const elevenLabsCloneVoiceName = trimmed(options.elevenlabsTtsVoiceName)
  const elevenLabsPvcVoiceId = trimmed(options.elevenlabsTtsPvcVoice)
  const elevenLabsPvcSamplePaths = options.elevenlabsTtsPvcSamples?.map((item) => item.trim()).filter(Boolean)
  const elevenLabsPvcSampleDir = trimmed(options.elevenlabsTtsPvcSampleDir)
  const elevenLabsPvcLanguage = trimmed(options.elevenlabsTtsPvcLanguage)
  const elevenLabsPvcDescription = trimmed(options.elevenlabsTtsPvcDescription)
  const elevenLabsPvcCaptchaOut = trimmed(options.elevenlabsTtsPvcCaptchaOut)
  const elevenLabsPvcVerifyAudio = trimmed(options.elevenlabsTtsPvcVerifyAudio)
  const elevenLabsPronunciationDictionaryLocators = options.elevenlabsTtsPronunciationDictionaryLocators?.map((item) => item.trim()).filter(Boolean)
  const speechifyCustomVoiceRefAudioPath = trimmed(options.speechifyTtsRefAudio)
  const speechifyCustomVoiceName = trimmed(options.speechifyTtsVoiceName)
  const speechifyCustomVoiceConsentName = trimmed(options.speechifyTtsConsentName)
  const speechifyCustomVoiceConsentEmail = trimmed(options.speechifyTtsConsentEmail)
  const speechifyCustomVoiceLocale = trimmed(options.speechifyTtsVoiceLocale)
  const speechifyCustomVoiceGender = trimmed(options.speechifyTtsVoiceGender)
  const gcloudVoiceCloningKey = trimmed(options.gcloudTtsVoiceCloningKey)
  const gcloudRefAudioPath = trimmed(options.gcloudTtsRefAudio)
  const gcloudConsentAudioPath = trimmed(options.gcloudTtsConsentAudio)
  const gcloudConsentLanguage = trimmed(options.gcloudTtsConsentLanguage)
  const gcloudVoiceCloningKeyOut = trimmed(options.gcloudTtsVoiceCloningKeyOut)
  const hasElevenLabsPvcActionFlags = isElevenLabsTtsPvcSetupRequested(options)
  const hasElevenLabsPvcSetupFlags = Boolean(
    hasElevenLabsPvcActionFlags
    || elevenLabsPvcLanguage
    || elevenLabsPvcDescription
  )
  const hasMinimaxCloneFlags = Boolean(
    minimaxCloneRefAudioPath
    || minimaxClonePromptAudioPath
    || minimaxClonePromptText
    || options.minimaxTtsCloneNoiseReduction
    || options.minimaxTtsCloneVolumeNormalization
  )
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
  const hasGcloudIcvFlags = Boolean(
    gcloudVoiceCloningKey
    || gcloudRefAudioPath
    || gcloudConsentAudioPath
    || gcloudConsentLanguage
    || gcloudVoiceCloningKeyOut
  )
  const hasElevenLabsVoiceNameOnly = Boolean(
    elevenLabsCloneVoiceName
    && !hasElevenLabsCloneFlags
    && !hasElevenLabsPvcActionFlags
  )

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
    runwayModels: selectModels(options.runwayTtsModels, options.runwayTtsModel),
    speechifyModels: selectModels(options.speechifyTtsModels, options.speechifyTtsModel),
    gcloudModels: selectModels(options.gcloudTtsModels, options.gcloudTtsModel),
    deapiModels: selectModels(options.deapiTtsModels, options.deapiTtsModel),
    geminiMultiSpeakerConfig: resolveGeminiMultiSpeakerConfig(options),
    minimaxCloneRefAudioPath,
    minimaxClonePromptAudioPath,
    minimaxClonePromptText,
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
    elevenLabsPvcVoiceId,
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
    elevenLabsPvcAsIvc: options.elevenlabsTtsPvcAsIvc === true,
    elevenLabsPvcSamplePaths,
    elevenLabsPvcSampleDir,
    elevenLabsPvcLanguage,
    elevenLabsPvcDescription,
    elevenLabsPvcCaptchaOut,
    elevenLabsPvcVerifyAudio,
    elevenLabsPvcWait: options.elevenlabsTtsPvcWait === true,
    speechifyCustomVoiceRefAudioPath,
    speechifyCustomVoiceName,
    speechifyCustomVoiceConsentName,
    speechifyCustomVoiceConsentEmail,
    speechifyCustomVoiceLocale,
    speechifyCustomVoiceGender,
    speechifyVoiceId: trimmed(options.speechifyVoice),
    speechifyAudioFormat: trimmed(options.speechifyTtsAudioFormat),
    speechifyLanguage: trimmed(options.speechifyTtsLanguage),
    gcloudVoiceCloningKey,
    gcloudRefAudioPath,
    gcloudConsentAudioPath,
    gcloudConsentLanguage,
    gcloudVoiceCloningKeyOut,
    gcloudVoiceId: trimmed(options.gcloudTtsVoice),
    gcloudLanguage: trimmed(options.gcloudTtsLanguage),
    groqVoiceId: trimmed(options.groqVoiceId),
    grokVoiceId: trimmed(options.grokTtsVoice),
    grokLanguage: trimmed(options.grokTtsLanguage),
    grokTextNormalization: options.grokTtsTextNormalization === true,
    mistralVoiceId: trimmed(options.mistralTtsVoice),
    mistralRefAudioPath: trimmed(options.mistralTtsRefAudio),
    mistralVoiceName: trimmed(options.mistralTtsVoiceName),
    geminiVoiceId: trimmed(options.geminiVoiceId),
    deepgramVoiceId: trimmed(options.deepgramVoiceId),
    runwayVoiceId: trimmed(options.runwayTtsVoice),
    deapiVoiceId: trimmed(options.deapiTtsVoice),
    deapiRefAudioPath: trimmed(options.deapiTtsRefAudio),
    deapiRefText: trimmed(options.deapiTtsRefText),
    deapiLanguage: trimmed(options.deapiTtsLanguage),
    deapiSpeed: options.deapiTtsSpeed,
    deapiFormat: trimmed(options.deapiTtsFormat),
    deapiSampleRate: options.deapiTtsSampleRate,
    deapiInstruction: trimmed(options.deapiTtsInstruction),
    hasElevenLabsPvcActionFlags,
    hasElevenLabsPvcSetupFlags,
    hasMinimaxCloneFlags,
    hasOpenAICloneFlags,
    hasElevenLabsCloneFlags,
    hasSpeechifyCustomVoiceFlags,
    hasGcloudIcvFlags,
    hasElevenLabsVoiceNameOnly,
    dialogueRequested: isDialogueTtsRequested(options)
  }
}
