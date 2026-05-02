import { basename } from 'node:path'
import type { Step4Metadata, TtsOptions, TtsTarget } from '~/types'
import type {
  ElevenlabsTtsModel,
  GeminiTtsModel,
  GroqTtsModel,
  KittenTtsModel,
  MistralTtsModel,
  MinimaxTtsModel,
  OpenAITtsModel,
  DeepgramTtsModel,
  DeapiTtsModel,
  GrokTtsModel,
  RunwayTtsModel,
  SpeechifyTtsModel,
  GcloudTtsModel
} from '~/types'
import {
  validateKittenTtsModel,
  validateElevenlabsTtsModel,
  validateMinimaxTtsModel,
  validateGroqTtsModel,
  validateGrokTtsModel,
  validateMistralTtsModel,
  validateOpenAITtsModel,
  validateGeminiTtsModel,
  validateDeapiTtsModel,
  validateRunwayTtsModel,
  validateRunwayTtsVoice,
  validateDeepgramTtsModel,
  validateDeepgramTtsVoice,
  validateGroqTtsVoice,
  validateGrokTtsVoice,
  validateKittenTtsSpeaker,
  validateSpeechifyTtsModel,
  validateSpeechifyTtsVoice,
  validateGcloudTtsModel,
  validateGcloudTtsVoice,
  GCLOUD_DEFAULT_TTS_VOICES,
} from '~/cli/commands/setup-and-utilities/models/model-options'
import { pathExists, kittenTtsUvEnvDir } from '~/cli/commands/setup-and-utilities/setup/run-complete-setup'
import { ensureKittenTtsSetup } from '~/cli/commands/process-steps/step-4-tts/tts-local/kitten/kitten-tts'
import { ensureElevenLabsTtsSetup } from '~/cli/commands/process-steps/step-4-tts/tts-services/elevenlabs/elevenlabs-tts'
import { ensureGroqTtsSetup } from '~/cli/commands/process-steps/step-4-tts/tts-services/groq/groq-tts'
import { ensureGrokTtsSetup } from '~/cli/commands/process-steps/step-4-tts/tts-services/grok/grok-tts'
import { ensureOpenAITtsSetup } from '~/cli/commands/process-steps/step-4-tts/tts-services/openai/openai-tts'
import { ensureGeminiTtsSetup } from '~/cli/commands/process-steps/step-4-tts/tts-services/gemini/gemini-tts'
import { ensureDeepgramTtsSetup } from '~/cli/commands/process-steps/step-4-tts/tts-services/deepgram/deepgram-tts'
import { ensureRunwayTtsSetup } from '~/cli/commands/process-steps/step-4-tts/tts-services/runway/runway-tts'
import { ensureSpeechifyTtsSetup } from '~/cli/commands/process-steps/step-4-tts/tts-services/speechify/speechify-tts'
import { runKittenTts } from './tts-local/kitten/run-kitten-tts'
import { runElevenLabsTts } from './tts-services/elevenlabs/run-elevenlabs-tts'
import {
  createElevenLabsTtsIvcContext,
  ELEVENLABS_TTS_IVC_COST_CENTS,
  ELEVENLABS_TTS_IVC_SETUP_MS,
  ELEVENLABS_TTS_IVC_SETUP_NOTE
} from './tts-services/elevenlabs/elevenlabs-ivc'
import {
  ELEVENLABS_TTS_PVC_COST_CENTS,
  ELEVENLABS_TTS_PVC_SETUP_NOTE,
  getElevenLabsTtsPvcSetupMs,
  isElevenLabsTtsPvcSetupRequested
} from './tts-services/elevenlabs/elevenlabs-pvc'
import {
  createMinimaxTtsCloneContext,
  MINIMAX_TTS_CLONE_COST_CENTS,
  MINIMAX_TTS_CLONE_SETUP_MS,
  runMinimaxTts,
  validateMinimaxTtsCloneVoiceId
} from './tts-services/minimax/run-minimax-tts'
import { runGroqTts } from './tts-services/groq/run-groq-tts'
import { runGrokTts } from './tts-services/grok/run-grok-tts'
import { runMistralTts } from './tts-services/mistral/run-mistral-tts'
import { runOpenAITts } from './tts-services/openai/run-openai-tts'
import {
  createOpenAITtsCustomVoiceContext,
  OPENAI_TTS_CLONE_COST_CENTS,
  OPENAI_TTS_CLONE_SETUP_MS,
  OPENAI_TTS_CLONE_SETUP_NOTE
} from './tts-services/openai/openai-custom-voices'
import { runGeminiTts } from './tts-services/gemini/run-gemini-tts'
import { runDeepgramTts } from './tts-services/deepgram/run-deepgram-tts'
import { runRunwayTts } from './tts-services/runway/run-runway-tts'
import { runSpeechifyTts } from './tts-services/speechify/run-speechify-tts'
import {
  createSpeechifyTtsCustomVoiceContext,
  SPEECHIFY_TTS_CUSTOM_VOICE_COST_CENTS,
  SPEECHIFY_TTS_CUSTOM_VOICE_SETUP_MS,
  SPEECHIFY_TTS_CUSTOM_VOICE_SETUP_NOTE,
  validateSpeechifyTtsCustomVoiceGender
} from './tts-services/speechify/speechify-custom-voices'
import { runGcloudTts } from './tts-services/gcloud/run-gcloud-tts'
import { DEAPI_TTS_VOICE_CLONE_MODEL, runDeapiTts } from './tts-services/deapi/run-deapi-tts'
import {
  formatGeminiSpeakerSummary,
  resolveGeminiMultiSpeakerConfig,
  validateGeminiMultiSpeakerTranscript
} from './tts-services/gemini/gemini-tts-config'
import {
  isDialogueTtsRequested,
  parseSpeakerRefAudioMappings,
  resolveDialogueFormat
} from './dialogue-normalizer'
import { buildSingleArtifactMap, getSingleFileArtifactName } from '~/cli/commands/process-steps/target-runner'
import * as l from '~/utils/logger'

const KITTEN_PYTHON_VERSION = '3.12'

export const DEFAULT_KITTEN_TTS_SPEAKER = 'Jasper'
const checkKittenTtsSetup = async (): Promise<boolean> => {
  if (!await pathExists(kittenTtsUvEnvDir)) {
    return false
  }
  if (!await pathExists(`${kittenTtsUvEnvDir}/bin/python`)) {
    return false
  }
  const required = [
    `${kittenTtsUvEnvDir}/lib/python${KITTEN_PYTHON_VERSION}/site-packages/kittentts`,
    `${kittenTtsUvEnvDir}/lib/python${KITTEN_PYTHON_VERSION}/site-packages/soundfile.py`
  ]
  for (const path of required) {
    if (!await pathExists(path)) {
      return false
    }
  }
  return true
}

const ensureKittenSetup = async (): Promise<void> => {
  l.write('info', 'Checking Kitten TTS setup')
  const isSetup = await checkKittenTtsSetup()
  if (!isSetup) {
    l.write('info', 'Kitten TTS not set up; running setup')
    await ensureKittenTtsSetup()
  } else {
    l.write('success', 'Kitten TTS setup verified')
  }
}

const toTtsArtifactTarget = (
  target: Pick<TtsTarget, 'service' | 'model'> | Pick<Step4Metadata, 'ttsService' | 'ttsModel'>
): { service: string, model: string } =>
  'service' in target
    ? target
    : { service: target.ttsService, model: target.ttsModel }

export const getTtsArtifactFileName = (
  target: Pick<TtsTarget, 'service' | 'model'> | Pick<Step4Metadata, 'ttsService' | 'ttsModel'>,
  singleTarget: boolean
): string => {
  return getSingleFileArtifactName(toTtsArtifactTarget(target), singleTarget, {
    singleFileName: 'speech.wav',
    multiFilePrefix: 'speech',
    extension: 'wav'
  })
}

export const buildTtsArtifactMap = (
  metadata: Step4Metadata[],
  singleKey = 'speech'
): Record<string, string> =>
  buildSingleArtifactMap(metadata, {
    singleKey,
    multiKeyPrefix: 'speech',
    getService: (entry) => entry.ttsService,
    getModel: (entry) => entry.ttsModel,
    getFileName: (entry) => entry.audioFileName
  })

export const buildEstimatedTtsTargets = (
  targets: TtsTarget[]
): Array<{ service: Step4Metadata['ttsService'], model: string, setupCostCents?: number, setupTimeMs?: number, setupNote?: string }> =>
  targets.map((target) => ({
    service: target.service,
    model: target.model,
    ...(typeof target.setupCostCents === 'number' ? { setupCostCents: target.setupCostCents } : {}),
    ...(typeof target.setupTimeMs === 'number' ? { setupTimeMs: target.setupTimeMs } : {}),
    ...(typeof target.setupNote === 'string' ? { setupNote: target.setupNote } : {})
  }))

export const validateTtsInput = (text: string, options: TtsOptions): void => {
  const geminiModels = options.geminiTtsModels ?? (options.geminiTtsModel ? [options.geminiTtsModel] : [])
  if (geminiModels.length === 0) {
    return
  }

  const geminiMultiSpeakerConfig = resolveGeminiMultiSpeakerConfig(options)
  if (geminiMultiSpeakerConfig) {
    validateGeminiMultiSpeakerTranscript(text, geminiMultiSpeakerConfig)
  }
}

export const collectTtsTargets = (options: TtsOptions): TtsTarget[] => {
  const targets: TtsTarget[] = []
  const kittenModels = options.kittenTtsModels ?? (options.kittenTtsModel ? [options.kittenTtsModel] : [])
  const elevenlabsModels = options.elevenlabsTtsModels ?? (options.elevenlabsTtsModel ? [options.elevenlabsTtsModel] : [])
  const minimaxModels = options.minimaxTtsModels ?? (options.minimaxTtsModel ? [options.minimaxTtsModel] : [])
  const groqModels = options.groqTtsModels ?? (options.groqTtsModel ? [options.groqTtsModel] : [])
  const grokModels = options.grokTtsModels ?? (options.grokTtsModel ? [options.grokTtsModel] : [])
  const mistralModels = options.mistralTtsModels ?? (options.mistralTtsModel ? [options.mistralTtsModel] : [])
  const openaiModels = options.openaiTtsModels ?? (options.openaiTtsModel ? [options.openaiTtsModel] : [])
  const geminiModels = options.geminiTtsModels ?? (options.geminiTtsModel ? [options.geminiTtsModel] : [])
  const deepgramModels = options.deepgramTtsModels ?? (options.deepgramTtsModel ? [options.deepgramTtsModel] : [])
  const runwayModels = options.runwayTtsModels ?? (options.runwayTtsModel ? [options.runwayTtsModel] : [])
  const speechifyModels = options.speechifyTtsModels ?? (options.speechifyTtsModel ? [options.speechifyTtsModel] : [])
  const gcloudModels = options.gcloudTtsModels ?? (options.gcloudTtsModel ? [options.gcloudTtsModel] : [])
  const deapiModels = options.deapiTtsModels ?? (options.deapiTtsModel ? [options.deapiTtsModel] : [])
  const geminiMultiSpeakerConfig = resolveGeminiMultiSpeakerConfig(options)
  const minimaxCloneRefAudioPath = options.minimaxTtsRefAudio?.trim() || undefined
  const minimaxClonePromptAudioPath = options.minimaxTtsPromptAudio?.trim() || undefined
  const minimaxClonePromptText = options.minimaxTtsPromptText?.trim() || undefined
  const openaiCloneRefAudioPath = options.openaiTtsRefAudio?.trim() || undefined
  const openaiCloneConsentId = options.openaiTtsConsentId?.trim() || undefined
  const openaiCloneConsentAudioPath = options.openaiTtsConsentAudio?.trim() || undefined
  const openaiCloneConsentLanguage = options.openaiTtsConsentLanguage?.trim() || undefined
  const openaiCloneConsentName = options.openaiTtsConsentName?.trim() || undefined
  const openaiCloneVoiceName = options.openaiTtsVoiceName?.trim() || undefined
  const elevenLabsCloneRefAudioPath = options.elevenlabsTtsRefAudio?.trim() || undefined
  const elevenLabsCloneVoiceName = options.elevenlabsTtsVoiceName?.trim() || undefined
  const elevenLabsPvcVoiceId = options.elevenlabsTtsPvcVoice?.trim() || undefined
  const elevenLabsPvcSamplePaths = options.elevenlabsTtsPvcSamples?.map((item) => item.trim()).filter(Boolean)
  const elevenLabsPvcSampleDir = options.elevenlabsTtsPvcSampleDir?.trim() || undefined
  const elevenLabsPvcLanguage = options.elevenlabsTtsPvcLanguage?.trim() || undefined
  const elevenLabsPvcDescription = options.elevenlabsTtsPvcDescription?.trim() || undefined
  const elevenLabsPvcCaptchaOut = options.elevenlabsTtsPvcCaptchaOut?.trim() || undefined
  const elevenLabsPvcVerifyAudio = options.elevenlabsTtsPvcVerifyAudio?.trim() || undefined
  const speechifyCustomVoiceRefAudioPath = options.speechifyTtsRefAudio?.trim() || undefined
  const speechifyCustomVoiceName = options.speechifyTtsVoiceName?.trim() || undefined
  const speechifyCustomVoiceConsentName = options.speechifyTtsConsentName?.trim() || undefined
  const speechifyCustomVoiceConsentEmail = options.speechifyTtsConsentEmail?.trim() || undefined
  const speechifyCustomVoiceLocale = options.speechifyTtsVoiceLocale?.trim() || undefined
  const speechifyCustomVoiceGender = options.speechifyTtsVoiceGender?.trim() || undefined
  const gcloudVoiceCloningKey = options.gcloudTtsVoiceCloningKey?.trim() || undefined
  const gcloudRefAudioPath = options.gcloudTtsRefAudio?.trim() || undefined
  const gcloudConsentAudioPath = options.gcloudTtsConsentAudio?.trim() || undefined
  const gcloudConsentLanguage = options.gcloudTtsConsentLanguage?.trim() || undefined
  const gcloudVoiceCloningKeyOut = options.gcloudTtsVoiceCloningKeyOut?.trim() || undefined
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
  const dialogueRequested = isDialogueTtsRequested(options)

  if (dialogueRequested) {
    resolveDialogueFormat(options)
    const speakerRegistry = parseSpeakerRefAudioMappings(options.ttsSpeakerRefAudios)
    if (speakerRegistry.entries.length === 0) {
      throw new Error('Dialogue TTS requires at least one --tts-speaker-ref-audio SPEAKER=path mapping.')
    }
    if (mistralModels.length !== 1) {
      throw new Error('Dialogue TTS requires exactly one --mistral-tts <model> selection.')
    }
    const nonMistralModelCount = [
      kittenModels,
      elevenlabsModels,
      minimaxModels,
      groqModels,
      grokModels,
      openaiModels,
      geminiModels,
      deepgramModels,
      runwayModels,
      speechifyModels,
      gcloudModels,
      deapiModels
    ].reduce((sum, models) => sum + (models?.length ?? 0), 0)
    if (nonMistralModelCount > 0) {
      throw new Error('Dialogue TTS v1 supports exactly one Mistral TTS model and cannot be combined with other TTS providers.')
    }
    if (options.mistralTtsVoice?.trim() || options.mistralTtsRefAudio?.trim()) {
      throw new Error('Dialogue TTS uses --tts-speaker-ref-audio mappings; do not combine it with --mistral-tts-voice or --mistral-tts-ref-audio.')
    }
  }

  if (hasMinimaxCloneFlags && minimaxModels.length === 0) {
    throw new Error('MiniMax TTS clone flags require --minimax-tts <model> or --all-tts.')
  }
  if (
    (minimaxClonePromptAudioPath
      || minimaxClonePromptText
      || options.minimaxTtsCloneNoiseReduction
      || options.minimaxTtsCloneVolumeNormalization)
    && !minimaxCloneRefAudioPath
  ) {
    throw new Error('MiniMax TTS clone option requires --minimax-tts-ref-audio.')
  }
  if (minimaxClonePromptAudioPath && !minimaxClonePromptText) {
    throw new Error('MiniMax TTS --minimax-tts-prompt-audio requires --minimax-tts-prompt-text.')
  }
  if (minimaxClonePromptText && !minimaxClonePromptAudioPath) {
    throw new Error('MiniMax TTS --minimax-tts-prompt-text requires --minimax-tts-prompt-audio.')
  }

  if (hasOpenAICloneFlags && openaiModels.length === 0) {
    throw new Error('OpenAI TTS custom voice flags require --openai-tts <model> or --all-tts.')
  }
  if (hasOpenAICloneFlags && !openaiCloneRefAudioPath) {
    throw new Error('OpenAI TTS custom voice creation requires --openai-tts-ref-audio.')
  }
  if (hasOpenAICloneFlags) {
    const consentSourceCount = (openaiCloneConsentId ? 1 : 0) + (openaiCloneConsentAudioPath ? 1 : 0)
    if (consentSourceCount !== 1) {
      throw new Error('OpenAI TTS custom voice creation requires exactly one of --openai-tts-consent-id or --openai-tts-consent-audio.')
    }
    if (options.openaiVoiceId?.trim()) {
      throw new Error('OpenAI TTS custom voice creation cannot be combined with --openai-voice. Use --openai-tts-voice-name for the created voice label.')
    }
  }

  if (hasElevenLabsCloneFlags && elevenlabsModels.length === 0) {
    throw new Error('ElevenLabs TTS IVC flags require --elevenlabs-tts <model> or --all-tts.')
  }
  if (hasElevenLabsCloneFlags && !elevenLabsCloneRefAudioPath) {
    throw new Error('ElevenLabs TTS IVC creation requires --elevenlabs-tts-ref-audio.')
  }
  if (hasElevenLabsCloneFlags && options.elevenlabsVoiceId?.trim()) {
    throw new Error('ElevenLabs TTS IVC creation cannot be combined with --elevenlabs-voice. Use --elevenlabs-tts-voice-name for the created voice label.')
  }
  if (hasElevenLabsVoiceNameOnly) {
    throw new Error('ElevenLabs TTS --elevenlabs-tts-voice-name requires --elevenlabs-tts-ref-audio for IVC or an ElevenLabs PVC setup flag.')
  }

  if (hasSpeechifyCustomVoiceFlags && speechifyModels.length === 0) {
    throw new Error('Speechify TTS custom voice flags require --speechify-tts <model> or --all-tts.')
  }
  if (hasSpeechifyCustomVoiceFlags && !speechifyCustomVoiceRefAudioPath) {
    throw new Error('Speechify TTS custom voice creation requires --speechify-tts-ref-audio.')
  }
  if (hasSpeechifyCustomVoiceFlags && options.speechifyVoice?.trim()) {
    throw new Error('Speechify TTS custom voice creation cannot be combined with --speechify-voice. Use --speechify-tts-voice-name for the created voice label.')
  }
  if (speechifyCustomVoiceRefAudioPath && !speechifyCustomVoiceConsentName) {
    throw new Error('Speechify TTS custom voice creation requires --speechify-tts-consent-name.')
  }
  if (speechifyCustomVoiceRefAudioPath && !speechifyCustomVoiceConsentEmail) {
    throw new Error('Speechify TTS custom voice creation requires --speechify-tts-consent-email.')
  }
  if (speechifyCustomVoiceGender) {
    validateSpeechifyTtsCustomVoiceGender(speechifyCustomVoiceGender)
  }

  if (hasGcloudIcvFlags && gcloudModels.length === 0) {
    throw new Error('Google Cloud TTS instant custom voice flags require --gcloud-tts instant-custom-voice.')
  }
  if (hasGcloudIcvFlags && !gcloudModels.includes('instant-custom-voice')) {
    throw new Error('Google Cloud TTS instant custom voice flags require --gcloud-tts instant-custom-voice.')
  }
  if ((gcloudRefAudioPath || gcloudConsentAudioPath || gcloudConsentLanguage || gcloudVoiceCloningKeyOut) && gcloudVoiceCloningKey) {
    throw new Error('Google Cloud TTS --gcloud-tts-voice-cloning-key cannot be combined with key generation flags.')
  }
  if ((gcloudRefAudioPath || gcloudConsentAudioPath || gcloudConsentLanguage || gcloudVoiceCloningKeyOut) && (!gcloudRefAudioPath || !gcloudConsentAudioPath)) {
    throw new Error('Google Cloud TTS instant custom voice key generation requires both --gcloud-tts-ref-audio and --gcloud-tts-consent-audio.')
  }

  if (hasElevenLabsPvcSetupFlags && elevenlabsModels.length === 0) {
    throw new Error('ElevenLabs TTS PVC setup flags require --elevenlabs-tts <model> or --all-tts.')
  }
  if (elevenLabsPvcVoiceId && options.elevenlabsVoiceId?.trim()) {
    throw new Error('ElevenLabs TTS PVC voice cannot be combined with --elevenlabs-voice.')
  }
  if (elevenLabsPvcVoiceId && hasElevenLabsCloneFlags) {
    throw new Error('ElevenLabs TTS PVC voice cannot be combined with ElevenLabs IVC flags.')
  }
  if (hasElevenLabsPvcSetupFlags && hasElevenLabsCloneFlags) {
    throw new Error('ElevenLabs TTS PVC setup flags cannot be combined with ElevenLabs IVC flags.')
  }
  if (hasElevenLabsPvcSetupFlags && options.elevenlabsVoiceId?.trim()) {
    throw new Error('ElevenLabs TTS PVC setup cannot be combined with --elevenlabs-voice.')
  }
  if ((elevenLabsPvcLanguage || elevenLabsPvcDescription || (elevenLabsCloneVoiceName && hasElevenLabsPvcActionFlags)) && !elevenLabsPvcSampleDir && (!elevenLabsPvcSamplePaths || elevenLabsPvcSamplePaths.length === 0)) {
    throw new Error('ElevenLabs TTS PVC voice metadata requires --elevenlabs-tts-pvc-sample or --elevenlabs-tts-pvc-sample-dir.')
  }
  if (elevenLabsPvcCaptchaOut && !elevenLabsPvcVoiceId && !elevenLabsPvcSampleDir && (!elevenLabsPvcSamplePaths || elevenLabsPvcSamplePaths.length === 0)) {
    throw new Error('ElevenLabs TTS PVC captcha output requires --elevenlabs-tts-pvc-voice or PVC samples that create a voice.')
  }
  if (elevenLabsPvcVerifyAudio && !elevenLabsPvcVoiceId && (!elevenLabsPvcSamplePaths || elevenLabsPvcSamplePaths.length === 0) && !elevenLabsPvcSampleDir) {
    throw new Error('ElevenLabs TTS PVC verification requires --elevenlabs-tts-pvc-voice or PVC samples that create a voice.')
  }
  if (options.elevenlabsTtsPvcWait === true && !elevenLabsPvcVoiceId && !hasElevenLabsPvcActionFlags) {
    throw new Error('ElevenLabs TTS PVC wait requires --elevenlabs-tts-pvc-voice or PVC setup flags.')
  }
  if (options.elevenlabsTtsPvcWait === true && hasElevenLabsPvcActionFlags && elevenlabsModels.length > 1) {
    throw new Error('ElevenLabs TTS PVC setup with --elevenlabs-tts-pvc-wait supports one ElevenLabs model per run.')
  }

  const minimaxCloneContext = minimaxCloneRefAudioPath ? createMinimaxTtsCloneContext() : undefined
  const openaiCloneContext = openaiCloneRefAudioPath ? createOpenAITtsCustomVoiceContext() : undefined
  const elevenLabsCloneContext = elevenLabsCloneRefAudioPath ? createElevenLabsTtsIvcContext() : undefined
  const speechifyCustomVoiceContext = speechifyCustomVoiceRefAudioPath ? createSpeechifyTtsCustomVoiceContext() : undefined
  let minimaxCloneEstimateAttached = false
  let openaiCloneEstimateAttached = false
  let elevenLabsCloneEstimateAttached = false
  let elevenLabsPvcEstimateAttached = false
  let speechifyCustomVoiceEstimateAttached = false

  for (const rawModel of kittenModels) {
    const model: KittenTtsModel = validateKittenTtsModel(rawModel)
    const rawSpeaker = options.ttsSpeaker ?? DEFAULT_KITTEN_TTS_SPEAKER
    const speaker = validateKittenTtsSpeaker(rawSpeaker)

    targets.push({
      service: 'kitten',
      model,
      voice: speaker,
      run: async (text, outputDir) => {
        await ensureKittenSetup()
        return await runKittenTts(text, outputDir, { model, speaker })
      }
    })
  }

  for (const rawModel of elevenlabsModels) {
    const model: ElevenlabsTtsModel = validateElevenlabsTtsModel(rawModel)
    const voiceId = options.elevenlabsVoiceId?.trim() || undefined
    const pvcVoiceId = elevenLabsPvcVoiceId
    const clone = elevenLabsCloneRefAudioPath
      ? {
          refAudioPath: elevenLabsCloneRefAudioPath,
          ...(elevenLabsCloneVoiceName ? { voiceName: elevenLabsCloneVoiceName } : {}),
          removeBackgroundNoise: options.elevenlabsTtsCloneRemoveBackgroundNoise === true,
          context: elevenLabsCloneContext
        }
      : undefined
    const attachCloneEstimate = clone !== undefined && !elevenLabsCloneEstimateAttached
    if (attachCloneEstimate) {
      elevenLabsCloneEstimateAttached = true
    }
    const attachPvcEstimate = !clone && (hasElevenLabsPvcSetupFlags || options.elevenlabsTtsPvcWait === true) && !elevenLabsPvcEstimateAttached
    if (attachPvcEstimate) {
      elevenLabsPvcEstimateAttached = true
    }
    const pvcSetupTimeMs = options.elevenlabsTtsPvcWait === true
      ? getElevenLabsTtsPvcSetupMs(elevenLabsPvcLanguage)
      : undefined

    targets.push({
      service: 'elevenlabs',
      model,
      ...(clone
        ? { voice: `ref_audio:${basename(clone.refAudioPath)}` }
        : pvcVoiceId
          ? { voice: `pvc:${pvcVoiceId}` }
          : hasElevenLabsPvcSetupFlags
            ? { voice: `pvc_setup:${elevenLabsCloneVoiceName ?? 'new'}` }
            : voiceId ? { voice: voiceId } : {}),
      ...(attachCloneEstimate
        ? {
            setupCostCents: ELEVENLABS_TTS_IVC_COST_CENTS,
            setupTimeMs: ELEVENLABS_TTS_IVC_SETUP_MS,
            setupNote: ELEVENLABS_TTS_IVC_SETUP_NOTE
          }
        : {}),
      ...(attachPvcEstimate
        ? {
            setupCostCents: ELEVENLABS_TTS_PVC_COST_CENTS,
            ...(typeof pvcSetupTimeMs === 'number' ? { setupTimeMs: pvcSetupTimeMs } : {}),
            setupNote: ELEVENLABS_TTS_PVC_SETUP_NOTE
          }
        : {}),
      run: async (text, outputDir) => {
        await ensureElevenLabsTtsSetup()
        return await runElevenLabsTts(text, outputDir, {
          model,
          voiceId,
          pvcVoiceId,
          pvcWait: options.elevenlabsTtsPvcWait === true,
          clone
        })
      }
    })
  }

  for (const rawModel of minimaxModels) {
    const model: MinimaxTtsModel = validateMinimaxTtsModel(rawModel)
    const rawVoiceId = options.minimaxTtsVoice?.trim() || undefined
    const voiceId = minimaxCloneRefAudioPath && rawVoiceId
      ? validateMinimaxTtsCloneVoiceId(rawVoiceId)
      : rawVoiceId
    const clone = minimaxCloneRefAudioPath
      ? {
          refAudioPath: minimaxCloneRefAudioPath,
          ...(voiceId ? { voiceId } : {}),
          ...(minimaxClonePromptAudioPath ? { promptAudioPath: minimaxClonePromptAudioPath } : {}),
          ...(minimaxClonePromptText ? { promptText: minimaxClonePromptText } : {}),
          needNoiseReduction: options.minimaxTtsCloneNoiseReduction === true,
          needVolumeNormalization: options.minimaxTtsCloneVolumeNormalization === true,
          context: minimaxCloneContext
        }
      : undefined
    const attachCloneEstimate = clone !== undefined && !minimaxCloneEstimateAttached
    if (attachCloneEstimate) {
      minimaxCloneEstimateAttached = true
    }

    targets.push({
      service: 'minimax',
      model,
      ...(clone ? { voice: `ref_audio:${basename(clone.refAudioPath)}` } : voiceId ? { voice: voiceId } : {}),
      ...(attachCloneEstimate
        ? {
            setupCostCents: MINIMAX_TTS_CLONE_COST_CENTS,
            setupTimeMs: MINIMAX_TTS_CLONE_SETUP_MS,
            setupNote: 'MiniMax rapid voice clone setup'
          }
        : {}),
      run: async (text, outputDir) => {
        return await runMinimaxTts(text, outputDir, { model, voiceId, clone })
      }
    })
  }

  for (const rawModel of groqModels) {
    const model: GroqTtsModel = validateGroqTtsModel(rawModel)
    const voiceRaw = options.groqVoiceId?.trim()
    const voiceId = voiceRaw && voiceRaw.length > 0 ? validateGroqTtsVoice(voiceRaw) : undefined

    targets.push({
      service: 'groq',
      model,
      ...(voiceId ? { voice: voiceId } : {}),
      run: async (text, outputDir) => {
        await ensureGroqTtsSetup()
        return await runGroqTts(text, outputDir, { model, voiceId })
      }
    })
  }

  for (const rawModel of grokModels) {
    const model: GrokTtsModel = validateGrokTtsModel(rawModel)
    const voiceRaw = options.grokTtsVoice?.trim()
    const voiceId = voiceRaw && voiceRaw.length > 0 ? validateGrokTtsVoice(voiceRaw) : undefined

    targets.push({
      service: 'grok',
      model,
      ...(voiceId ? { voice: voiceId } : {}),
      run: async (text, outputDir) => {
        await ensureGrokTtsSetup()
        return await runGrokTts(text, outputDir, { model, voiceId })
      }
    })
  }

  for (const rawModel of mistralModels) {
    const model: MistralTtsModel = validateMistralTtsModel(rawModel)
    const voiceId = options.mistralTtsVoice?.trim() || undefined
    const refAudioPath = options.mistralTtsRefAudio?.trim() || undefined
    if (voiceId && refAudioPath) {
      throw new Error('Mistral TTS requires exactly one voice source. Use either --mistral-tts-voice or --mistral-tts-ref-audio, not both.')
    }

    targets.push({
      service: 'mistral',
      model,
      ...(voiceId ? { voice: voiceId } : refAudioPath ? { voice: `ref_audio:${basename(refAudioPath)}` } : {}),
      run: async (text, outputDir) => {
        return await runMistralTts(text, outputDir, { model, voiceId, refAudioPath })
      }
    })
  }

  for (const rawModel of openaiModels) {
    const model: OpenAITtsModel = validateOpenAITtsModel(rawModel)
    const voiceId = options.openaiVoiceId?.trim() || undefined
    const clone = openaiCloneRefAudioPath
      ? {
          refAudioPath: openaiCloneRefAudioPath,
          ...(openaiCloneConsentId ? { consentId: openaiCloneConsentId } : {}),
          ...(openaiCloneConsentAudioPath ? { consentAudioPath: openaiCloneConsentAudioPath } : {}),
          ...(openaiCloneConsentLanguage ? { consentLanguage: openaiCloneConsentLanguage } : {}),
          ...(openaiCloneConsentName ? { consentName: openaiCloneConsentName } : {}),
          ...(openaiCloneVoiceName ? { voiceName: openaiCloneVoiceName } : {}),
          context: openaiCloneContext
        }
      : undefined
    const attachCloneEstimate = clone !== undefined && !openaiCloneEstimateAttached
    if (attachCloneEstimate) {
      openaiCloneEstimateAttached = true
    }

    targets.push({
      service: 'openai',
      model,
      ...(clone ? { voice: `ref_audio:${basename(clone.refAudioPath)}` } : voiceId ? { voice: voiceId } : {}),
      ...(attachCloneEstimate
        ? {
            setupCostCents: OPENAI_TTS_CLONE_COST_CENTS,
            setupTimeMs: OPENAI_TTS_CLONE_SETUP_MS,
            setupNote: OPENAI_TTS_CLONE_SETUP_NOTE
          }
        : {}),
      run: async (text, outputDir) => {
        await ensureOpenAITtsSetup()
        return await runOpenAITts(text, outputDir, { model, voiceId, clone })
      }
    })
  }

  for (const rawModel of geminiModels) {
    const model: GeminiTtsModel = validateGeminiTtsModel(rawModel)
    const voiceId = options.geminiVoiceId?.trim() || undefined
    const speaker = geminiMultiSpeakerConfig ? formatGeminiSpeakerSummary(geminiMultiSpeakerConfig) : voiceId

    targets.push({
      service: 'gemini',
      model,
      ...(speaker ? { voice: speaker } : {}),
      run: async (text, outputDir) => {
        await ensureGeminiTtsSetup()
        return await runGeminiTts(text, outputDir, { model, voiceId, multiSpeakerConfig: geminiMultiSpeakerConfig })
      }
    })
  }

  for (const rawModel of deepgramModels) {
    const model: DeepgramTtsModel = validateDeepgramTtsModel(rawModel)
    const voiceId = options.deepgramVoiceId?.trim()
      ? validateDeepgramTtsVoice(options.deepgramVoiceId.trim())
      : undefined

    targets.push({
      service: 'deepgram',
      model,
      ...(voiceId ? { voice: voiceId } : {}),
      run: async (text, outputDir) => {
        await ensureDeepgramTtsSetup()
        return await runDeepgramTts(text, outputDir, { model, voiceId })
      }
    })
  }

  for (const rawModel of runwayModels) {
    const model: RunwayTtsModel = validateRunwayTtsModel(rawModel)
    const voiceRaw = options.runwayTtsVoice?.trim()
    const voiceId = voiceRaw && voiceRaw.length > 0 ? validateRunwayTtsVoice(voiceRaw) : undefined

    targets.push({
      service: 'runway',
      model,
      ...(voiceId ? { voice: voiceId } : {}),
      run: async (text, outputDir) => {
        await ensureRunwayTtsSetup()
        return await runRunwayTts(text, outputDir, { model, voiceId })
      }
    })
  }

  for (const rawModel of speechifyModels) {
    const model: SpeechifyTtsModel = validateSpeechifyTtsModel(rawModel)
    const voiceRaw = options.speechifyVoice?.trim()
    const voiceId = voiceRaw && voiceRaw.length > 0 ? validateSpeechifyTtsVoice(voiceRaw) : undefined
    const customVoice = speechifyCustomVoiceRefAudioPath
      ? {
          refAudioPath: speechifyCustomVoiceRefAudioPath,
          ...(speechifyCustomVoiceName ? { voiceName: speechifyCustomVoiceName } : {}),
          ...(speechifyCustomVoiceConsentName ? { consentName: speechifyCustomVoiceConsentName } : {}),
          ...(speechifyCustomVoiceConsentEmail ? { consentEmail: speechifyCustomVoiceConsentEmail } : {}),
          ...(speechifyCustomVoiceLocale ? { locale: speechifyCustomVoiceLocale } : {}),
          ...(speechifyCustomVoiceGender ? { gender: speechifyCustomVoiceGender } : {}),
          context: speechifyCustomVoiceContext
        }
      : undefined
    const attachCustomVoiceEstimate = customVoice !== undefined && !speechifyCustomVoiceEstimateAttached
    if (attachCustomVoiceEstimate) {
      speechifyCustomVoiceEstimateAttached = true
    }

    targets.push({
      service: 'speechify',
      model,
      ...(customVoice ? { voice: `ref_audio:${basename(customVoice.refAudioPath)}` } : voiceId ? { voice: voiceId } : {}),
      ...(attachCustomVoiceEstimate
        ? {
            setupCostCents: SPEECHIFY_TTS_CUSTOM_VOICE_COST_CENTS,
            setupTimeMs: SPEECHIFY_TTS_CUSTOM_VOICE_SETUP_MS,
            setupNote: SPEECHIFY_TTS_CUSTOM_VOICE_SETUP_NOTE
          }
        : {}),
      run: async (text, outputDir) => {
        await ensureSpeechifyTtsSetup()
        return await runSpeechifyTts(text, outputDir, { model, voiceId, customVoice })
      }
    })
  }

  for (const rawModel of gcloudModels) {
    const model: GcloudTtsModel = validateGcloudTtsModel(rawModel)
    const voiceRaw = options.gcloudTtsVoice?.trim()
    const voiceId = voiceRaw && voiceRaw.length > 0 ? validateGcloudTtsVoice(voiceRaw) : undefined
    const language = options.gcloudTtsLanguage?.trim() || undefined

    if (model === 'instant-custom-voice' && !gcloudVoiceCloningKey && (!gcloudRefAudioPath || !gcloudConsentAudioPath)) {
      throw new Error('Google Cloud TTS instant-custom-voice requires --gcloud-tts-voice-cloning-key or both --gcloud-tts-ref-audio and --gcloud-tts-consent-audio.')
    }

    const defaultVoice = model === 'instant-custom-voice'
      ? 'instant-custom-voice'
      : GCLOUD_DEFAULT_TTS_VOICES[model]
    const speaker = model === 'instant-custom-voice'
      ? 'instant-custom-voice'
      : voiceId ?? defaultVoice

    targets.push({
      service: 'gcloud',
      model,
      voice: speaker,
      run: async (text, outputDir) => {
        return await runGcloudTts(text, outputDir, {
          model,
          voice: voiceId,
          language,
          refAudioPath: gcloudRefAudioPath,
          consentAudioPath: gcloudConsentAudioPath,
          consentLanguage: gcloudConsentLanguage,
          voiceCloningKey: gcloudVoiceCloningKey,
          voiceCloningKeyOut: gcloudVoiceCloningKeyOut
        })
      }
    })
  }

  for (const rawModel of deapiModels) {
    const model: DeapiTtsModel = validateDeapiTtsModel(rawModel)
    const voiceId = options.deapiTtsVoice?.trim() || undefined
    const refAudioPath = options.deapiTtsRefAudio?.trim() || undefined
    const refText = options.deapiTtsRefText?.trim() || undefined

    if (voiceId && refAudioPath) {
      throw new Error('deAPI TTS requires exactly one voice source. Use either --deapi-tts-voice or --deapi-tts-ref-audio, not both.')
    }
    if (refText && !refAudioPath) {
      throw new Error('deAPI TTS --deapi-tts-ref-text requires --deapi-tts-ref-audio.')
    }
    if (refAudioPath && model !== DEAPI_TTS_VOICE_CLONE_MODEL) {
      throw new Error(`deAPI TTS voice cloning is only supported for ${DEAPI_TTS_VOICE_CLONE_MODEL}.`)
    }
    if (model === DEAPI_TTS_VOICE_CLONE_MODEL && !refAudioPath) {
      throw new Error(`deAPI TTS model ${DEAPI_TTS_VOICE_CLONE_MODEL} requires --deapi-tts-ref-audio.`)
    }
    if (model === 'Qwen3_TTS_12Hz_1_7B_VoiceDesign') {
      throw new Error('deAPI TTS model Qwen3_TTS_12Hz_1_7B_VoiceDesign is not yet supported because it requires voice design instruction inputs.')
    }

    targets.push({
      service: 'deapi',
      model,
      ...(voiceId ? { voice: voiceId } : refAudioPath ? { voice: `ref_audio:${basename(refAudioPath)}` } : {}),
      run: async (text, outputDir) => {
        return await runDeapiTts(text, outputDir, { model, voiceId, refAudioPath, refText })
      }
    })
  }

  return targets
}
