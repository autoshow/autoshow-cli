import type { FinalizeTtsRunOptions, Step4Metadata } from '~/types'
import * as l from '~/logger'

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

  l.success(`Speech saved to ${audioPath}`)

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
