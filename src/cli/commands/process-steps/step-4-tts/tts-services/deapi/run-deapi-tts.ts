import { stat } from 'node:fs/promises'
import { basename, extname } from 'node:path'
import type { DeapiTtsModel, Step4Metadata } from '~/types'
import { DEAPI_DEFAULT_TTS_VOICE } from '~/cli/commands/setup-and-utilities/models/model-options'
import { logTtsConfig } from '~/cli/commands/process-steps/step-4-tts/tts-utils/log-tts-config'
import { concatAndConvertToWav } from '~/cli/commands/process-steps/step-4-tts/tts-utils/audio-utils'
import { finalizeTtsRun } from '~/cli/commands/process-steps/step-4-tts/tts-utils/finalize-tts-run'
import { getAudioDuration } from '~/cli/commands/process-steps/step-2-extract/step-2-stt/stt-utils/audio-splitter'
import {
  deapiFetch,
  ensureDeapiApiKey,
  extractDeapiErrorMessage,
  extractResultUrl,
  parseRequestId,
  pollDeapiJob,
  readJsonOrText
} from '~/utils/deapi'
import { materializeMediaInput } from '~/utils/media-url'

export const DEAPI_TTS_VOICE_CLONE_MODEL = 'Qwen3_TTS_12Hz_1_7B_Base'
export const DEAPI_TTS_VOICE_DESIGN_MODEL = 'Qwen3_TTS_12Hz_1_7B_VoiceDesign'
const MAX_DEAPI_TTS_REFERENCE_AUDIO_BYTES = 10 * 1024 * 1024
const MIN_DEAPI_TTS_REFERENCE_AUDIO_SECONDS = 3
const MAX_DEAPI_TTS_REFERENCE_AUDIO_SECONDS = 10
const DEAPI_TTS_REFERENCE_AUDIO_EXTENSIONS = new Set(['.mp3', '.wav', '.flac', '.ogg', '.m4a'])

export type DeapiTtsMode = 'custom_voice' | 'voice_clone' | 'voice_design'

export type DeapiTtsModelConfig = {
  maxTextChars: number
  minTextChars: number
  lang: string
  speed: number
  voice?: string | undefined
  format: string
  sampleRate: number
}

export type DeapiTtsReferenceAudio = {
  path: string
  basename: string
  durationSeconds: number
  sizeBytes: number
}

export const getDeapiTtsModelConfig = (
  model: DeapiTtsModel,
  voiceOverride?: string | undefined
): DeapiTtsModelConfig => {
  switch (model) {
    case 'Kokoro':
      return {
        maxTextChars: 10001,
        minTextChars: 3,
        lang: 'en-us',
        speed: 1,
        voice: voiceOverride?.trim() || DEAPI_DEFAULT_TTS_VOICE,
        format: 'mp3',
        sampleRate: 24000
      }
    case 'Chatterbox':
      return {
        maxTextChars: 2000,
        minTextChars: 10,
        lang: 'en',
        speed: 1,
        voice: voiceOverride?.trim() || 'default',
        format: 'mp3',
        sampleRate: 24000
      }
    case 'Qwen3_TTS_12Hz_1_7B_CustomVoice':
      return {
        maxTextChars: 5000,
        minTextChars: 10,
        lang: 'English',
        speed: 1,
        voice: voiceOverride?.trim() || 'Vivian',
        format: 'mp3',
        sampleRate: 24000
      }
    case DEAPI_TTS_VOICE_CLONE_MODEL:
      return {
        maxTextChars: 5000,
        minTextChars: 10,
        lang: 'English',
        speed: 1,
        format: 'mp3',
        sampleRate: 24000
      }
    case DEAPI_TTS_VOICE_DESIGN_MODEL:
      return {
        maxTextChars: 5000,
        minTextChars: 10,
        lang: 'English',
        speed: 1,
        format: 'mp3',
        sampleRate: 24000
      }
  }
}

export const validateDeapiTtsReferenceAudio = async (
  refAudioPath: string
): Promise<DeapiTtsReferenceAudio> => {
  const normalizedPath = refAudioPath.trim()
  if (normalizedPath.length === 0) {
    throw new Error('deAPI TTS reference audio path is empty.')
  }

  const ext = extname(normalizedPath).toLowerCase()
  if (!DEAPI_TTS_REFERENCE_AUDIO_EXTENSIONS.has(ext)) {
    throw new Error('deAPI TTS reference audio must be an mp3, wav, flac, ogg, or m4a file.')
  }

  let fileStats: Awaited<ReturnType<typeof stat>>
  try {
    fileStats = await stat(normalizedPath)
  } catch {
    throw new Error(`deAPI TTS reference audio not found: ${normalizedPath}`)
  }

  if (!fileStats.isFile()) {
    throw new Error(`deAPI TTS reference audio is not a file: ${normalizedPath}`)
  }
  if (fileStats.size <= 0) {
    throw new Error(`deAPI TTS reference audio is empty: ${normalizedPath}`)
  }
  if (fileStats.size > MAX_DEAPI_TTS_REFERENCE_AUDIO_BYTES) {
    throw new Error(`deAPI TTS reference audio exceeds 10 MB: ${normalizedPath}`)
  }

  let durationSeconds: number
  try {
    durationSeconds = await getAudioDuration(normalizedPath)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    throw new Error(`Could not determine deAPI TTS reference audio duration: ${message}`)
  }

  if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) {
    throw new Error(`Could not determine deAPI TTS reference audio duration: ${normalizedPath}`)
  }
  if (
    durationSeconds < MIN_DEAPI_TTS_REFERENCE_AUDIO_SECONDS
    || durationSeconds > MAX_DEAPI_TTS_REFERENCE_AUDIO_SECONDS
  ) {
    throw new Error(`deAPI TTS reference audio must be 3-10 seconds long. Received ${durationSeconds.toFixed(2)} seconds.`)
  }

  return {
    path: normalizedPath,
    basename: basename(normalizedPath),
    durationSeconds,
    sizeBytes: fileStats.size
  }
}

const validateTextLength = (text: string, model: DeapiTtsModel, config: DeapiTtsModelConfig): string => {
  const normalized = text.trim()
  if (normalized.length < config.minTextChars) {
    throw new Error(`deAPI TTS input is too short for ${model}; minimum is ${config.minTextChars} characters.`)
  }
  if (normalized.length > config.maxTextChars) {
    throw new Error(`deAPI TTS input is too long for ${model}; maximum is ${config.maxTextChars} characters. Split the input or choose another model.`)
  }
  return normalized
}

const downloadResultAudio = async (resultUrl: string, outputPath: string): Promise<void> => {
  const response = await fetch(resultUrl, {
    method: 'GET',
    headers: { accept: 'audio/mpeg,audio/*;q=0.9,*/*;q=0.8' }
  })
  if (!response.ok) {
    throw new Error(`deAPI TTS result download failed (${response.status})`)
  }

  const bytes = new Uint8Array(await response.arrayBuffer())
  if (bytes.byteLength === 0) {
    throw new Error('deAPI TTS returned empty audio')
  }
  await Bun.write(outputPath, bytes)
}

export const runDeapiTts = async (
  text: string,
  outputDir: string,
  options: {
    model: DeapiTtsModel
    voiceId?: string | undefined
    refAudioPath?: string | undefined
    refText?: string | undefined
    language?: string | undefined
    speed?: number | undefined
    format?: string | undefined
    sampleRate?: number | undefined
    instruction?: string | undefined
  }
): Promise<{ audioPath: string, metadata: Step4Metadata }> => {
  const refAudioPath = options.refAudioPath?.trim() || undefined
  const voiceId = options.voiceId?.trim() || undefined
  const instruction = options.instruction?.trim() || undefined
  if (voiceId && refAudioPath) {
    throw new Error('deAPI TTS requires exactly one voice source. Use either --deapi-tts-voice or --deapi-tts-ref-audio, not both.')
  }
  if (options.refText?.trim() && !refAudioPath) {
    throw new Error('deAPI TTS --deapi-tts-ref-text requires --deapi-tts-ref-audio.')
  }
  if (refAudioPath && options.model !== DEAPI_TTS_VOICE_CLONE_MODEL) {
    throw new Error(`deAPI TTS voice cloning is only supported for ${DEAPI_TTS_VOICE_CLONE_MODEL}.`)
  }
  if (options.model === DEAPI_TTS_VOICE_CLONE_MODEL && !refAudioPath) {
    throw new Error(`deAPI TTS model ${DEAPI_TTS_VOICE_CLONE_MODEL} requires --deapi-tts-ref-audio.`)
  }
  if (options.model === DEAPI_TTS_VOICE_DESIGN_MODEL && !instruction) {
    throw new Error(`deAPI TTS model ${DEAPI_TTS_VOICE_DESIGN_MODEL} requires --deapi-tts-instruction.`)
  }
  if (options.model === DEAPI_TTS_VOICE_DESIGN_MODEL && (refAudioPath || voiceId)) {
    throw new Error(`deAPI TTS model ${DEAPI_TTS_VOICE_DESIGN_MODEL} uses --deapi-tts-instruction and cannot be combined with --deapi-tts-ref-audio or --deapi-tts-voice.`)
  }

  const baseConfig = getDeapiTtsModelConfig(options.model, options.voiceId)
  const config: DeapiTtsModelConfig = {
    ...baseConfig,
    lang: options.language?.trim() || baseConfig.lang,
    speed: options.speed ?? baseConfig.speed,
    format: options.format?.trim() || baseConfig.format,
    sampleRate: options.sampleRate ?? baseConfig.sampleRate
  }
  const input = validateTextLength(text, options.model, config)
  const mode: DeapiTtsMode = options.model === DEAPI_TTS_VOICE_DESIGN_MODEL
    ? 'voice_design'
    : refAudioPath ? 'voice_clone' : 'custom_voice'
  const materializedRefAudio = refAudioPath
    ? await materializeMediaInput(refAudioPath, {
        accept: 'audio/*,application/octet-stream;q=0.9,*/*;q=0.8',
        label: 'deAPI TTS reference audio'
      })
    : undefined

  try {
  const refAudio = materializedRefAudio ? await validateDeapiTtsReferenceAudio(materializedRefAudio.path) : undefined
  if (mode === 'custom_voice' && !config.voice) {
    throw new Error(`deAPI TTS model ${options.model} requires --deapi-tts-ref-audio.`)
  }
  const apiKey = ensureDeapiApiKey('deAPI TTS')
  const speaker = refAudio
    ? `ref_audio:${refAudio.basename}`
    : mode === 'voice_design' ? `voice_design:${instruction}` : config.voice

  logTtsConfig('deAPI', [
    { label: 'model', value: options.model },
    { label: 'mode', value: mode },
    { label: refAudio ? 'reference audio' : mode === 'voice_design' ? 'instruction' : 'voice', value: refAudio ? refAudio.basename : mode === 'voice_design' ? instruction : config.voice },
    { label: 'language', value: config.lang },
    { label: 'speed', value: config.speed },
    { label: 'format', value: config.format },
    { label: 'sample rate', value: config.sampleRate }
  ])

  const startTime = Date.now()
  const body = new FormData()
  body.append('text', input)
  body.append('model', options.model)
  body.append('mode', mode)
  if (mode === 'custom_voice') {
    body.append('voice', config.voice as string)
  } else if (refAudio) {
    body.append('ref_audio', Bun.file(refAudio.path), refAudio.basename)
    const refText = options.refText?.trim()
    if (refText) {
      body.append('ref_text', refText)
    }
  } else if (mode === 'voice_design' && instruction) {
    body.append('instruct', instruction)
  }
  body.append('lang', config.lang)
  body.append('speed', String(config.speed))
  body.append('format', config.format)
  body.append('sample_rate', String(config.sampleRate))

  const createResponse = await deapiFetch('/api/v2/audio/speech', {
    apiKey,
    method: 'POST',
    body
  })
  const createPayload = await readJsonOrText(createResponse)
  if (!createResponse.ok) {
    throw new Error(`deAPI TTS request failed (${createResponse.status}): ${extractDeapiErrorMessage(createPayload) ?? 'Unknown error'}`)
  }

  const requestId = parseRequestId(createPayload)
  if (!requestId) {
    throw new Error('deAPI TTS request did not return request_id')
  }

  const { status } = await pollDeapiJob({
    requestId,
    apiKey,
    operationName: 'deapi-poll-tts'
  })
  const resultUrl = extractResultUrl(status)
  if (!resultUrl) {
    throw new Error('deAPI TTS completed without result_url')
  }

  const sourcePath = `${outputDir}/speech-deapi-source.${config.format.replace(/[^a-z0-9]/gi, '') || 'mp3'}`
  await downloadResultAudio(resultUrl, sourcePath)
  const audioPath = await concatAndConvertToWav([sourcePath], outputDir, 'deAPI')
  await Bun.$`rm -f ${sourcePath}`.quiet().nothrow()

  return finalizeTtsRun({
    service: 'deapi',
    model: options.model,
    speaker,
    audioPath,
    chunkCount: 1,
    startTime
  })
  } finally {
    await materializedRefAudio?.cleanup()
  }
}
