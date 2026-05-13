import { basename } from 'node:path'
import type { MinimaxTtsModel, TtsOptions, TtsTarget } from '~/types'
import { validateMinimaxTtsModel } from '~/cli/commands/setup-and-utilities/models/model-options'
import {
  createMinimaxTtsCloneContext,
  MINIMAX_TTS_CLONE_COST_CENTS,
  MINIMAX_TTS_CLONE_SETUP_MS,
  runMinimaxTts,
  validateMinimaxTtsCloneVoiceId
} from '../../tts-services/minimax/run-minimax-tts'
import type { TtsTargetSelection } from '../selection'

export const collectMinimaxTtsTargets = (
  options: TtsOptions,
  selection: TtsTargetSelection
): TtsTarget[] => {
  const targets: TtsTarget[] = []
  const minimaxCloneContext = selection.minimaxCloneRefAudioPath ? createMinimaxTtsCloneContext() : undefined
  let minimaxCloneEstimateAttached = false

  for (const rawModel of selection.minimaxModels) {
    const model: MinimaxTtsModel = validateMinimaxTtsModel(rawModel)
    const rawVoiceId = selection.minimaxVoiceId
    const voiceId = selection.minimaxCloneRefAudioPath && rawVoiceId
      ? validateMinimaxTtsCloneVoiceId(rawVoiceId)
      : rawVoiceId
    const clone = selection.minimaxCloneRefAudioPath
      ? {
          refAudioPath: selection.minimaxCloneRefAudioPath,
          ...(voiceId ? { voiceId } : {}),
          ...(selection.minimaxClonePromptAudioPath ? { promptAudioPath: selection.minimaxClonePromptAudioPath } : {}),
          ...(selection.minimaxClonePromptText ? { promptText: selection.minimaxClonePromptText } : {}),
          needNoiseReduction: options.minimaxTtsCloneNoiseReduction === true,
          needVolumeNormalization: options.minimaxTtsCloneVolumeNormalization === true,
          context: minimaxCloneContext
        }
      : undefined
    const attachCloneEstimate = clone !== undefined && !minimaxCloneEstimateAttached
    if (attachCloneEstimate) {
      minimaxCloneEstimateAttached = true
    }

    targets.push({
      service: 'minimax',
      model,
      ...(clone ? { voice: `ref_audio:${basename(clone.refAudioPath)}` } : voiceId ? { voice: voiceId } : {}),
      ...(attachCloneEstimate
        ? {
            setupCostCents: MINIMAX_TTS_CLONE_COST_CENTS,
            setupTimeMs: MINIMAX_TTS_CLONE_SETUP_MS,
            setupNote: 'MiniMax rapid voice clone setup'
          }
        : {}),
      run: async (text, outputDir) => {
        return await runMinimaxTts(text, outputDir, {
          model,
          voiceId,
          clone,
          languageBoost: selection.minimaxLanguageBoost,
          speed: selection.minimaxSpeed,
          volume: selection.minimaxVolume,
          pitch: selection.minimaxPitch,
          emotion: selection.minimaxEmotion,
          englishNormalization: selection.minimaxEnglishNormalization,
          pronunciations: selection.minimaxPronunciations
        })
      }
    })
  }

  return targets
}
