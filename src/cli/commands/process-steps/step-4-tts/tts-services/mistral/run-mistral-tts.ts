import { basename } from 'node:path'
import { Mistral } from '@mistralai/mistralai'
import { ConnectionError, MistralError, RequestAbortedError, RequestTimeoutError } from '@mistralai/mistralai/models/errors'
import type { MistralTtsModel, Step4Metadata } from '~/types'
import { logTtsConfig } from '~/cli/commands/process-steps/step-4-tts/tts-utils/log-tts-config'
import { splitTextIntoChunks, concatAndConvertToWav } from '~/cli/commands/process-steps/step-4-tts/tts-utils/audio-utils'
import { finalizeTtsRun } from '~/cli/commands/process-steps/step-4-tts/tts-utils/finalize-tts-run'
import { readEnv } from '~/utils/validate/env-utils'

const MAX_CHARS_PER_CHUNK = 4000
const REQUEST_TIMEOUT_MS = 10 * 60 * 1000

const normalizeMistralServerURL = (serverURL: string): string => serverURL.replace(/\/v1\/?$/, '')

type MistralVoiceSource =
  | { kind: 'voice', value: string, speaker: string }
  | { kind: 'refAudio', path: string, speaker: string }

const resolveVoiceSource = (
  options: { voiceId?: string | undefined, refAudioPath?: string | undefined }
): MistralVoiceSource => {
  const optionVoice = options.voiceId?.trim()
  const optionRefAudio = options.refAudioPath?.trim()
  if (optionVoice && optionRefAudio) {
    throw new Error('Mistral TTS requires exactly one voice source. Use either --mistral-tts-voice or --mistral-tts-ref-audio, not both.')
  }
  if (optionVoice) {
    return { kind: 'voice', value: optionVoice, speaker: optionVoice }
  }
  if (optionRefAudio) {
    return { kind: 'refAudio', path: optionRefAudio, speaker: `ref_audio:${basename(optionRefAudio)}` }
  }

  const envVoice = readEnv('MISTRAL_TTS_VOICE')
  const envRefAudio = readEnv('MISTRAL_TTS_REF_AUDIO')
  if (envVoice && envRefAudio) {
    throw new Error('Mistral TTS requires exactly one voice source. Set either MISTRAL_TTS_VOICE or MISTRAL_TTS_REF_AUDIO, not both.')
  }
  if (envVoice) {
    return { kind: 'voice', value: envVoice, speaker: envVoice }
  }
  if (envRefAudio) {
    return { kind: 'refAudio', path: envRefAudio, speaker: `ref_audio:${basename(envRefAudio)}` }
  }

  throw new Error('Mistral TTS requires a saved voice ID or reference audio. Set --mistral-tts-voice, --mistral-tts-ref-audio, MISTRAL_TTS_VOICE, or MISTRAL_TTS_REF_AUDIO.')
}

const readRefAudioBase64 = async (path: string): Promise<string> => {
  const file = Bun.file(path)
  if (!await file.exists()) {
    throw new Error(`Mistral TTS reference audio not found: ${path}`)
  }

  const bytes = await file.arrayBuffer()
  if (bytes.byteLength === 0) {
    throw new Error(`Mistral TTS reference audio is empty: ${path}`)
  }

  return Buffer.from(bytes).toString('base64')
}

const normalizeMistralError = (error: unknown): Error => {
  if (error instanceof MistralError) {
    const message = error.body.length > 0 ? error.body : error.message
    return new Error(`Mistral TTS failed (${error.statusCode}): ${message}`)
  }
  if (error instanceof RequestAbortedError || error instanceof RequestTimeoutError) {
    const abortError = new Error(error.message)
    abortError.name = 'AbortError'
    return abortError
  }
  if (error instanceof ConnectionError) {
    return new TypeError(error.message)
  }
  return error instanceof Error ? error : new Error(String(error))
}

export const runMistralTts = async (
  text: string,
  outputDir: string,
  options: { model: MistralTtsModel, voiceId?: string | undefined, refAudioPath?: string | undefined }
): Promise<{ audioPath: string, metadata: Step4Metadata }> => {
  const voiceSource = resolveVoiceSource(options)
  const apiKey = readEnv('MISTRAL_API_KEY')
  if (!apiKey) {
    throw new Error('MISTRAL_API_KEY environment variable is required for Mistral TTS')
  }

  const chunks = splitTextIntoChunks(text, MAX_CHARS_PER_CHUNK)
  if (chunks.length === 0) {
    throw new Error('Mistral TTS input text is empty')
  }

  const refAudioBase64 = voiceSource.kind === 'refAudio'
    ? await readRefAudioBase64(voiceSource.path)
    : undefined
  const serverURL = normalizeMistralServerURL(readEnv('MISTRAL_BASE_URL') ?? 'https://api.mistral.ai/v1')
  const client = new Mistral({
    apiKey,
    retryConfig: { strategy: 'none' },
    timeoutMs: REQUEST_TIMEOUT_MS,
    serverURL
  })

  logTtsConfig('Mistral', [
    { label: 'model', value: options.model },
    { label: voiceSource.kind === 'voice' ? 'voice' : 'reference audio', value: voiceSource.kind === 'voice' ? voiceSource.value : voiceSource.path },
    { label: 'chunk count', value: chunks.length }
  ])

  const startTime = Date.now()
  const chunkPaths: string[] = []

  try {
    for (let i = 0; i < chunks.length; i++) {
      const chunkIndex = i + 1
      const chunkPath = `${outputDir}/speech-mistral-chunk-${String(chunkIndex).padStart(3, '0')}.wav`
      let audioData: string
      try {
        const response = await client.audio.speech.complete({
          model: options.model,
          input: chunks[i] as string,
          stream: false,
          responseFormat: 'wav',
          ...(voiceSource.kind === 'voice'
            ? { voiceId: voiceSource.value }
            : { refAudio: refAudioBase64 })
        })
        audioData = response.audioData
      } catch (error) {
        throw normalizeMistralError(error)
      }

      const audioBytes = Buffer.from(audioData, 'base64')
      if (audioBytes.byteLength === 0) {
        throw new Error(`Mistral TTS returned empty audio for chunk ${chunkIndex}`)
      }
      await Bun.write(chunkPath, audioBytes)
      chunkPaths.push(chunkPath)
    }

    const audioPath = await concatAndConvertToWav(chunkPaths, outputDir, 'Mistral')
    return finalizeTtsRun({
      service: 'mistral',
      model: options.model,
      speaker: voiceSource.speaker,
      audioPath,
      chunkCount: chunks.length,
      startTime
    })
  } finally {
    for (const chunkPath of chunkPaths) {
      await Bun.$`rm -f ${chunkPath}`.quiet().nothrow()
    }
  }
}
