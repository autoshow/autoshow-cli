import type { TtsOptions, TtsTarget } from '~/types'
import { collectDeepgramTtsTargets } from './providers/deepgram'
import { collectElevenLabsTtsTargets } from './providers/elevenlabs'
import { collectCartesiaTtsTargets } from './providers/cartesia'
import { collectGcloudTtsTargets } from './providers/gcloud'
import { collectGeminiTtsTargets } from './providers/gemini'
import { collectGrokTtsTargets } from './providers/grok'
import { collectGroqTtsTargets } from './providers/groq'
import { collectHumeTtsTargets } from './providers/hume'
import { collectKittenTtsTargets } from './providers/kitten'
import { collectMinimaxTtsTargets } from './providers/minimax'
import { collectMistralTtsTargets } from './providers/mistral'
import { collectOpenAITtsTargets } from './providers/openai'
import { collectSpeechifyTtsTargets } from './providers/speechify'
import { createTtsTargetSelection } from './selection'
import { validateTtsTargetSelection } from './target-validation'

export const collectTtsTargets = (options: TtsOptions): TtsTarget[] => {
  const selection = createTtsTargetSelection(options)
  validateTtsTargetSelection(options, selection)

  return [
    ...collectKittenTtsTargets(options, selection),
    ...collectElevenLabsTtsTargets(selection),
    ...collectMinimaxTtsTargets(selection),
    ...collectGroqTtsTargets(selection),
    ...collectGrokTtsTargets(selection),
    ...collectMistralTtsTargets(selection),
    ...collectOpenAITtsTargets(selection),
    ...collectGeminiTtsTargets(selection),
    ...collectDeepgramTtsTargets(selection),
    ...collectSpeechifyTtsTargets(selection),
    ...collectHumeTtsTargets(selection),
    ...collectCartesiaTtsTargets(selection),
    ...collectGcloudTtsTargets(selection)
  ]
}
