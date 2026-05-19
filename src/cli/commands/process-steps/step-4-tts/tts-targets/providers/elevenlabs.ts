import { basename } from 'node:path'
import type { ElevenlabsTtsModel, TtsTarget } from '~/types'
import { validateElevenlabsTtsModel } from '~/cli/commands/setup-and-utilities/models/model-options'
import { ensureElevenLabsTtsSetup } from '../../tts-services/elevenlabs/elevenlabs-tts'
import { runElevenLabsTts } from '../../tts-services/elevenlabs/run-elevenlabs-tts'
import {
  createElevenLabsTtsIvcContext,
  ELEVENLABS_TTS_IVC_COST_CENTS,
  ELEVENLABS_TTS_IVC_SETUP_MS,
  ELEVENLABS_TTS_IVC_SETUP_NOTE
} from '../../tts-services/elevenlabs/elevenlabs-ivc'
import {
  ELEVENLABS_TTS_PVC_COST_CENTS,
  ELEVENLABS_TTS_PVC_SETUP_NOTE,
  getElevenLabsTtsPvcSetupMs
} from '../../tts-services/elevenlabs/elevenlabs-pvc'
import type { TtsTargetSelection } from '../selection'

export const collectElevenLabsTtsTargets = (
  selection: TtsTargetSelection
): TtsTarget[] => {
  const targets: TtsTarget[] = []
  const elevenLabsCloneContext = selection.elevenLabsCloneRefAudioPath ? createElevenLabsTtsIvcContext() : undefined
  let elevenLabsCloneEstimateAttached = false
  let elevenLabsPvcEstimateAttached = false

  for (const rawModel of selection.elevenlabsModels) {
    const model: ElevenlabsTtsModel = validateElevenlabsTtsModel(rawModel)
    const voiceId = selection.elevenLabsVoiceId
    const pvcVoiceId = selection.elevenLabsPvcVoiceId
    const clone = selection.elevenLabsCloneRefAudioPath
      ? {
          refAudioPath: selection.elevenLabsCloneRefAudioPath,
          ...(selection.elevenLabsCloneVoiceName ? { voiceName: selection.elevenLabsCloneVoiceName } : {}),
          removeBackgroundNoise: selection.elevenLabsCloneRemoveBackgroundNoise,
          context: elevenLabsCloneContext
        }
      : undefined
    const attachCloneEstimate = clone !== undefined && !elevenLabsCloneEstimateAttached
    if (attachCloneEstimate) {
      elevenLabsCloneEstimateAttached = true
    }
    const attachPvcEstimate = !clone && (selection.hasElevenLabsPvcSetupFlags || selection.elevenLabsPvcWait) && !elevenLabsPvcEstimateAttached
    if (attachPvcEstimate) {
      elevenLabsPvcEstimateAttached = true
    }
    const pvcSetupTimeMs = selection.elevenLabsPvcWait
      ? getElevenLabsTtsPvcSetupMs(selection.elevenLabsPvcLanguage)
      : undefined

    targets.push({
      service: 'elevenlabs',
      model,
      ...(clone
        ? { voice: `ref_audio:${basename(clone.refAudioPath)}` }
        : pvcVoiceId
          ? { voice: `pvc:${pvcVoiceId}` }
          : selection.hasElevenLabsPvcSetupFlags
            ? { voice: `pvc_setup:${selection.elevenLabsCloneVoiceName ?? 'new'}` }
            : voiceId ? { voice: voiceId } : {}),
      ...(attachCloneEstimate
        ? {
            setupCostCents: ELEVENLABS_TTS_IVC_COST_CENTS,
            setupTimeMs: ELEVENLABS_TTS_IVC_SETUP_MS,
            setupNote: ELEVENLABS_TTS_IVC_SETUP_NOTE
          }
        : {}),
      ...(attachPvcEstimate
        ? {
            setupCostCents: ELEVENLABS_TTS_PVC_COST_CENTS,
            ...(typeof pvcSetupTimeMs === 'number' ? { setupTimeMs: pvcSetupTimeMs } : {}),
            setupNote: ELEVENLABS_TTS_PVC_SETUP_NOTE
          }
        : {}),
      run: async (text, outputDir) => {
        await ensureElevenLabsTtsSetup()
        return await runElevenLabsTts(text, outputDir, {
          model,
          voiceId,
          pvcVoiceId,
          pvcWait: selection.elevenLabsPvcWait,
          clone,
          controls: {
            outputFormat: selection.elevenLabsOutputFormat,
            languageCode: selection.elevenLabsLanguageCode,
            voiceSettings: {
              stability: selection.elevenLabsStability,
              similarity_boost: selection.elevenLabsSimilarityBoost,
              style: selection.elevenLabsStyle,
              ...(selection.elevenLabsUseSpeakerBoost ? { use_speaker_boost: true } : {}),
              speed: selection.elevenLabsSpeed
            },
            seed: selection.elevenLabsSeed,
            textNormalization: selection.elevenLabsTextNormalization,
            pronunciationDictionaryLocators: selection.elevenLabsPronunciationDictionaryLocators,
            optimizeStreamingLatency: selection.elevenLabsOptimizeStreamingLatency,
            pvcAsIvc: selection.elevenLabsPvcAsIvc
          }
        })
      }
    })
  }

  return targets
}
