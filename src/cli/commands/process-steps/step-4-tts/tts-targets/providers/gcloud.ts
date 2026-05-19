import type { GcloudTtsModel, TtsTarget } from '~/types'
import {
  GCLOUD_DEFAULT_TTS_VOICES,
  validateGcloudTtsModel,
  validateGcloudTtsVoice
} from '~/cli/commands/setup-and-utilities/models/model-options'
import { runGcloudTts } from '../../tts-services/gcloud/run-gcloud-tts'
import type { TtsTargetSelection } from '../selection'

export const collectGcloudTtsTargets = (
  selection: TtsTargetSelection
): TtsTarget[] => {
  const targets: TtsTarget[] = []
  for (const rawModel of selection.gcloudModels) {
    const model: GcloudTtsModel = validateGcloudTtsModel(rawModel)
    const voiceId = selection.gcloudVoiceId ? validateGcloudTtsVoice(selection.gcloudVoiceId) : undefined
    const language = selection.gcloudLanguage

    if (model === 'instant-custom-voice' && !selection.gcloudVoiceCloningKey && (!selection.gcloudRefAudioPath || !selection.gcloudConsentAudioPath)) {
      throw new Error('Google Cloud TTS instant-custom-voice requires --gcloud-tts-voice-cloning-key or both --gcloud-tts-ref-audio and --gcloud-tts-consent-audio.')
    }

    const defaultVoice = model === 'instant-custom-voice'
      ? 'instant-custom-voice'
      : GCLOUD_DEFAULT_TTS_VOICES[model]
    const speaker = model === 'instant-custom-voice'
      ? 'instant-custom-voice'
      : voiceId ?? defaultVoice

    targets.push({
      service: 'gcloud',
      model,
      voice: speaker,
      run: async (text, outputDir) => {
        return await runGcloudTts(text, outputDir, {
          model,
          voice: voiceId,
          language,
          refAudioPath: selection.gcloudRefAudioPath,
          consentAudioPath: selection.gcloudConsentAudioPath,
          consentLanguage: selection.gcloudConsentLanguage,
          voiceCloningKey: selection.gcloudVoiceCloningKey,
          voiceCloningKeyOut: selection.gcloudVoiceCloningKeyOut
        })
      }
    })
  }
  return targets
}
