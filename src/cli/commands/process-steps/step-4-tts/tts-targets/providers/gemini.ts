import type { GeminiTtsModel, TtsTarget } from '~/types'
import { validateGeminiTtsModel } from '~/cli/commands/setup-and-utilities/models/model-options'
import { ensureGeminiTtsSetup } from '../../tts-services/gemini/gemini-tts'
import { runGeminiTts } from '../../tts-services/gemini/run-gemini-tts'
import { formatGeminiSpeakerSummary, formatSpeakerRegistrySummary } from '../../tts-services/gemini/gemini-tts-config'
import type { TtsTargetSelection } from '../selection'

export const collectGeminiTtsTargets = (
  selection: TtsTargetSelection
): TtsTarget[] => {
  const targets: TtsTarget[] = []
  for (const rawModel of selection.geminiModels) {
    const model: GeminiTtsModel = validateGeminiTtsModel(rawModel)
    const voiceId = selection.geminiVoiceId
    const registry = selection.speakerVoiceRegistry
    const multiSpeakerConfig = selection.geminiMultiSpeakerConfig
    const speaker = registry
      ? formatSpeakerRegistrySummary(registry)
      : multiSpeakerConfig
        ? formatGeminiSpeakerSummary(multiSpeakerConfig)
        : voiceId

    targets.push({
      service: 'gemini',
      model,
      ...(speaker ? { voice: speaker } : {}),
      run: async (text, outputDir) => {
        await ensureGeminiTtsSetup()
        return await runGeminiTts(text, outputDir, {
          model,
          voiceId,
          multiSpeakerConfig,
          speakerVoiceRegistry: registry
        })
      }
    })
  }
  return targets
}
