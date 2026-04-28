import type { DeapiTtsModel, Step4Metadata } from '~/types'
import { DEAPI_DEFAULT_TTS_VOICE } from '~/cli/commands/setup-and-utilities/models/model-options'
import { logTtsConfig } from '~/cli/commands/process-steps/step-4-tts/tts-utils/log-tts-config'
import { concatAndConvertToWav } from '~/cli/commands/process-steps/step-4-tts/tts-utils/audio-utils'
import { finalizeTtsRun } from '~/cli/commands/process-steps/step-4-tts/tts-utils/finalize-tts-run'
import {
  deapiFetch,
  ensureDeapiApiKey,
  extractDeapiErrorMessage,
  extractResultUrl,
  parseRequestId,
  pollDeapiJob,
  readJsonOrText
} from '~/utils/deapi'

export type DeapiTtsModelConfig = {
  maxTextChars: number
  minTextChars: number
  lang: string
  speed: number
  voice: string
  format: 'mp3'
  sampleRate: number
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
    case 'Qwen3_TTS_12Hz_1_7B_Base':
      throw new Error('deAPI TTS model Qwen3_TTS_12Hz_1_7B_Base is not yet supported by this CLI because it requires reference audio and reference text inputs.')
    case 'Qwen3_TTS_12Hz_1_7B_VoiceDesign':
      throw new Error('deAPI TTS model Qwen3_TTS_12Hz_1_7B_VoiceDesign is not yet supported by this CLI because it requires voice design instruction inputs.')
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
  options: { model: DeapiTtsModel, voiceId?: string | undefined }
): Promise<{ audioPath: string, metadata: Step4Metadata }> => {
  const apiKey = ensureDeapiApiKey('deAPI TTS')
  const config = getDeapiTtsModelConfig(options.model, options.voiceId)
  const input = validateTextLength(text, options.model, config)

  logTtsConfig('deAPI', [
    { label: 'model', value: options.model },
    { label: 'voice', value: config.voice },
    { label: 'language', value: config.lang },
    { label: 'format', value: config.format },
    { label: 'sample rate', value: config.sampleRate }
  ])

  const startTime = Date.now()
  const body = new FormData()
  body.append('text', input)
  body.append('model', options.model)
  body.append('mode', 'custom_voice')
  body.append('voice', config.voice)
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

  const sourcePath = `${outputDir}/speech-deapi-source.mp3`
  await downloadResultAudio(resultUrl, sourcePath)
  const audioPath = await concatAndConvertToWav([sourcePath], outputDir, 'deAPI')
  await Bun.$`rm -f ${sourcePath}`.quiet().nothrow()

  return finalizeTtsRun({
    service: 'deapi',
    model: options.model,
    speaker: config.voice,
    audioPath,
    chunkCount: 1,
    startTime
  })
}
