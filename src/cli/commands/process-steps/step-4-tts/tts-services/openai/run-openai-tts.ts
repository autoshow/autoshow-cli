import OpenAI from 'openai'
import type { Step4Metadata } from '~/types'
import * as l from '~/logger'
import { logTtsConfig } from '~/cli/commands/process-steps/step-4-tts/tts-utils/log-tts-config'
import { exec } from '~/utils/cli-utils'
import { OPENAI_DEFAULT_TTS_VOICE, type OpenAITtsModel } from '~/cli/commands/models/model-options'
import { readEnv, readEnvFallback } from '~/utils/validate/env-utils'

const MAX_CHARS_PER_CHUNK = 4000

const splitTextIntoChunks = (text: string, maxChars: number): string[] => {
  const chunks: string[] = []
  let remaining = text.trim()

  while (remaining.length > maxChars) {
    let splitAt = remaining.lastIndexOf('\n', maxChars)
    if (splitAt < Math.floor(maxChars * 0.5)) {
      splitAt = remaining.lastIndexOf(' ', maxChars)
    }
    if (splitAt < Math.floor(maxChars * 0.5)) {
      splitAt = maxChars
    }

    const chunk = remaining.slice(0, splitAt).trim()
    if (chunk.length > 0) {
      chunks.push(chunk)
    }
    remaining = remaining.slice(splitAt).trim()
  }

  if (remaining.length > 0) {
    chunks.push(remaining)
  }

  return chunks
}

const getClientConfig = (): { apiKey: string, baseURL?: string } => {
  const apiKey = readEnvFallback('OPENAI_API_KEY', 'NITRO_OPENAI_API_KEY')
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY environment variable is required for OpenAI TTS')
  }
  const baseURL = readEnv('OPENAI_BASE_URL')
  return baseURL ? { apiKey, baseURL } : { apiKey }
}

const concatAndConvertToWav = async (chunkPaths: string[], outputDir: string): Promise<string> => {
  const wavPath = `${outputDir}/speech.wav`

  if (chunkPaths.length === 1) {
    const ffmpeg = await exec('ffmpeg', [
      '-i', chunkPaths[0] as string,
      '-ar', '16000',
      '-ac', '1',
      '-c:a', 'pcm_s16le',
      '-y',
      wavPath
    ])
    if (ffmpeg.exitCode !== 0) {
      throw new Error(`Failed to convert OpenAI audio to WAV: ${ffmpeg.stderr.trim()}`)
    }
    return wavPath
  }

  const concatListPath = `${outputDir}/speech-openai-chunks.txt`
  const concatList = chunkPaths
    .map(path => `file '${path.replace(/'/g, `'\\''`)}'`)
    .join('\n')
  await Bun.write(concatListPath, `${concatList}\n`)

  const ffmpeg = await exec('ffmpeg', [
    '-f', 'concat',
    '-safe', '0',
    '-i', concatListPath,
    '-ar', '16000',
    '-ac', '1',
    '-c:a', 'pcm_s16le',
    '-y',
    wavPath
  ])

  if (ffmpeg.exitCode !== 0) {
    throw new Error(`Failed to concatenate OpenAI audio chunks: ${ffmpeg.stderr.trim()}`)
  }

  await Bun.$`rm -f ${concatListPath}`.quiet().nothrow()
  return wavPath
}

export const runOpenAITts = async (
  text: string,
  outputDir: string,
  options: { model: OpenAITtsModel, voiceId?: string | undefined }
): Promise<{ audioPath: string, metadata: Step4Metadata }> => {
  const config = getClientConfig()
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

  const audioPath = await concatAndConvertToWav(chunkPaths, outputDir)
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
