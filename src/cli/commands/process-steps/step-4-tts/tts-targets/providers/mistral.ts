import { basename } from 'node:path'
import type { MistralTtsModel, TtsOptions, TtsTarget } from '~/types'
import { validateMistralTtsModel } from '~/cli/commands/setup-and-utilities/models/model-options'
import { runMistralTts } from '../../tts-services/mistral/run-mistral-tts'
import type { TtsTargetSelection } from '../selection'

const trimmed = (value: string | undefined): string | undefined => value?.trim() || undefined

const resolveRuntimeMistralVoiceOptions = (
  opts: TtsOptions
): { voiceId: string | undefined, refAudioPath: string | undefined, voiceName: string | undefined } => ({
  voiceId: trimmed(opts.mistralTtsVoice),
  refAudioPath: trimmed(opts.mistralTtsRefAudio),
  voiceName: trimmed(opts.mistralTtsVoiceName)
})

export const collectMistralTtsTargets = (
  selection: TtsTargetSelection
): TtsTarget[] => {
  const targets: TtsTarget[] = []
  for (const rawModel of selection.mistralModels) {
    const model: MistralTtsModel = validateMistralTtsModel(rawModel)
    const voiceId = selection.mistralVoiceId
    const refAudioPath = selection.mistralRefAudioPath
    const voiceName = selection.mistralVoiceName
    if (voiceId && refAudioPath) {
      throw new Error('Mistral TTS requires exactly one voice source. Use either --mistral-tts-voice or --mistral-tts-ref-audio, not both.')
    }
    if (voiceName && !refAudioPath) {
      throw new Error('Mistral TTS --mistral-tts-voice-name requires --mistral-tts-ref-audio.')
    }
    if (voiceName && voiceId) {
      throw new Error('Mistral TTS saved voice creation cannot be combined with --mistral-tts-voice.')
    }

    targets.push({
      service: 'mistral',
      model,
      ...(voiceId ? { voice: voiceId } : refAudioPath ? { voice: voiceName ? `saved_voice:${voiceName}` : `ref_audio:${basename(refAudioPath)}` } : {}),
      run: async (text, outputDir, opts) => {
        return await runMistralTts(text, outputDir, {
          model,
          ...resolveRuntimeMistralVoiceOptions(opts)
        })
      }
    })
  }
  return targets
}
