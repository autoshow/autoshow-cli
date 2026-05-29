import { basename, extname } from 'node:path'
import type { MistralTtsModel, Step4Metadata } from '~/types'
import { logTtsConfig } from '~/cli/commands/process-steps/step-4-tts/tts-utils/log-tts-config'
import { splitTextIntoChunks, concatAndConvertToWav, convertAudioToWav } from '~/cli/commands/process-steps/step-4-tts/tts-utils/audio-utils'
import { finalizeTtsRun } from '~/cli/commands/process-steps/step-4-tts/tts-utils/finalize-tts-run'
import { mistralJsonRequest } from '~/utils/mistral/client'
import { readEnv } from '~/utils/validate/env-utils'
import { MISTRAL_DEFAULT_BASE_URL } from '~/utils/base-urls'
import { MEDIA_GENERATION_TIMEOUT_MS } from '~/utils/timeouts'
import { materializeMediaInput } from '~/utils/media-url'

const MAX_CHARS_PER_CHUNK = 4000
const REQUEST_TIMEOUT_MS = MEDIA_GENERATION_TIMEOUT_MS
const MISTRAL_REF_AUDIO_DIRECT_EXTENSIONS = new Set(['.mp3', '.mpeg', '.mpga', '.wav', '.wave'])

type MistralVoiceSource =
  | { kind: 'voice', value: string, speaker: string }
  | { kind: 'refAudio', path: string, speaker: string }

type MistralReferenceAudio = {
  base64: string
  uploadPath: string
  convertedPath?: string | undefined
}

type MistralSavedVoiceResult = {
  voiceId: string
  voiceName: string
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const readStringField = (payload: unknown, field: string, label: string): string => {
  if (isRecord(payload) && typeof payload[field] === 'string') {
    return payload[field]
  }
  throw new Error(`${label} returned an invalid response: missing ${field}`)
}

const decodeMistralAudioData = (audioData: string): Uint8Array => {
  const cleaned = audioData.includes(',')
    ? audioData.slice(audioData.indexOf(',') + 1)
    : audioData
  return new Uint8Array(Buffer.from(cleaned, 'base64'))
}

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

  throw new Error('Mistral TTS requires a saved voice ID or reference audio. Use --mistral-tts-voice or --mistral-tts-ref-audio.')
}

const readAudioBase64 = async (path: string): Promise<string> => {
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

const prepareReferenceAudio = async (
  path: string,
  outputDir: string
): Promise<MistralReferenceAudio> => {
  const ext = extname(path).toLowerCase()
  if (MISTRAL_REF_AUDIO_DIRECT_EXTENSIONS.has(ext)) {
    return {
      base64: await readAudioBase64(path),
      uploadPath: path
    }
  }

  const convertedPath = `${outputDir}/mistral-reference-audio.wav`
  await readAudioBase64(path)
  await convertAudioToWav(path, convertedPath, 'Mistral', 'reference audio')

  return {
    base64: await readAudioBase64(convertedPath),
    uploadPath: convertedPath,
    convertedPath
  }
}

const createMistralSavedVoice = async (
  apiKey: string,
  baseURL: string,
  referenceAudio: MistralReferenceAudio,
  voiceName: string
): Promise<MistralSavedVoiceResult> => {
  const normalizedName = voiceName.trim()
  if (!normalizedName) {
    throw new Error('Mistral TTS saved voice name is empty.')
  }

  const response = await mistralJsonRequest({
    apiKey,
    baseURL,
    path: '/audio/voices',
    timeoutMs: REQUEST_TIMEOUT_MS,
    errorMessagePrefix: 'Mistral TTS failed',
    body: {
      name: normalizedName,
      sample_audio: referenceAudio.base64,
      sample_filename: basename(referenceAudio.uploadPath),
      retention_notice: 30
    }
  })

  return {
    voiceId: readStringField(response, 'id', 'Mistral saved voice creation'),
    voiceName: readStringField(response, 'name', 'Mistral saved voice creation')
  }
}

export const runMistralTts = async (
  text: string,
  outputDir: string,
  options: {
    model: MistralTtsModel
    voiceId?: string | undefined
    refAudioPath?: string | undefined
    voiceName?: string | undefined
  }
): Promise<{ audioPath: string, metadata: Step4Metadata }> => {
  const voiceSource = resolveVoiceSource(options)
  const voiceName = options.voiceName?.trim() || undefined
  if (voiceName && voiceSource.kind !== 'refAudio') {
    throw new Error('Mistral TTS --mistral-tts-voice-name requires --mistral-tts-ref-audio or MISTRAL_TTS_REF_AUDIO.')
  }
  const apiKey = readEnv('MISTRAL_API_KEY')
  if (!apiKey) {
    throw new Error('MISTRAL_API_KEY environment variable is required for Mistral TTS')
  }

  const chunks = splitTextIntoChunks(text, MAX_CHARS_PER_CHUNK)
  if (chunks.length === 0) {
    throw new Error('Mistral TTS input text is empty')
  }

  const materializedRefAudio = voiceSource.kind === 'refAudio'
    ? await materializeMediaInput(voiceSource.path, {
        accept: 'audio/*,application/octet-stream;q=0.9,*/*;q=0.8',
        label: 'Mistral TTS reference audio'
      })
    : undefined

  try {
  const referenceAudio = voiceSource.kind === 'refAudio'
    ? await prepareReferenceAudio(materializedRefAudio?.path ?? voiceSource.path, outputDir)
    : undefined
  const baseURL = readEnv('MISTRAL_BASE_URL') ?? MISTRAL_DEFAULT_BASE_URL
  const savedVoice = referenceAudio && voiceName
    ? await createMistralSavedVoice(apiKey, baseURL, referenceAudio, voiceName)
    : undefined
  let speechVoiceInput: { voice_id: string } | { ref_audio: string }
  if (voiceSource.kind === 'voice') {
    speechVoiceInput = { voice_id: voiceSource.value }
  } else if (savedVoice) {
    speechVoiceInput = { voice_id: savedVoice.voiceId }
  } else {
    if (!referenceAudio) {
      throw new Error('Mistral TTS reference audio preparation failed')
    }
    speechVoiceInput = { ref_audio: referenceAudio.base64 }
  }

  logTtsConfig('Mistral', [
    { label: 'model', value: options.model },
    { label: voiceSource.kind === 'voice' ? 'voice' : 'reference audio', value: voiceSource.kind === 'voice' ? voiceSource.value : voiceSource.path },
    { label: 'saved voice', value: savedVoice?.voiceId },
    { label: 'reference upload', value: referenceAudio?.convertedPath ? referenceAudio.uploadPath : undefined },
    { label: 'chunk count', value: chunks.length }
  ])

  const startTime = Date.now()
  const chunkPaths: string[] = []

  try {
    for (let i = 0; i < chunks.length; i++) {
      const chunkIndex = i + 1
      const chunkPath = `${outputDir}/speech-mistral-chunk-${String(chunkIndex).padStart(3, '0')}.wav`
      const response = await mistralJsonRequest({
        apiKey,
        baseURL,
        path: '/audio/speech',
        timeoutMs: REQUEST_TIMEOUT_MS,
        errorMessagePrefix: 'Mistral TTS failed',
        body: {
          model: options.model,
          input: chunks[i] as string,
          stream: false,
          response_format: 'wav',
          ...speechVoiceInput
        }
      })
      const audioData = readStringField(response, 'audio_data', 'Mistral TTS')

      const audioBytes = decodeMistralAudioData(audioData)
      if (audioBytes.byteLength === 0) {
        throw new Error(`Mistral TTS returned empty audio for chunk ${chunkIndex}`)
      }
      await Bun.write(chunkPath, audioBytes)
      chunkPaths.push(chunkPath)
    }

    const audioPath = await concatAndConvertToWav(chunkPaths, outputDir, 'Mistral')
    const result = finalizeTtsRun({
      service: 'mistral',
      model: options.model,
      speaker: savedVoice ? savedVoice.voiceId : voiceSource.speaker,
      audioPath,
      chunkCount: chunks.length,
      startTime
    })
    return {
      audioPath: result.audioPath,
      metadata: {
        ...result.metadata,
        ...(savedVoice ? { clonedVoiceId: savedVoice.voiceId, cloneCostCents: 0 } : {})
      }
    }
  } finally {
    for (const chunkPath of chunkPaths) {
      await Bun.$`rm -f ${chunkPath}`.quiet().nothrow()
    }
    if (referenceAudio?.convertedPath) {
      await Bun.$`rm -f ${referenceAudio.convertedPath}`.quiet().nothrow()
    }
  }
  } finally {
    await materializedRefAudio?.cleanup()
  }
}
