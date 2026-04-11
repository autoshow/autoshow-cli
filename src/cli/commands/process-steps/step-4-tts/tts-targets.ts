import type { ProcessingOptions, Step4Metadata, TtsProvider } from '~/types'
import {
  type KittenTtsModel,
  type ElevenlabsTtsModel,
  type MinimaxTtsModel,
  type GroqTtsModel,
  type OpenAITtsModel,
  type GeminiTtsModel,
  validateKittenTtsModel,
  validateElevenlabsTtsModel,
  validateMinimaxTtsModel,
  validateGroqTtsModel,
  validateOpenAITtsModel,
  validateGeminiTtsModel,
  validateGroqTtsVoice,
  validateKittenTtsSpeaker,
} from '~/cli/commands/models/model-options'
import { pathExists, kittenTtsUvEnvDir } from '~/cli/commands/process-steps/step-0-setup/setup-orchestrator/run-complete-setup'
import { ensureKittenTtsSetup } from '~/cli/commands/process-steps/step-4-tts/tts-local/kitten/kitten-tts'
import { ensureElevenLabsTtsSetup } from '~/cli/commands/process-steps/step-4-tts/tts-services/elevenlabs/elevenlabs-tts'
import { ensureGroqTtsSetup } from '~/cli/commands/process-steps/step-4-tts/tts-services/groq/groq-tts'
import { ensureOpenAITtsSetup } from '~/cli/commands/process-steps/step-4-tts/tts-services/openai/openai-tts'
import { ensureGeminiTtsSetup } from '~/cli/commands/process-steps/step-4-tts/tts-services/gemini/gemini-tts'
import { runKittenTts } from './tts-local/kitten/run-kitten-tts'
import { runElevenLabsTts } from './tts-services/elevenlabs/run-elevenlabs-tts'
import { runMinimaxTts } from './tts-services/minimax/run-minimax-tts'
import { runGroqTts } from './tts-services/groq/run-groq-tts'
import { runOpenAITts } from './tts-services/openai/run-openai-tts'
import { runGeminiTts } from './tts-services/gemini/run-gemini-tts'
import { buildSingleArtifactMap, getSingleFileArtifactName } from '~/cli/commands/process-steps/target-runner'
import * as l from '~/logger'

const KITTEN_PYTHON_VERSION = '3.12'

export const DEFAULT_KITTEN_TTS_MODEL = 'kitten-tts-nano-0.8-int8'
export const DEFAULT_KITTEN_TTS_SPEAKER = 'Jasper'

export type TtsOptions = Pick<
  ProcessingOptions,
  | 'ttsSpeaker'
  | 'kittenTtsModel'
  | 'elevenlabsTtsModel'
  | 'elevenlabsVoiceId'
  | 'minimaxTtsModel'
  | 'minimaxTtsVoice'
  | 'groqTtsModel'
  | 'groqVoiceId'
  | 'openaiTtsModel'
  | 'openaiVoiceId'
  | 'geminiTtsModel'
  | 'geminiVoiceId'
>

export type TtsTarget = {
  service: TtsProvider
  model: string
  voice?: string
  run: (text: string, outputDir: string, opts: TtsOptions) => Promise<{ audioPath: string, metadata: Step4Metadata }>
}

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
  l.info('Checking Kitten TTS setup')
  const isSetup = await checkKittenTtsSetup()
  if (!isSetup) {
    l.info('Kitten TTS not set up; running setup')
    await ensureKittenTtsSetup()
  } else {
    l.success('Kitten TTS setup verified')
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

export const collectTtsTargets = (options: TtsOptions): TtsTarget[] => {
  const targets: TtsTarget[] = []

  if (typeof options.kittenTtsModel === 'string' && options.kittenTtsModel.length > 0) {
    const model: KittenTtsModel = validateKittenTtsModel(options.kittenTtsModel)
    const rawSpeaker = options.ttsSpeaker ?? DEFAULT_KITTEN_TTS_SPEAKER
    const speaker = validateKittenTtsSpeaker(rawSpeaker === 'Ryan' ? DEFAULT_KITTEN_TTS_SPEAKER : rawSpeaker)

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

  if (typeof options.elevenlabsTtsModel === 'string' && options.elevenlabsTtsModel.length > 0) {
    const model: ElevenlabsTtsModel = validateElevenlabsTtsModel(options.elevenlabsTtsModel)
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

  if (typeof options.minimaxTtsModel === 'string' && options.minimaxTtsModel.length > 0) {
    const model: MinimaxTtsModel = validateMinimaxTtsModel(options.minimaxTtsModel)
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

  if (typeof options.groqTtsModel === 'string' && options.groqTtsModel.length > 0) {
    const model: GroqTtsModel = validateGroqTtsModel(options.groqTtsModel)
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

  if (typeof options.openaiTtsModel === 'string' && options.openaiTtsModel.length > 0) {
    const model: OpenAITtsModel = validateOpenAITtsModel(options.openaiTtsModel)
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

  if (typeof options.geminiTtsModel === 'string' && options.geminiTtsModel.length > 0) {
    const model: GeminiTtsModel = validateGeminiTtsModel(options.geminiTtsModel)
    const voiceId = options.geminiVoiceId?.trim() || undefined

    targets.push({
      service: 'gemini',
      model,
      ...(voiceId ? { voice: voiceId } : {}),
      run: async (text, outputDir) => {
        await ensureGeminiTtsSetup()
        return await runGeminiTts(text, outputDir, { model, voiceId })
      }
    })
  }

  return targets
}
