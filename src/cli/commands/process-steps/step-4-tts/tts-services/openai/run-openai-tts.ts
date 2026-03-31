import OpenAI from 'openai'
import type { Step4Metadata } from '~/types'
import * as l from '~/logger'
import { logTtsConfig } from '~/cli/commands/process-steps/step-4-tts/tts-utils/log-tts-config'
import { splitTextIntoChunks, concatAndConvertToWav } from '~/cli/commands/process-steps/step-4-tts/tts-utils/audio-utils'
import { OPENAI_DEFAULT_TTS_VOICE, type OpenAITtsModel } from '~/cli/commands/models/model-options'
import { readEnv } from '~/utils/validate/env-utils'
import { getOpenAIClientConfig } from '~/utils/openai-utils'

const MAX_CHARS_PER_CHUNK = 4000

export const runOpenAITts = async (
  text: string,
  outputDir: string,
  options: { model: OpenAITtsModel, voiceId?: string | undefined }
): Promise<{ audioPath: string, metadata: Step4Metadata }> => {
  const config = getOpenAIClientConfig()
  const client = new OpenAI({ apiKey: config.apiKey, maxRetries: 0, ...(config.baseURL ? { baseURL: config.baseURL } : {}) })
  const voiceId = options.voiceId?.trim() || readEnv('OPENAI_TTS_VOICE') || OPENAI_DEFAULT_TTS_VOICE
  const chunks = splitTextIntoChunks(text, MAX_CHARS_PER_CHUNK)

  if (chunks.length === 0) {
    throw new Error('OpenAI TTS input text is empty')
  }

  logTtsConfig('OpenAI', [
    { label: 'model', value: options.model },
    { label: 'voice', value: voiceId },
    { label: 'chunk count', value: chunks.length }
  ])

  const startTime = Date.now()
  const chunkPaths: string[] = []

  for (let i = 0; i < chunks.length; i++) {
    const chunkPath = `${outputDir}/speech-openai-chunk-${String(i + 1).padStart(3, '0')}.wav`
    const response = await client.audio.speech.create({
      model: options.model,
      voice: voiceId,
      input: chunks[i] as string,
      response_format: 'wav'
    })
    const bytes = new Uint8Array(await response.arrayBuffer())
    if (bytes.byteLength === 0) {
      throw new Error('OpenAI TTS returned empty audio')
    }
    await Bun.write(chunkPath, bytes)
    chunkPaths.push(chunkPath)
  }

  const audioPath = await concatAndConvertToWav(chunkPaths, outputDir, 'OpenAI')
  for (const chunkPath of chunkPaths) {
    await Bun.$`rm -f ${chunkPath}`.quiet().nothrow()
  }

  const processingTime = Date.now() - startTime
  const audioFile = Bun.file(audioPath)

  l.success(`Speech saved to ${audioPath}`)

  const metadata: Step4Metadata = {
    ttsService: 'openai',
    ttsModel: options.model,
    speaker: voiceId,
    processingTime,
    audioFileName: 'speech.wav',
    audioFileSize: audioFile.size,
    chunkCount: chunks.length
  }

  return { audioPath, metadata }
}
