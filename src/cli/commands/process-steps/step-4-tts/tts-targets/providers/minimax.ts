import type { MinimaxTtsModel, TtsTarget } from '~/types'
import { validateMinimaxTtsModel } from '~/cli/commands/setup-and-utilities/models/model-options'
import { runMinimaxTts } from '../../tts-services/minimax/run-minimax-tts'
import type { TtsTargetSelection } from '../selection'

export const collectMinimaxTtsTargets = (
  selection: TtsTargetSelection
): TtsTarget[] => {
  const targets: TtsTarget[] = []

  for (const rawModel of selection.minimaxModels) {
    const model: MinimaxTtsModel = validateMinimaxTtsModel(rawModel)
    const voiceId = selection.minimaxVoiceId

    targets.push({
      service: 'minimax',
      model,
      ...(voiceId ? { voice: voiceId } : {}),
      run: async (text, outputDir) => {
        return await runMinimaxTts(text, outputDir, {
          model,
          voiceId,
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
