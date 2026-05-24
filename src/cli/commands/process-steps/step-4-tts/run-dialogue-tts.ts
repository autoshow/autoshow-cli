import { rename, rm } from 'node:fs/promises'
import type { MistralTtsModel, Step4Metadata, TtsOptions } from '~/types'
import { ensureDirectory } from '~/utils/cli-utils'
import { validateMistralTtsModel } from '~/cli/commands/setup-and-utilities/models/model-options'
import { concatAndConvertToWav } from './tts-utils/audio-utils'
import { finalizeTtsRun } from './tts-utils/finalize-tts-run'
import { runMistralTts } from './tts-services/mistral/run-mistral-tts'
import {
  formatSpeakerRefAudioSummary,
  getSpeakerRefAudio,
  normalizeDialogueText,
  parseSpeakerRefAudioMappings,
  resolveDialogueFormat
} from './dialogue-normalizer'

const sanitizeSegmentName = (value: string): string =>
  value.replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/^-+|-+$/g, '') || 'speaker'

const resolveDialogueMistralModel = (options: TtsOptions): MistralTtsModel => {
  const models = options.mistralTtsModels ?? (options.mistralTtsModel ? [options.mistralTtsModel] : [])
  if (models.length !== 1 || !models[0]) {
    throw new Error('Dialogue TTS requires exactly one Mistral TTS model selection.')
  }
  return validateMistralTtsModel(models[0])
}

export const runDialogueTts = async (
  text: string,
  outputDir: string,
  options: TtsOptions
): Promise<{ audioPath: string, metadata: Step4Metadata }> => {
  const startTime = Date.now()
  const model = resolveDialogueMistralModel(options)
  const registry = parseSpeakerRefAudioMappings(options.ttsSpeakerRefAudios)
  const dialogue = normalizeDialogueText(text, resolveDialogueFormat(options), registry)
  const normalizedPath = `${outputDir}/dialogue-normalized.txt`
  const segmentsDir = `${outputDir}/segments`
  const segmentPaths: string[] = []

  await Bun.write(normalizedPath, `${dialogue.normalizedText}\n`)
  await ensureDirectory(segmentsDir)

  for (let i = 0; i < dialogue.turns.length; i++) {
    const turn = dialogue.turns[i] as { speaker: string, text: string }
    const speakerRef = getSpeakerRefAudio(registry, turn.speaker)
    const index = String(i + 1).padStart(3, '0')
    const segmentFileName = `segment-${index}-${sanitizeSegmentName(turn.speaker)}.wav`
    const segmentPath = `${segmentsDir}/${segmentFileName}`
    const workspaceDir = `${segmentsDir}/.work-${index}-${sanitizeSegmentName(turn.speaker)}`

    await ensureDirectory(workspaceDir)
    try {
      const result = await runMistralTts(turn.text, workspaceDir, {
        model,
        refAudioPath: speakerRef.voice
      })
      await rename(result.audioPath, segmentPath)
      segmentPaths.push(segmentPath)
    } finally {
      await rm(workspaceDir, { recursive: true, force: true })
    }
  }

  const audioPath = await concatAndConvertToWav(segmentPaths, outputDir, 'MistralDialogue')
  return finalizeTtsRun({
    service: 'mistral',
    model,
    speaker: formatSpeakerRefAudioSummary(registry),
    audioPath,
    chunkCount: dialogue.turns.length,
    startTime
  })
}
