import { basename } from 'node:path'
import type { SpeechifyTtsModel, TtsTarget } from '~/types'
import {
  validateSpeechifyTtsModel,
  validateSpeechifyTtsVoice
} from '~/cli/commands/setup-and-utilities/models/model-options'
import { ensureSpeechifyTtsSetup } from '../../tts-services/speechify/speechify-tts'
import { runSpeechifyTts } from '../../tts-services/speechify/run-speechify-tts'
import {
  createSpeechifyTtsCustomVoiceContext,
  SPEECHIFY_TTS_CUSTOM_VOICE_COST_CENTS,
  SPEECHIFY_TTS_CUSTOM_VOICE_SETUP_MS,
  SPEECHIFY_TTS_CUSTOM_VOICE_SETUP_NOTE
} from '../../tts-services/speechify/speechify-custom-voices'
import type { TtsTargetSelection } from '../selection'

export const collectSpeechifyTtsTargets = (
  selection: TtsTargetSelection
): TtsTarget[] => {
  const targets: TtsTarget[] = []
  const speechifyCustomVoiceContext = selection.speechifyCustomVoiceRefAudioPath ? createSpeechifyTtsCustomVoiceContext() : undefined
  let speechifyCustomVoiceEstimateAttached = false

  for (const rawModel of selection.speechifyModels) {
    const model: SpeechifyTtsModel = validateSpeechifyTtsModel(rawModel)
    const voiceId = selection.speechifyVoiceId ? validateSpeechifyTtsVoice(selection.speechifyVoiceId) : undefined
    const customVoice = selection.speechifyCustomVoiceRefAudioPath
      ? {
          refAudioPath: selection.speechifyCustomVoiceRefAudioPath,
          ...(selection.speechifyCustomVoiceName ? { voiceName: selection.speechifyCustomVoiceName } : {}),
          ...(selection.speechifyCustomVoiceConsentName ? { consentName: selection.speechifyCustomVoiceConsentName } : {}),
          ...(selection.speechifyCustomVoiceConsentEmail ? { consentEmail: selection.speechifyCustomVoiceConsentEmail } : {}),
          ...(selection.speechifyCustomVoiceLocale ? { locale: selection.speechifyCustomVoiceLocale } : {}),
          ...(selection.speechifyCustomVoiceGender ? { gender: selection.speechifyCustomVoiceGender } : {}),
          context: speechifyCustomVoiceContext
        }
      : undefined
    const attachCustomVoiceEstimate = customVoice !== undefined && !speechifyCustomVoiceEstimateAttached
    if (attachCustomVoiceEstimate) {
      speechifyCustomVoiceEstimateAttached = true
    }

    targets.push({
      service: 'speechify',
      model,
      ...(customVoice ? { voice: `ref_audio:${basename(customVoice.refAudioPath)}` } : voiceId ? { voice: voiceId } : {}),
      ...(attachCustomVoiceEstimate
        ? {
            setupCostCents: SPEECHIFY_TTS_CUSTOM_VOICE_COST_CENTS,
            setupTimeMs: SPEECHIFY_TTS_CUSTOM_VOICE_SETUP_MS,
            setupNote: SPEECHIFY_TTS_CUSTOM_VOICE_SETUP_NOTE
          }
        : {}),
      run: async (text, outputDir, opts) => {
        await ensureSpeechifyTtsSetup()
        return await runSpeechifyTts(text, outputDir, {
          model,
          voiceId,
          customVoice,
          audioFormat: selection.speechifyAudioFormat,
          language: selection.speechifyLanguage,
          chunkConcurrency: opts.ttsChunkConcurrency
        })
      }
    })
  }

  return targets
}
