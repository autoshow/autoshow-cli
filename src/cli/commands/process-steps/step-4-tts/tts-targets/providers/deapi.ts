import { basename } from 'node:path'
import type { DeapiTtsModel, TtsTarget } from '~/types'
import { validateDeapiTtsModel } from '~/cli/commands/setup-and-utilities/models/model-options'
import { DEAPI_TTS_VOICE_CLONE_MODEL, runDeapiTts } from '../../tts-services/deapi/run-deapi-tts'
import type { TtsTargetSelection } from '../selection'

export const collectDeapiTtsTargets = (
  selection: TtsTargetSelection
): TtsTarget[] => {
  const targets: TtsTarget[] = []
  for (const rawModel of selection.deapiModels) {
    const model: DeapiTtsModel = validateDeapiTtsModel(rawModel)
    const voiceId = selection.deapiVoiceId
    const refAudioPath = selection.deapiRefAudioPath
    const refText = selection.deapiRefText

    if (voiceId && refAudioPath) {
      throw new Error('deAPI TTS requires exactly one voice source. Use either --deapi-tts-voice or --deapi-tts-ref-audio, not both.')
    }
    if (refText && !refAudioPath) {
      throw new Error('deAPI TTS --deapi-tts-ref-text requires --deapi-tts-ref-audio.')
    }
    if (refAudioPath && model !== DEAPI_TTS_VOICE_CLONE_MODEL) {
      throw new Error(`deAPI TTS voice cloning is only supported for ${DEAPI_TTS_VOICE_CLONE_MODEL}.`)
    }
    if (model === DEAPI_TTS_VOICE_CLONE_MODEL && !refAudioPath) {
      throw new Error(`deAPI TTS model ${DEAPI_TTS_VOICE_CLONE_MODEL} requires --deapi-tts-ref-audio.`)
    }
    if (model === 'Qwen3_TTS_12Hz_1_7B_VoiceDesign') {
      throw new Error('deAPI TTS model Qwen3_TTS_12Hz_1_7B_VoiceDesign is not yet supported because it requires voice design instruction inputs.')
    }

    targets.push({
      service: 'deapi',
      model,
      ...(voiceId ? { voice: voiceId } : refAudioPath ? { voice: `ref_audio:${basename(refAudioPath)}` } : {}),
      run: async (text, outputDir) => {
        return await runDeapiTts(text, outputDir, { model, voiceId, refAudioPath, refText })
      }
    })
  }
  return targets
}
