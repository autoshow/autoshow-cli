import type { TtsOptions } from '~/types'
import {
  getGroqTtsVoicesForModel,
  validateGroqTtsVoice
} from '~/cli/commands/setup-and-utilities/models/model-options'
import { resolveDialogueFormat } from '../dialogue-normalizer'
import { validateSpeechifyTtsCustomVoiceGender } from '../tts-services/speechify/speechify-custom-voices'
import type { TtsTargetSelection } from './selection'
import { getMultiSpeakerStrategy, supportsRefAudioMultiSpeaker } from './multi-speaker-capability'

const requireProviderSelectionMessage = (
  label: string,
  provider: string,
  detail: string
): string =>
  `${label} ${detail} require selecting ${provider} TTS with --provider/--tts ${provider}[=model] or an all-provider TTS run.`

export const validateTtsTargetSelection = (
  options: TtsOptions,
  selection: TtsTargetSelection
): void => {
  if (selection.multiSpeakerRequested) {
    resolveDialogueFormat(options)
    const registry = selection.speakerVoiceRegistry
    if (!registry || registry.entries.length === 0) {
      throw new Error('Multi-speaker TTS requires at least one --tts-speaker SPEAKER=VOICE mapping.')
    }

    const allProviderModels = [
      { provider: 'kitten' as const, models: selection.kittenModels },
      { provider: 'elevenlabs' as const, models: selection.elevenlabsModels },
      { provider: 'minimax' as const, models: selection.minimaxModels },
      { provider: 'groq' as const, models: selection.groqModels },
      { provider: 'grok' as const, models: selection.grokModels },
      { provider: 'mistral' as const, models: selection.mistralModels },
      { provider: 'openai' as const, models: selection.openaiModels },
      { provider: 'gemini' as const, models: selection.geminiModels },
      { provider: 'deepgram' as const, models: selection.deepgramModels },
      { provider: 'speechify' as const, models: selection.speechifyModels },
      { provider: 'hume' as const, models: selection.humeModels },
      { provider: 'cartesia' as const, models: selection.cartesiaModels },
    ]
    const selectedProviders = allProviderModels.filter((p) => p.models.length > 0)
    if (selectedProviders.length === 0) {
      throw new Error('Multi-speaker TTS requires at least one TTS provider.')
    }

    const hasCapable = selectedProviders.some((p) => getMultiSpeakerStrategy(p.provider) !== undefined)
    if (!hasCapable) {
      throw new Error('No selected TTS provider supports multi-speaker TTS.')
    }

    const refAudioSpeakers = registry.entries.filter((e) => e.voiceKind === 'ref-audio')
    if (refAudioSpeakers.length > 0) {
      for (const { provider, models } of selectedProviders) {
        if (models.length > 0 && !supportsRefAudioMultiSpeaker(provider)) {
          throw new Error(
            `Provider ${provider} does not support reference audio for multi-speaker TTS. `
            + `Use voice IDs instead of file paths in --tts-speaker mappings, or remove ${provider}.`
          )
        }
      }
    }
  }

  const hasMinimaxRequestControlFlags = Boolean(
    selection.minimaxLanguageBoost
    || typeof selection.minimaxSpeed === 'number'
    || typeof selection.minimaxVolume === 'number'
    || typeof selection.minimaxPitch === 'number'
    || selection.minimaxEmotion
    || selection.minimaxEnglishNormalization
    || (selection.minimaxPronunciations && selection.minimaxPronunciations.length > 0)
  )
  if (hasMinimaxRequestControlFlags && selection.minimaxModels.length === 0) {
    throw new Error(requireProviderSelectionMessage('MiniMax TTS', 'minimax', 'request control flags'))
  }

  if (selection.hasOpenAICloneFlags && selection.openaiModels.length === 0) {
    throw new Error(requireProviderSelectionMessage('OpenAI TTS', 'openai', 'custom voice flags'))
  }
  if ((selection.openaiInstructions || typeof selection.openaiSpeed === 'number') && selection.openaiModels.length === 0) {
    throw new Error(requireProviderSelectionMessage('OpenAI TTS', 'openai', 'request control flags'))
  }
  if (selection.hasOpenAICloneFlags && !selection.openaiCloneRefAudioPath) {
    throw new Error('OpenAI TTS custom voice creation requires --openai-tts-ref-audio.')
  }
  if (selection.hasOpenAICloneFlags) {
    const consentSourceCount = (selection.openaiCloneConsentId ? 1 : 0) + (selection.openaiCloneConsentAudioPath ? 1 : 0)
    if (consentSourceCount !== 1) {
      throw new Error('OpenAI TTS custom voice creation requires exactly one of --openai-tts-consent-id or --openai-tts-consent-audio.')
    }
    if (selection.openaiVoiceId) {
      throw new Error('OpenAI TTS custom voice creation cannot be combined with --openai-voice. Use --openai-tts-voice-name for the created voice label.')
    }
  }

  if ((selection.grokLanguage || selection.grokTextNormalization) && selection.grokModels.length === 0) {
    throw new Error(requireProviderSelectionMessage('Grok TTS', 'grok', 'request control flags'))
  }

  if (selection.groqVoiceId && selection.groqModels.length > 1) {
    const voice = validateGroqTtsVoice(selection.groqVoiceId)
    const matchingModel = selection.groqModels.find((model) =>
      getGroqTtsVoicesForModel(model as Parameters<typeof getGroqTtsVoicesForModel>[0]).includes(voice)
    )
    throw new Error(
      matchingModel
        ? `Groq TTS --groq-voice "${voice}" matches only ${matchingModel}; select --provider/--tts groq=${matchingModel}.`
        : `Groq TTS --groq-voice "${voice}" requires selecting a Groq TTS model with --provider/--tts groq[=model].`
    )
  }

  const hasDeepgramRequestControlFlags = Boolean(
    selection.deepgramEncoding
    || selection.deepgramContainer
    || typeof selection.deepgramBitRate === 'number'
    || typeof selection.deepgramSampleRate === 'number'
    || typeof selection.deepgramSpeed === 'number'
  )
  if (hasDeepgramRequestControlFlags && selection.deepgramModels.length === 0) {
    throw new Error(requireProviderSelectionMessage('Deepgram TTS', 'deepgram', 'request control flags'))
  }

  if (selection.mistralVoiceName && selection.mistralModels.length === 0) {
    throw new Error(requireProviderSelectionMessage('Mistral TTS', 'mistral', 'saved voice creation'))
  }
  if (selection.mistralVoiceName && !selection.mistralRefAudioPath) {
    throw new Error('Mistral TTS --mistral-tts-voice-name requires --mistral-tts-ref-audio.')
  }
  if (selection.mistralVoiceName && selection.mistralVoiceId) {
    throw new Error('Mistral TTS saved voice creation cannot be combined with --mistral-tts-voice.')
  }

  if (selection.hasElevenLabsCloneFlags && selection.elevenlabsModels.length === 0) {
    throw new Error(requireProviderSelectionMessage('ElevenLabs TTS', 'elevenlabs', 'IVC flags'))
  }
  const hasElevenLabsRequestControlFlags = Boolean(
    selection.elevenLabsOutputFormat
    || selection.elevenLabsLanguageCode
    || typeof selection.elevenLabsStability === 'number'
    || typeof selection.elevenLabsSimilarityBoost === 'number'
    || typeof selection.elevenLabsStyle === 'number'
    || selection.elevenLabsUseSpeakerBoost
    || typeof selection.elevenLabsSpeed === 'number'
    || typeof selection.elevenLabsSeed === 'number'
    || selection.elevenLabsTextNormalization
    || (selection.elevenLabsPronunciationDictionaryLocators && selection.elevenLabsPronunciationDictionaryLocators.length > 0)
    || typeof selection.elevenLabsOptimizeStreamingLatency === 'number'
  )
  if (hasElevenLabsRequestControlFlags && selection.elevenlabsModels.length === 0) {
    throw new Error(requireProviderSelectionMessage('ElevenLabs TTS', 'elevenlabs', 'request control flags'))
  }
  if (selection.hasElevenLabsCloneFlags && !selection.elevenLabsCloneRefAudioPath) {
    throw new Error('ElevenLabs TTS IVC creation requires --elevenlabs-tts-ref-audio.')
  }
  if (selection.hasElevenLabsCloneFlags && selection.elevenLabsVoiceId) {
    throw new Error('ElevenLabs TTS IVC creation cannot be combined with --elevenlabs-voice. Use --elevenlabs-tts-voice-name for the created voice label.')
  }
  if (selection.hasElevenLabsVoiceNameOnly) {
    throw new Error('ElevenLabs TTS --elevenlabs-tts-voice-name requires --elevenlabs-tts-ref-audio.')
  }

  if (selection.hasSpeechifyCustomVoiceFlags && selection.speechifyModels.length === 0) {
    throw new Error(requireProviderSelectionMessage('Speechify TTS', 'speechify', 'custom voice flags'))
  }
  if ((selection.speechifyAudioFormat || selection.speechifyLanguage) && selection.speechifyModels.length === 0) {
    throw new Error(requireProviderSelectionMessage('Speechify TTS', 'speechify', 'request control flags'))
  }
  if (selection.hasSpeechifyCustomVoiceFlags && !selection.speechifyCustomVoiceRefAudioPath) {
    throw new Error('Speechify TTS custom voice creation requires --speechify-tts-ref-audio.')
  }
  if (selection.hasSpeechifyCustomVoiceFlags && selection.speechifyVoiceId) {
    throw new Error('Speechify TTS custom voice creation cannot be combined with --speechify-voice. Use --speechify-tts-voice-name for the created voice label.')
  }
  if (selection.speechifyCustomVoiceRefAudioPath && !selection.speechifyCustomVoiceConsentName) {
    throw new Error('Speechify TTS custom voice creation requires --speechify-tts-consent-name.')
  }
  if (selection.speechifyCustomVoiceRefAudioPath && !selection.speechifyCustomVoiceConsentEmail) {
    throw new Error('Speechify TTS custom voice creation requires --speechify-tts-consent-email.')
  }
  if (selection.speechifyCustomVoiceGender) {
    validateSpeechifyTtsCustomVoiceGender(selection.speechifyCustomVoiceGender)
  }

  if ((selection.humeVoice || selection.humeVoiceProvider) && selection.humeModels.length === 0) {
    throw new Error(requireProviderSelectionMessage('Hume TTS', 'hume', 'voice flags'))
  }

  if ((selection.cartesiaVoiceId || selection.cartesiaLanguage) && selection.cartesiaModels.length === 0) {
    throw new Error(requireProviderSelectionMessage('Cartesia TTS', 'cartesia', 'request control flags'))
  }

}
