import type { TtsOptions } from '~/types'
import {
  resolveGeminiMultiSpeakerConfig,
  validateGeminiMultiSpeakerTranscript
} from '../tts-services/gemini/gemini-tts-config'

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
