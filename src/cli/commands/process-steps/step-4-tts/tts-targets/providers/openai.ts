import { basename } from 'node:path'
import type { OpenAITtsModel, TtsTarget } from '~/types'
import { validateOpenAITtsModel } from '~/cli/commands/setup-and-utilities/models/model-options'
import { ensureOpenAITtsSetup } from '../../tts-services/openai/openai-tts'
import { runOpenAITts } from '../../tts-services/openai/run-openai-tts'
import {
  createOpenAITtsCustomVoiceContext,
  OPENAI_TTS_CLONE_COST_CENTS,
  OPENAI_TTS_CLONE_SETUP_MS,
  OPENAI_TTS_CLONE_SETUP_NOTE
} from '../../tts-services/openai/openai-custom-voices'
import type { TtsTargetSelection } from '../selection'

export const collectOpenAITtsTargets = (
  selection: TtsTargetSelection
): TtsTarget[] => {
  const targets: TtsTarget[] = []
  const openaiCloneContext = selection.openaiCloneRefAudioPath ? createOpenAITtsCustomVoiceContext() : undefined
  let openaiCloneEstimateAttached = false

  for (const rawModel of selection.openaiModels) {
    const model: OpenAITtsModel = validateOpenAITtsModel(rawModel)
    const voiceId = selection.openaiVoiceId
    const clone = selection.openaiCloneRefAudioPath
      ? {
          refAudioPath: selection.openaiCloneRefAudioPath,
          ...(selection.openaiCloneConsentId ? { consentId: selection.openaiCloneConsentId } : {}),
          ...(selection.openaiCloneConsentAudioPath ? { consentAudioPath: selection.openaiCloneConsentAudioPath } : {}),
          ...(selection.openaiCloneConsentLanguage ? { consentLanguage: selection.openaiCloneConsentLanguage } : {}),
          ...(selection.openaiCloneConsentName ? { consentName: selection.openaiCloneConsentName } : {}),
          ...(selection.openaiCloneVoiceName ? { voiceName: selection.openaiCloneVoiceName } : {}),
          context: openaiCloneContext
        }
      : undefined
    const attachCloneEstimate = clone !== undefined && !openaiCloneEstimateAttached
    if (attachCloneEstimate) {
      openaiCloneEstimateAttached = true
    }

    targets.push({
      service: 'openai',
      model,
      ...(clone ? { voice: `ref_audio:${basename(clone.refAudioPath)}` } : voiceId ? { voice: voiceId } : {}),
      ...(attachCloneEstimate
        ? {
            setupCostCents: OPENAI_TTS_CLONE_COST_CENTS,
            setupTimeMs: OPENAI_TTS_CLONE_SETUP_MS,
            setupNote: OPENAI_TTS_CLONE_SETUP_NOTE
          }
        : {}),
      run: async (text, outputDir) => {
        await ensureOpenAITtsSetup()
        return await runOpenAITts(text, outputDir, {
          model,
          voiceId,
          clone,
          instructions: selection.openaiInstructions,
          speed: selection.openaiSpeed
        })
      }
    })
  }

  return targets
}
