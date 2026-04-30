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
  RunwayTtsModel
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
import { runKittenTts } from './tts-local/kitten/run-kitten-tts'
import { runElevenLabsTts } from './tts-services/elevenlabs/run-elevenlabs-tts'
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
import { DEAPI_TTS_VOICE_CLONE_MODEL, runDeapiTts } from './tts-services/deapi/run-deapi-tts'
import {
  formatGeminiSpeakerSummary,
  resolveGeminiMultiSpeakerConfig,
  validateGeminiMultiSpeakerTranscript
} from './tts-services/gemini/gemini-tts-config'
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

  const minimaxCloneContext = minimaxCloneRefAudioPath ? createMinimaxTtsCloneContext() : undefined
  const openaiCloneContext = openaiCloneRefAudioPath ? createOpenAITtsCustomVoiceContext() : undefined
  let minimaxCloneEstimateAttached = false
  let openaiCloneEstimateAttached = false

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

    targets.push({
      service: 'elevenlabs',
      model,
      ...(voiceId ? { voice: voiceId } : {}),
      run: async (text, outputDir) => {
        await ensureElevenLabsTtsSetup()
        return await runElevenLabsTts(text, outputDir, { model, voiceId })
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
