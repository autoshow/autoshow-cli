import type { GrokTtsModel, TtsTarget } from '~/types'
import {
  validateGrokTtsModel,
  validateGrokTtsVoice
} from '~/cli/commands/setup-and-utilities/models/model-options'
import { ensureGrokTtsSetup } from '../../tts-services/grok/grok-tts'
import { runGrokTts } from '../../tts-services/grok/run-grok-tts'
import type { TtsTargetSelection } from '../selection'

export const collectGrokTtsTargets = (
  selection: TtsTargetSelection
): TtsTarget[] => {
  const targets: TtsTarget[] = []
  for (const rawModel of selection.grokModels) {
    const model: GrokTtsModel = validateGrokTtsModel(rawModel)
    const voiceId = selection.grokVoiceId ? validateGrokTtsVoice(selection.grokVoiceId) : undefined

    targets.push({
      service: 'grok',
      model,
      ...(voiceId ? { voice: voiceId } : {}),
      run: async (text, outputDir) => {
        await ensureGrokTtsSetup()
        return await runGrokTts(text, outputDir, { model, voiceId })
      }
    })
  }
  return targets
}
