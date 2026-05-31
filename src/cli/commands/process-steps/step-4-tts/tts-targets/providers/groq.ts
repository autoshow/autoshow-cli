import type { GroqTtsModel, TtsTarget } from '~/types'
import {
  getGroqDefaultTtsVoiceForModel,
  validateGroqTtsModel,
  validateGroqTtsVoice,
  validateGroqTtsVoiceForModel
} from '~/cli/commands/setup-and-utilities/models/model-options'
import { ensureGroqTtsSetup } from '../../tts-services/groq/groq-tts'
import { runGroqTts } from '../../tts-services/groq/run-groq-tts'
import type { TtsTargetSelection } from '../selection'

export const collectGroqTtsTargets = (
  selection: TtsTargetSelection
): TtsTarget[] => {
  const targets: TtsTarget[] = []
  for (const rawModel of selection.groqModels) {
    const model: GroqTtsModel = validateGroqTtsModel(rawModel)
    const voiceId = selection.groqVoiceId ? validateGroqTtsVoice(selection.groqVoiceId) : undefined
    const targetVoice = voiceId
      ? validateGroqTtsVoiceForModel(model, voiceId)
      : getGroqDefaultTtsVoiceForModel(model)

    targets.push({
      service: 'groq',
      model,
      voice: targetVoice,
      run: async (text, outputDir, opts) => {
        await ensureGroqTtsSetup()
        return await runGroqTts(text, outputDir, {
          model,
          voiceId,
          chunkConcurrency: opts.ttsChunkConcurrency
        })
      }
    })
  }
  return targets
}
