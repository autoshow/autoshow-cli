import type { RunwayTtsModel, TtsTarget } from '~/types'
import {
  validateRunwayTtsModel,
  validateRunwayTtsVoice
} from '~/cli/commands/setup-and-utilities/models/model-options'
import { ensureRunwayTtsSetup } from '../../tts-services/runway/runway-tts'
import { runRunwayTts } from '../../tts-services/runway/run-runway-tts'
import type { TtsTargetSelection } from '../selection'

export const collectRunwayTtsTargets = (
  selection: TtsTargetSelection
): TtsTarget[] => {
  const targets: TtsTarget[] = []
  for (const rawModel of selection.runwayModels) {
    const model: RunwayTtsModel = validateRunwayTtsModel(rawModel)
    const voiceId = selection.runwayVoiceId ? validateRunwayTtsVoice(selection.runwayVoiceId) : undefined

    targets.push({
      service: 'runway',
      model,
      ...(voiceId ? { voice: voiceId } : {}),
      run: async (text, outputDir) => {
        await ensureRunwayTtsSetup()
        return await runRunwayTts(text, outputDir, { model, voiceId })
      }
    })
  }
  return targets
}
