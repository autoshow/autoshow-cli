import type { Step4Metadata } from '~/types'
import { logTtsConfig } from '~/cli/commands/process-steps/step-4-tts/tts-utils/log-tts-config'
import { finalizeTtsRun } from '~/cli/commands/process-steps/step-4-tts/tts-utils/finalize-tts-run'
import { exec } from '~/utils/cli-utils'
import { readEnv, readEnvFallback } from '~/utils/validate/env-utils'
import { ELEVENLABS_DEFAULT_VOICE_ID, type ElevenlabsTtsModel } from '~/cli/commands/models/model-options'
import { withRetry, classifyFetchRetry } from '~/utils/retries'
import { readElevenLabsError } from '~/utils/elevenlabs-utils'

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

  return finalizeTtsRun({
    service: 'elevenlabs',
    model: options.model,
    speaker: voiceId,
    audioPath,
    chunkCount: 1,
    startTime
  })
}
