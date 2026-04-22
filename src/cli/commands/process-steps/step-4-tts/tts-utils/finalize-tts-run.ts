import type { FinalizeTtsRunOptions, Step4Metadata } from '~/types'
import * as l from '~/logger'
import { logLocationsTable } from '~/logger/human-table'

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
