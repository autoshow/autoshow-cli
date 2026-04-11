import type { Step4Metadata, TtsProvider } from '~/types'
import * as l from '~/logger'

type FinalizeTtsRunOptions = {
  service: TtsProvider
  model: string
  speaker?: string | undefined
  audioPath: string
  chunkCount: number
  startTime: number
}

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
