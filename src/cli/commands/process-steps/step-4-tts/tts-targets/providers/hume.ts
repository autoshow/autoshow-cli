import type { HumeTtsModel, TtsTarget } from '~/types'
import {
  validateHumeTtsModel,
  validateHumeTtsVoice,
  validateHumeTtsVoiceProvider
} from '~/cli/commands/setup-and-utilities/models/model-options'
import { ensureHumeTtsSetup } from '../../tts-services/hume/hume-tts'
import { runHumeTts } from '../../tts-services/hume/run-hume-tts'
import type { TtsTargetSelection } from '../selection'

export const collectHumeTtsTargets = (
  selection: TtsTargetSelection
): TtsTarget[] => {
  const targets: TtsTarget[] = []
  for (const rawModel of selection.humeModels) {
    const model: HumeTtsModel = validateHumeTtsModel(rawModel)
    const voice = selection.humeVoice ? validateHumeTtsVoice(selection.humeVoice) : undefined
    const voiceProvider = selection.humeVoiceProvider ? validateHumeTtsVoiceProvider(selection.humeVoiceProvider) : undefined

    targets.push({
      service: 'hume',
      model,
      ...(voice ? { voice } : {}),
      run: async (text, outputDir, opts) => {
        await ensureHumeTtsSetup()
        return await runHumeTts(text, outputDir, {
          model,
          voice,
          voiceProvider,
          chunkConcurrency: opts.ttsChunkConcurrency
        })
      }
    })
  }
  return targets
}
