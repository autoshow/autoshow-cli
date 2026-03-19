import * as v from 'valibot'
import type { Step4Metadata } from '~/types'
import * as l from '~/logger'
import { logTtsConfig } from '~/cli/commands/process-steps/step-4-tts/tts-utils/log-tts-config'
import { exec } from '~/utils/cli-utils'
import { readEnv, readEnvFallback } from '~/utils/validate/env-utils'
import { validateDataSafe } from '~/utils/validate/validation'
import { ELEVENLABS_DEFAULT_VOICE_ID, type ElevenlabsTtsModel } from '~/cli/commands/models/model-options'
import { withRetry, classifyFetchRetry } from '~/utils/retries'

const ElevenLabsErrorSchema = v.object({
  detail: v.optional(v.union([
    v.string(),
    v.object({
      message: v.optional(v.string(), undefined)
    })
  ]), undefined),
  message: v.optional(v.string(), undefined),
  error: v.optional(v.string(), undefined)
})

const readElevenLabsError = async (response: Response): Promise<string> => {
  const raw = await response.text()
  if (!raw.trim()) {
    return `HTTP ${response.status}`
  }

  try {
    const parsed: unknown = JSON.parse(raw)
    const validated = validateDataSafe(ElevenLabsErrorSchema, parsed, 'ElevenLabs error response')
    if (!validated) {
      return raw
    }

    if (typeof validated.detail === 'string' && validated.detail.trim().length > 0) {
      return validated.detail
    }
    if (validated.detail && typeof validated.detail === 'object' && typeof validated.detail.message === 'string') {
      return validated.detail.message
    }
    if (typeof validated.message === 'string' && validated.message.trim().length > 0) {
      return validated.message
    }
    if (typeof validated.error === 'string' && validated.error.trim().length > 0) {
      return validated.error
    }

    return raw
  } catch {
    return raw
  }
}

export const runElevenLabsTts = async (
  text: string,
  outputDir: string,
  options: { model: ElevenlabsTtsModel, voiceId?: string | undefined }
): Promise<{ audioPath: string, metadata: Step4Metadata }> => {
  const apiKey = readEnvFallback('ELEVENLABS_API_KEY')
  if (!apiKey) {
    throw new Error('ELEVENLABS_API_KEY environment variable is required for ElevenLabs TTS')
  }

  const baseURL = readEnv('ELEVENLABS_BASE_URL') ?? 'https://api.elevenlabs.io/v1'
  const voiceId = options.voiceId?.trim() || readEnv('ELEVENLABS_VOICE_ID') || ELEVENLABS_DEFAULT_VOICE_ID
  const audioPath = `${outputDir}/speech.wav`
  const tempAudioPath = `${outputDir}/speech-elevenlabs.mp3`

  logTtsConfig('ElevenLabs', [
    { label: 'model', value: options.model },
    { label: 'voice', value: voiceId }
  ])

  const startTime = Date.now()

  const audioBytes = await withRetry(
    { retryClass: 'runtime_http_create_conservative', operationName: 'elevenlabs-tts' },
    async () => {
      const response = await fetch(`${baseURL}/text-to-speech/${encodeURIComponent(voiceId)}?output_format=mp3_44100_128`, {
        method: 'POST',
        headers: {
          'xi-api-key': apiKey,
          'Content-Type': 'application/json',
          Accept: 'audio/mpeg'
        },
        body: JSON.stringify({
          text,
          model_id: options.model
        })
      })

      if (!response.ok) {
        const errText = await readElevenLabsError(response)
        const err = new Error(`ElevenLabs TTS failed (${response.status}): ${errText}`) as Error & { status: number }
        err.status = response.status
        throw err
      }

      return await response.arrayBuffer()
    },
    (error) => classifyFetchRetry(error, 'runtime_http_create_conservative')
  )
  if (audioBytes.byteLength === 0) {
    throw new Error('ElevenLabs TTS returned empty audio')
  }

  await Bun.write(tempAudioPath, new Uint8Array(audioBytes))

  const ffmpeg = await exec('ffmpeg', [
    '-i', tempAudioPath,
    '-ar', '16000',
    '-ac', '1',
    '-c:a', 'pcm_s16le',
    '-y',
    audioPath
  ])

  if (ffmpeg.exitCode !== 0) {
    throw new Error(`Failed to convert ElevenLabs audio to WAV: ${ffmpeg.stderr.trim()}`)
  }

  await Bun.$`rm -f ${tempAudioPath}`.quiet().nothrow()

  const processingTime = Date.now() - startTime
  const audioFile = Bun.file(audioPath)
  const audioFileSize = audioFile.size

  l.success(`Speech saved to ${audioPath}`)

  const metadata: Step4Metadata = {
    ttsService: 'elevenlabs',
    ttsModel: options.model,
    speaker: voiceId,
    processingTime,
    audioFileName: 'speech.wav',
    audioFileSize,
    chunkCount: 1
  }

  return { audioPath, metadata }
}
