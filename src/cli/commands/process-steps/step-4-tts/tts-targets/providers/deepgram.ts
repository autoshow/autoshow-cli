import type { DeepgramTtsModel, TtsTarget } from '~/types'
import {
  validateDeepgramTtsModel,
  validateDeepgramTtsVoice
} from '~/cli/commands/setup-and-utilities/models/model-options'
import { ensureDeepgramTtsSetup } from '../../tts-services/deepgram/deepgram-tts'
import { runDeepgramTts } from '../../tts-services/deepgram/run-deepgram-tts'
import type { TtsTargetSelection } from '../selection'

export const collectDeepgramTtsTargets = (
  selection: TtsTargetSelection
): TtsTarget[] => {
  const targets: TtsTarget[] = []
  for (const rawModel of selection.deepgramModels) {
    const model: DeepgramTtsModel = validateDeepgramTtsModel(rawModel)
    const voiceId = selection.deepgramVoiceId
      ? validateDeepgramTtsVoice(selection.deepgramVoiceId)
      : undefined

    targets.push({
      service: 'deepgram',
      model,
      ...(voiceId ? { voice: voiceId } : {}),
      run: async (text, outputDir, opts) => {
        await ensureDeepgramTtsSetup()
        return await runDeepgramTts(text, outputDir, {
          model,
          voiceId,
          encoding: selection.deepgramEncoding,
          container: selection.deepgramContainer,
          bitRate: selection.deepgramBitRate,
          sampleRate: selection.deepgramSampleRate,
          speed: selection.deepgramSpeed,
          chunkConcurrency: opts.ttsChunkConcurrency
        })
      }
    })
  }
  return targets
}
