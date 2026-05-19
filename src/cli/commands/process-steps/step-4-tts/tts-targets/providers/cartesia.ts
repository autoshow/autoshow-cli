import type { CartesiaTtsModel, TtsTarget } from '~/types'
import {
  validateCartesiaTtsModel,
  validateCartesiaTtsVoice
} from '~/cli/commands/setup-and-utilities/models/model-options'
import { ensureCartesiaTtsSetup } from '../../tts-services/cartesia/cartesia-tts'
import { runCartesiaTts } from '../../tts-services/cartesia/run-cartesia-tts'
import type { TtsTargetSelection } from '../selection'

export const collectCartesiaTtsTargets = (
  selection: TtsTargetSelection
): TtsTarget[] => {
  const targets: TtsTarget[] = []
  for (const rawModel of selection.cartesiaModels) {
    const model: CartesiaTtsModel = validateCartesiaTtsModel(rawModel)
    const voiceId = selection.cartesiaVoiceId ? validateCartesiaTtsVoice(selection.cartesiaVoiceId) : undefined

    targets.push({
      service: 'cartesia',
      model,
      ...(voiceId ? { voice: voiceId } : {}),
      run: async (text, outputDir) => {
        await ensureCartesiaTtsSetup()
        return await runCartesiaTts(text, outputDir, {
          model,
          voiceId,
          language: selection.cartesiaLanguage
        })
      }
    })
  }
  return targets
}
