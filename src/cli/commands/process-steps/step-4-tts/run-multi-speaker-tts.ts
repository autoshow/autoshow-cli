import { rename, rm } from 'node:fs/promises'
import type { Step4Metadata, TtsOptions, TtsTarget } from '~/types'
import { ensureDirectory } from '~/utils/cli-utils'
import { concatAndConvertToWav } from './tts-utils/audio-utils'
import { finalizeTtsRun } from './tts-utils/finalize-tts-run'
import {
  normalizeDialogueText,
  parseSpeakerRefAudioMappings,
  parseSpeakerVoiceMappings,
  resolveDialogueFormat,
  formatSpeakerVoiceSummary,
  getSpeakerVoice,
} from './dialogue-normalizer'
import { overrideVoiceForProvider } from './tts-targets/multi-speaker-capability'

const sanitizeSegmentName = (value: string): string =>
  value.replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/^-+|-+$/g, '') || 'speaker'

export const runMultiSpeakerTts = async (
  text: string,
  outputDir: string,
  target: TtsTarget,
  options: TtsOptions
): Promise<{ audioPath: string, metadata: Step4Metadata }> => {
  const strategy = target.multiSpeakerStrategy ?? 'segment-and-concat'

  const registry = (options.ttsSpeakers?.length ?? 0) > 0
    ? parseSpeakerVoiceMappings(options.ttsSpeakers)
    : parseSpeakerRefAudioMappings(options.ttsSpeakerRefAudios)

  if (strategy === 'native') {
    return await target.run(text, outputDir, options)
  }

  const startTime = Date.now()
  const format = resolveDialogueFormat(options)
  const dialogue = normalizeDialogueText(text, format, registry)
  const normalizedPath = `${outputDir}/dialogue-normalized.txt`
  const segmentsDir = `${outputDir}/segments`
  const segmentPaths: string[] = []

  await Bun.write(normalizedPath, `${dialogue.normalizedText}\n`)
  await ensureDirectory(segmentsDir)

  for (let i = 0; i < dialogue.turns.length; i++) {
    const turn = dialogue.turns[i] as { speaker: string, text: string }
    const speakerMapping = getSpeakerVoice(registry, turn.speaker)
    const index = String(i + 1).padStart(3, '0')
    const segmentFileName = `segment-${index}-${sanitizeSegmentName(turn.speaker)}.wav`
    const segmentPath = `${segmentsDir}/${segmentFileName}`
    const workspaceDir = `${segmentsDir}/.work-${index}-${sanitizeSegmentName(turn.speaker)}`

    await ensureDirectory(workspaceDir)
    try {
      const overriddenOpts = overrideVoiceForProvider(target.service, options, speakerMapping)
      const result = await target.run(turn.text, workspaceDir, overriddenOpts)
      await rename(result.audioPath, segmentPath)
      segmentPaths.push(segmentPath)
    } finally {
      await rm(workspaceDir, { recursive: true, force: true })
    }
  }

  const audioPath = await concatAndConvertToWav(segmentPaths, outputDir, target.service)
  return finalizeTtsRun({
    service: target.service,
    model: target.model,
    speaker: formatSpeakerVoiceSummary(registry),
    audioPath,
    chunkCount: dialogue.turns.length,
    startTime
  })
}
