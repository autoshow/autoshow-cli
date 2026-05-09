import type { TtsOptions, TtsTarget } from '~/types'
import { collectDeapiTtsTargets } from './providers/deapi'
import { collectDeepgramTtsTargets } from './providers/deepgram'
import { collectElevenLabsTtsTargets } from './providers/elevenlabs'
import { collectGcloudTtsTargets } from './providers/gcloud'
import { collectGeminiTtsTargets } from './providers/gemini'
import { collectGrokTtsTargets } from './providers/grok'
import { collectGroqTtsTargets } from './providers/groq'
import { collectKittenTtsTargets } from './providers/kitten'
import { collectMinimaxTtsTargets } from './providers/minimax'
import { collectMistralTtsTargets } from './providers/mistral'
import { collectOpenAITtsTargets } from './providers/openai'
import { collectRunwayTtsTargets } from './providers/runway'
import { collectSpeechifyTtsTargets } from './providers/speechify'
import { createTtsTargetSelection } from './selection'
import { validateTtsTargetSelection } from './target-validation'

export const collectTtsTargets = (options: TtsOptions): TtsTarget[] => {
  const selection = createTtsTargetSelection(options)
  validateTtsTargetSelection(options, selection)

  return [
    ...collectKittenTtsTargets(options, selection),
    ...collectElevenLabsTtsTargets(selection),
    ...collectMinimaxTtsTargets(options, selection),
    ...collectGroqTtsTargets(selection),
    ...collectGrokTtsTargets(selection),
    ...collectMistralTtsTargets(selection),
    ...collectOpenAITtsTargets(selection),
    ...collectGeminiTtsTargets(selection),
    ...collectDeepgramTtsTargets(selection),
    ...collectRunwayTtsTargets(selection),
    ...collectSpeechifyTtsTargets(selection),
    ...collectGcloudTtsTargets(selection),
    ...collectDeapiTtsTargets(selection)
  ]
}
