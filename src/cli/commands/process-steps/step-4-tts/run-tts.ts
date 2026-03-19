import type { ProcessingOptions, Step4Metadata } from '~/types'
import type { TtsProvider } from '~/types'
import * as l from '~/logger'
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
  validateGeminiTtsModel
} from '~/cli/commands/models/model-options'
import { assertNever } from '~/utils/validate/assert-never'
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

const KITTEN_PYTHON_VERSION = '3.12'
const DEFAULT_KITTEN_TTS_MODEL = 'kitten-tts-nano-0.8-int8'
const DEFAULT_KITTEN_TTS_SPEAKER = 'Jasper'

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

type TtsOptions = Pick<
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

const resolveTtsEngine = (options: TtsOptions): TtsProvider => {
  const hasKitten = typeof options.kittenTtsModel === 'string' && options.kittenTtsModel.length > 0
  const hasElevenlabs = typeof options.elevenlabsTtsModel === 'string' && options.elevenlabsTtsModel.length > 0
  const hasMinimax = typeof options.minimaxTtsModel === 'string' && options.minimaxTtsModel.length > 0
  const hasGroq = typeof options.groqTtsModel === 'string' && options.groqTtsModel.length > 0
  const hasOpenAI = typeof options.openaiTtsModel === 'string' && options.openaiTtsModel.length > 0
  const hasGemini = typeof options.geminiTtsModel === 'string' && options.geminiTtsModel.length > 0

  const engineCount = [hasKitten, hasElevenlabs, hasMinimax, hasGroq, hasOpenAI, hasGemini].filter(Boolean).length
  if (engineCount > 1) {
    throw new Error('Cannot use more than one TTS engine at the same time (--kitten-tts, --elevenlabs-tts, --minimax-tts, --groq-tts, --openai-tts, --gemini-tts)')
  }

  if (hasKitten) return 'kitten'
  if (hasElevenlabs) return 'elevenlabs'
  if (hasMinimax) return 'minimax'
  if (hasGroq) return 'groq'
  if (hasOpenAI) return 'openai'
  if (hasGemini) return 'gemini'
  return 'kitten'
}

export const runTts = async (
  text: string,
  outputDir: string,
  options: TtsOptions
): Promise<{ audioPath: string, metadata: Step4Metadata }> => {

  const engine = resolveTtsEngine(options)

  if (engine === 'kitten') {
    await ensureKittenSetup()
    const model: KittenTtsModel = validateKittenTtsModel(options.kittenTtsModel ?? DEFAULT_KITTEN_TTS_MODEL)

    return await runKittenTts(text, outputDir, {
      model,
      speaker: options.ttsSpeaker ?? DEFAULT_KITTEN_TTS_SPEAKER
    })
  }

  if (engine === 'elevenlabs') {
    await ensureElevenLabsTtsSetup()
    const model: ElevenlabsTtsModel = validateElevenlabsTtsModel(options.elevenlabsTtsModel as string)
    const voiceId = options.elevenlabsVoiceId?.trim()
    return await runElevenLabsTts(text, outputDir, { model, voiceId })
  }

  if (engine === 'minimax') {
    const model: MinimaxTtsModel = validateMinimaxTtsModel(options.minimaxTtsModel as string)
    return await runMinimaxTts(text, outputDir, {
      model,
      voiceId: options.minimaxTtsVoice
    })
  }

  if (engine === 'groq') {
    await ensureGroqTtsSetup()
    const model: GroqTtsModel = validateGroqTtsModel(options.groqTtsModel as string)
    return await runGroqTts(text, outputDir, {
      model,
      voiceId: options.groqVoiceId
    })
  }

  if (engine === 'openai') {
    await ensureOpenAITtsSetup()
    const model: OpenAITtsModel = validateOpenAITtsModel(options.openaiTtsModel as string)
    return await runOpenAITts(text, outputDir, {
      model,
      voiceId: options.openaiVoiceId
    })
  }

  if (engine === 'gemini') {
    await ensureGeminiTtsSetup()
    const model: GeminiTtsModel = validateGeminiTtsModel(options.geminiTtsModel as string)
    return await runGeminiTts(text, outputDir, {
      model,
      voiceId: options.geminiVoiceId
    })
  }

  assertNever(engine)
}
