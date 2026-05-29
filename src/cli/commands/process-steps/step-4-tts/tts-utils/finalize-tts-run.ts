import * as l from '~/utils/logger'
import type { FinalizeTtsRunOptions, Step4Metadata } from '~/types'
import { logLocationsTable } from '~/utils/logger/human-table'
import { logMediaGenerationStatus } from '~/cli/commands/process-steps/generation-command-utils'

export const finalizeTtsRun = ({
  service,
  model,
  speaker,
  audioPath,
  chunkCount,
  startTime
}: FinalizeTtsRunOptions): { audioPath: string, metadata: Step4Metadata } => {
  const processingTime = Date.now() - startTime
  const audioFile = Bun.file(audioPath)

  logMediaGenerationStatus(l, {
    mediaType: 'tts',
    provider: service,
    model,
    status: 'completed',
    processingTimeMs: processingTime,
    outputCount: chunkCount,
    ...(speaker ? { detail: `speaker: ${speaker}` } : {})
  })
  logLocationsTable(l, [{ artifact: 'speech', path: audioPath }], { level: 'success' })

  return {
    audioPath,
    metadata: {
      ttsService: service,
      ttsModel: model,
      ...(speaker ? { speaker } : {}),
      processingTime,
      audioFileName: 'speech.wav',
      audioFileSize: audioFile.size,
      chunkCount
    }
  }
}
