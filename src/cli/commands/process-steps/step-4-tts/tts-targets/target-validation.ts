import type { TtsOptions } from '~/types'
import {
  parseSpeakerRefAudioMappings,
  resolveDialogueFormat
} from '../dialogue-normalizer'
import { validateSpeechifyTtsCustomVoiceGender } from '../tts-services/speechify/speechify-custom-voices'
import type { TtsTargetSelection } from './selection'

export const validateTtsTargetSelection = (
  options: TtsOptions,
  selection: TtsTargetSelection
): void => {
  if (selection.dialogueRequested) {
    resolveDialogueFormat(options)
    const speakerRegistry = parseSpeakerRefAudioMappings(options.ttsSpeakerRefAudios)
    if (speakerRegistry.entries.length === 0) {
      throw new Error('Dialogue TTS requires at least one --tts-speaker-ref-audio SPEAKER=path mapping.')
    }
    if (selection.mistralModels.length !== 1) {
      throw new Error('Dialogue TTS requires exactly one --mistral-tts <model> selection.')
    }
    const nonMistralModelCount = [
      selection.kittenModels,
      selection.elevenlabsModels,
      selection.minimaxModels,
      selection.groqModels,
      selection.grokModels,
      selection.openaiModels,
      selection.geminiModels,
      selection.deepgramModels,
      selection.runwayModels,
      selection.speechifyModels,
      selection.gcloudModels,
      selection.deapiModels
    ].reduce((sum, models) => sum + (models?.length ?? 0), 0)
    if (nonMistralModelCount > 0) {
      throw new Error('Dialogue TTS v1 supports exactly one Mistral TTS model and cannot be combined with other TTS providers.')
    }
    if (selection.mistralVoiceId || selection.mistralRefAudioPath) {
      throw new Error('Dialogue TTS uses --tts-speaker-ref-audio mappings; do not combine it with --mistral-tts-voice or --mistral-tts-ref-audio.')
    }
  }

  if (selection.hasMinimaxCloneFlags && selection.minimaxModels.length === 0) {
    throw new Error('MiniMax TTS clone flags require --minimax-tts <model> or --all-tts.')
  }
  if (
    (selection.minimaxClonePromptAudioPath
      || selection.minimaxClonePromptText
      || options.minimaxTtsCloneNoiseReduction
      || options.minimaxTtsCloneVolumeNormalization)
    && !selection.minimaxCloneRefAudioPath
  ) {
    throw new Error('MiniMax TTS clone option requires --minimax-tts-ref-audio.')
  }
  if (selection.minimaxClonePromptAudioPath && !selection.minimaxClonePromptText) {
    throw new Error('MiniMax TTS --minimax-tts-prompt-audio requires --minimax-tts-prompt-text.')
  }
  if (selection.minimaxClonePromptText && !selection.minimaxClonePromptAudioPath) {
    throw new Error('MiniMax TTS --minimax-tts-prompt-text requires --minimax-tts-prompt-audio.')
  }

  if (selection.hasOpenAICloneFlags && selection.openaiModels.length === 0) {
    throw new Error('OpenAI TTS custom voice flags require --openai-tts <model> or --all-tts.')
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

  if (selection.hasElevenLabsCloneFlags && selection.elevenlabsModels.length === 0) {
    throw new Error('ElevenLabs TTS IVC flags require --elevenlabs-tts <model> or --all-tts.')
  }
  if (selection.hasElevenLabsCloneFlags && !selection.elevenLabsCloneRefAudioPath) {
    throw new Error('ElevenLabs TTS IVC creation requires --elevenlabs-tts-ref-audio.')
  }
  if (selection.hasElevenLabsCloneFlags && selection.elevenLabsVoiceId) {
    throw new Error('ElevenLabs TTS IVC creation cannot be combined with --elevenlabs-voice. Use --elevenlabs-tts-voice-name for the created voice label.')
  }
  if (selection.hasElevenLabsVoiceNameOnly) {
    throw new Error('ElevenLabs TTS --elevenlabs-tts-voice-name requires --elevenlabs-tts-ref-audio for IVC or an ElevenLabs PVC setup flag.')
  }

  if (selection.hasSpeechifyCustomVoiceFlags && selection.speechifyModels.length === 0) {
    throw new Error('Speechify TTS custom voice flags require --speechify-tts <model> or --all-tts.')
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

  if (selection.hasGcloudIcvFlags && selection.gcloudModels.length === 0) {
    throw new Error('Google Cloud TTS instant custom voice flags require --gcloud-tts instant-custom-voice.')
  }
  if (selection.hasGcloudIcvFlags && !selection.gcloudModels.includes('instant-custom-voice')) {
    throw new Error('Google Cloud TTS instant custom voice flags require --gcloud-tts instant-custom-voice.')
  }
  if ((selection.gcloudRefAudioPath || selection.gcloudConsentAudioPath || selection.gcloudConsentLanguage || selection.gcloudVoiceCloningKeyOut) && selection.gcloudVoiceCloningKey) {
    throw new Error('Google Cloud TTS --gcloud-tts-voice-cloning-key cannot be combined with key generation flags.')
  }
  if ((selection.gcloudRefAudioPath || selection.gcloudConsentAudioPath || selection.gcloudConsentLanguage || selection.gcloudVoiceCloningKeyOut) && (!selection.gcloudRefAudioPath || !selection.gcloudConsentAudioPath)) {
    throw new Error('Google Cloud TTS instant custom voice key generation requires both --gcloud-tts-ref-audio and --gcloud-tts-consent-audio.')
  }

  if (selection.hasElevenLabsPvcSetupFlags && selection.elevenlabsModels.length === 0) {
    throw new Error('ElevenLabs TTS PVC setup flags require --elevenlabs-tts <model> or --all-tts.')
  }
  if (selection.elevenLabsPvcVoiceId && selection.elevenLabsVoiceId) {
    throw new Error('ElevenLabs TTS PVC voice cannot be combined with --elevenlabs-voice.')
  }
  if (selection.elevenLabsPvcVoiceId && selection.hasElevenLabsCloneFlags) {
    throw new Error('ElevenLabs TTS PVC voice cannot be combined with ElevenLabs IVC flags.')
  }
  if (selection.hasElevenLabsPvcSetupFlags && selection.hasElevenLabsCloneFlags) {
    throw new Error('ElevenLabs TTS PVC setup flags cannot be combined with ElevenLabs IVC flags.')
  }
  if (selection.hasElevenLabsPvcSetupFlags && selection.elevenLabsVoiceId) {
    throw new Error('ElevenLabs TTS PVC setup cannot be combined with --elevenlabs-voice.')
  }
  if ((selection.elevenLabsPvcLanguage || selection.elevenLabsPvcDescription || (selection.elevenLabsCloneVoiceName && selection.hasElevenLabsPvcActionFlags)) && !selection.elevenLabsPvcSampleDir && (!selection.elevenLabsPvcSamplePaths || selection.elevenLabsPvcSamplePaths.length === 0)) {
    throw new Error('ElevenLabs TTS PVC voice metadata requires --elevenlabs-tts-pvc-sample or --elevenlabs-tts-pvc-sample-dir.')
  }
  if (selection.elevenLabsPvcCaptchaOut && !selection.elevenLabsPvcVoiceId && !selection.elevenLabsPvcSampleDir && (!selection.elevenLabsPvcSamplePaths || selection.elevenLabsPvcSamplePaths.length === 0)) {
    throw new Error('ElevenLabs TTS PVC captcha output requires --elevenlabs-tts-pvc-voice or PVC samples that create a voice.')
  }
  if (selection.elevenLabsPvcVerifyAudio && !selection.elevenLabsPvcVoiceId && (!selection.elevenLabsPvcSamplePaths || selection.elevenLabsPvcSamplePaths.length === 0) && !selection.elevenLabsPvcSampleDir) {
    throw new Error('ElevenLabs TTS PVC verification requires --elevenlabs-tts-pvc-voice or PVC samples that create a voice.')
  }
  if (selection.elevenLabsPvcWait && !selection.elevenLabsPvcVoiceId && !selection.hasElevenLabsPvcActionFlags) {
    throw new Error('ElevenLabs TTS PVC wait requires --elevenlabs-tts-pvc-voice or PVC setup flags.')
  }
  if (selection.elevenLabsPvcWait && selection.hasElevenLabsPvcActionFlags && selection.elevenlabsModels.length > 1) {
    throw new Error('ElevenLabs TTS PVC setup with --elevenlabs-tts-pvc-wait supports one ElevenLabs model per run.')
  }
}
