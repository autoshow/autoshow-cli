import type { Step4Metadata, TtsOptions, TtsTarget } from '~/types'
import type {
  ElevenlabsTtsModel,
  GeminiTtsModel,
  GroqTtsModel,
  KittenTtsModel,
  MinimaxTtsModel,
  OpenAITtsModel,
  DeepgramTtsModel,
  DeapiTtsModel,
  GrokTtsModel
} from '~/types'
import {
  validateKittenTtsModel,
  validateElevenlabsTtsModel,
  validateMinimaxTtsModel,
  validateGroqTtsModel,
  validateGrokTtsModel,
  validateOpenAITtsModel,
  validateGeminiTtsModel,
  validateDeapiTtsModel,
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
import { ensureDeapiTtsSetup } from '~/cli/commands/process-steps/step-4-tts/tts-services/deapi/deapi-tts'
import { runKittenTts } from './tts-local/kitten/run-kitten-tts'
import { runElevenLabsTts } from './tts-services/elevenlabs/run-elevenlabs-tts'
import { runMinimaxTts } from './tts-services/minimax/run-minimax-tts'
import { runGroqTts } from './tts-services/groq/run-groq-tts'
import { runGrokTts } from './tts-services/grok/run-grok-tts'
import { runOpenAITts } from './tts-services/openai/run-openai-tts'
import { runGeminiTts } from './tts-services/gemini/run-gemini-tts'
import { runDeepgramTts } from './tts-services/deepgram/run-deepgram-tts'
import { runDeapiTts } from './tts-services/deapi/run-deapi-tts'
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
  const openaiModels = options.openaiTtsModels ?? (options.openaiTtsModel ? [options.openaiTtsModel] : [])
  const geminiModels = options.geminiTtsModels ?? (options.geminiTtsModel ? [options.geminiTtsModel] : [])
  const deepgramModels = options.deepgramTtsModels ?? (options.deepgramTtsModel ? [options.deepgramTtsModel] : [])
  const deapiModels = options.deapiTtsModels ?? (options.deapiTtsModel ? [options.deapiTtsModel] : [])
  const geminiMultiSpeakerConfig = resolveGeminiMultiSpeakerConfig(options)

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
    const voiceId = options.minimaxTtsVoice?.trim() || undefined

    targets.push({
      service: 'minimax',
      model,
      ...(voiceId ? { voice: voiceId } : {}),
      run: async (text, outputDir) => {
        return await runMinimaxTts(text, outputDir, { model, voiceId })
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

  for (const rawModel of openaiModels) {
    const model: OpenAITtsModel = validateOpenAITtsModel(rawModel)
    const voiceId = options.openaiVoiceId?.trim() || undefined

    targets.push({
      service: 'openai',
      model,
      ...(voiceId ? { voice: voiceId } : {}),
      run: async (text, outputDir) => {
        await ensureOpenAITtsSetup()
        return await runOpenAITts(text, outputDir, { model, voiceId })
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

  for (const rawModel of deapiModels) {
    const model: DeapiTtsModel = validateDeapiTtsModel(rawModel)
    const voiceId = options.deapiTtsVoice?.trim() || undefined

    targets.push({
      service: 'deapi',
      model,
      ...(voiceId ? { voice: voiceId } : {}),
      run: async (text, outputDir) => {
        await ensureDeapiTtsSetup()
        return await runDeapiTts(text, outputDir, { model, voiceId })
      }
    })
  }

  return targets
}
