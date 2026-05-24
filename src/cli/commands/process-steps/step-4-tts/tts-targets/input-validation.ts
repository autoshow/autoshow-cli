import type { TtsOptions } from '~/types'
import {
  resolveGeminiMultiSpeakerConfig,
  validateGeminiMultiSpeakerTranscript,
  validateGeminiMultiSpeakerTranscriptFromRegistry
} from '../tts-services/gemini/gemini-tts-config'
import { isMultiSpeakerRequested, parseSpeakerVoiceMappings, parseSpeakerRefAudioMappings } from '../dialogue-normalizer'

export const validateTtsInput = (text: string, options: TtsOptions): void => {
  const geminiModels = options.geminiTtsModels ?? (options.geminiTtsModel ? [options.geminiTtsModel] : [])
  if (geminiModels.length === 0) {
    return
  }

  if (isMultiSpeakerRequested(options) && (options.ttsSpeakers?.length ?? 0) > 0) {
    const registry = parseSpeakerVoiceMappings(options.ttsSpeakers)
    validateGeminiMultiSpeakerTranscriptFromRegistry(text, registry)
    return
  }

  if (isMultiSpeakerRequested(options) && (options.ttsSpeakerRefAudios?.length ?? 0) > 0) {
    const registry = parseSpeakerRefAudioMappings(options.ttsSpeakerRefAudios)
    validateGeminiMultiSpeakerTranscriptFromRegistry(text, registry)
    return
  }

  const geminiMultiSpeakerConfig = resolveGeminiMultiSpeakerConfig(options)
  if (geminiMultiSpeakerConfig) {
    validateGeminiMultiSpeakerTranscript(text, geminiMultiSpeakerConfig)
  }
}
