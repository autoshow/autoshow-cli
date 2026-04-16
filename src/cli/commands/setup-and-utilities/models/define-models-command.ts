import { defineCommand } from 'clerc'
import { SUPPORTED_WHISPER_MODELS, validateWhisperModel } from '~/cli/commands/setup-and-utilities/models/model-options'
import { ensureLlamaModelDownloaded } from '~/cli/commands/process-steps/step-3-write/write-local/llama/run-llama'
import { downloadWhisperModel } from '~/cli/commands/process-steps/step-2-stt/stt-local/whisper/whisper'
import * as l from '~/logger'

const runLlamaModelDownload = async (ctx: { parameters: { model: string } }): Promise<void> => {
  const model = ctx.parameters.model
  const isWhisperModel = SUPPORTED_WHISPER_MODELS.includes(model as typeof SUPPORTED_WHISPER_MODELS[number])

  if (isWhisperModel) {
    const whisperModel = validateWhisperModel(model)
    l.info(`Downloading whisper model: ${whisperModel}`)
    await downloadWhisperModel(whisperModel)
    l.success(`Download complete: ${whisperModel}`)
    return
  }

  l.info(`Downloading llama model: ${model}`)
  await ensureLlamaModelDownloaded(model)
  l.success(`Download complete: ${model}`)
}

export const modelsCommand = defineCommand({
  name: 'models',
  description: 'Download a model without running inference (llama.cpp repo ID or whisper model ID)',
  parameters: [{ key: '<model>', description: 'llama repo (e.g. ggml-org/gemma-3-270m-it-GGUF) or whisper model (e.g. tiny)' }],
  help: {
    examples: [
      ['bun as models ggml-org/gemma-3-270m-it-GGUF', 'Download a llama.cpp model'],
      ['bun as models base', 'Download whisper base model']
    ]
  }
}, runLlamaModelDownload)
