import * as v from 'valibot'
import type { SpeechifyTtsModel, Step4Metadata } from '~/types'
import { logTtsConfig } from '~/cli/commands/process-steps/step-4-tts/tts-utils/log-tts-config'
import { splitTextIntoChunks, concatAndConvertToWav } from '~/cli/commands/process-steps/step-4-tts/tts-utils/audio-utils'
import { finalizeTtsRun } from '~/cli/commands/process-steps/step-4-tts/tts-utils/finalize-tts-run'
import { SPEECHIFY_DEFAULT_TTS_VOICE, validateSpeechifyTtsVoice } from '~/cli/commands/setup-and-utilities/models/model-options'
import { withRetry, classifyFetchRetry } from '~/utils/retries'
import { readEnv } from '~/utils/validate/env-utils'
import { validateDataSafe } from '~/utils/validate/validation'
import {
  ensureSpeechifyTtsCustomVoice,
  type SpeechifyTtsCustomVoiceOptions
} from './speechify-custom-voices'

const SPEECHIFY_DEFAULT_BASE_URL = 'https://api.speechify.ai'
const MAX_CHARS_PER_CHUNK = 2000

const SpeechifySpeechResponseSchema = v.object({
  audio_data: v.string()
})

const trimTrailingSlash = (value: string): string => value.replace(/\/+$/, '')

const decodeSpeechifyAudioData = (audioData: string): Uint8Array => {
  const cleaned = audioData.includes(',')
    ? audioData.slice(audioData.indexOf(',') + 1)
    : audioData
  return new Uint8Array(Buffer.from(cleaned, 'base64'))
}

const readSpeechifyError = async (response: Response): Promise<string> => {
  const text = await response.text()
  return text.trim() || `HTTP ${response.status}`
}

export const runSpeechifyTts = async (
  text: string,
  outputDir: string,
  options: { model: SpeechifyTtsModel, voiceId?: string | undefined, customVoice?: SpeechifyTtsCustomVoiceOptions | undefined }
): Promise<{ audioPath: string, metadata: Step4Metadata }> => {
  const apiKey = readEnv('SPEECHIFY_API_KEY')
  if (!apiKey) {
    throw new Error('SPEECHIFY_API_KEY environment variable is required for Speechify TTS')
  }

  const baseURL = trimTrailingSlash(readEnv('SPEECHIFY_BASE_URL') ?? SPEECHIFY_DEFAULT_BASE_URL)
  const chunks = splitTextIntoChunks(text, MAX_CHARS_PER_CHUNK)

  if (chunks.length === 0) {
    throw new Error('Speechify TTS input text is empty')
  }

  const startTime = Date.now()
  const customVoiceResult = options.customVoice
    ? await ensureSpeechifyTtsCustomVoice(baseURL, apiKey, options.customVoice)
    : undefined
  const voice = validateSpeechifyTtsVoice(customVoiceResult?.voiceId || options.voiceId?.trim() || readEnv('SPEECHIFY_TTS_VOICE') || SPEECHIFY_DEFAULT_TTS_VOICE)
  const speaker = customVoiceResult ? `ref_audio:${customVoiceResult.sourceAudio.basename}` : voice

  logTtsConfig('Speechify', [
    { label: 'model', value: options.model },
    { label: customVoiceResult ? 'reference audio' : 'voice', value: customVoiceResult ? customVoiceResult.sourceAudio.basename : voice },
    ...(customVoiceResult ? [{ label: 'created voice_id', value: customVoiceResult.voiceId }] : []),
    { label: 'chunk count', value: chunks.length }
  ])

  const chunkPaths: string[] = []

  try {
    for (let i = 0; i < chunks.length; i++) {
      const chunkIndex = i + 1
      const chunkPath = `${outputDir}/speech-speechify-chunk-${String(chunkIndex).padStart(3, '0')}.mp3`
      const audioBytes = await withRetry(
        { retryClass: 'runtime_http_create_conservative', operationName: `speechify-tts-chunk-${chunkIndex}` },
        async (signal) => {
          const response = await fetch(`${baseURL}/v1/audio/speech`, {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${apiKey}`,
              'Content-Type': 'application/json',
              Accept: 'application/json'
            },
            body: JSON.stringify({
              input: chunks[i] as string,
              voice_id: voice,
              audio_format: 'mp3',
              model: options.model
            }),
            ...(signal ? { signal } : {})
          })

          if (!response.ok) {
            const errText = await readSpeechifyError(response)
            const err = new Error(`Speechify TTS failed (${response.status}): ${errText}`) as Error & { status: number, headers: Headers }
            err.status = response.status
            err.headers = response.headers
            throw err
          }

          const payload = validateDataSafe(SpeechifySpeechResponseSchema, await response.json())
          if (!payload) {
            throw new Error('Speechify TTS returned an invalid response: missing audio_data')
          }
          return decodeSpeechifyAudioData(payload.audio_data)
        },
        (error) => classifyFetchRetry(error, 'runtime_http_create_conservative')
      )

      if (audioBytes.byteLength === 0) {
        throw new Error('Speechify TTS returned empty audio')
      }

      await Bun.write(chunkPath, audioBytes)
      chunkPaths.push(chunkPath)
    }

    const audioPath = await concatAndConvertToWav(chunkPaths, outputDir, 'Speechify')
    const result = finalizeTtsRun({
      service: 'speechify',
      model: options.model,
      speaker,
      audioPath,
      chunkCount: chunks.length,
      startTime
    })

    return {
      audioPath: result.audioPath,
      metadata: {
        ...result.metadata,
        ...(customVoiceResult ? { clonedVoiceId: customVoiceResult.voiceId, cloneCostCents: 0 } : {})
      }
    }
  } finally {
    for (const chunkPath of chunkPaths) {
      await Bun.$`rm -f ${chunkPath}`.quiet().nothrow()
    }
  }
}
