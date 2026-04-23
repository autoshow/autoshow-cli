import { SUPPORTED_WHISPER_MODELS, validateWhisperModel } from '~/cli/commands/setup-and-utilities/models/model-options'
import { ensureLlamaModelDownloaded } from '~/cli/commands/process-steps/step-3-write/write-local/llama/run-llama'
import { downloadWhisperModel } from '~/cli/commands/process-steps/step-2-stt/bootstrap'
import * as l from '~/logger'

const runModelDownload = async (model: string): Promise<void> => {
  const trimmedModel = model.trim()
  const isWhisperModel = SUPPORTED_WHISPER_MODELS.includes(trimmedModel as typeof SUPPORTED_WHISPER_MODELS[number])

  if (isWhisperModel) {
    const whisperModel = validateWhisperModel(trimmedModel)
    l.write('info', `Downloading whisper model: ${whisperModel}`)
    await downloadWhisperModel(whisperModel)
    l.write('success', `Download complete: ${whisperModel}`)
    return
  }

  l.write('info', `Downloading llama model: ${trimmedModel}`)
  await ensureLlamaModelDownloaded(trimmedModel)
  l.write('success', `Download complete: ${trimmedModel}`)
}

export const runModelDownloads = async (models: readonly string[]): Promise<void> => {
  for (const model of models) {
    await runModelDownload(model)
  }
}
