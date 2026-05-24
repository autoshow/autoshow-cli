import type { ElevenlabsMusicModel, Step7MusicMetadata } from '~/types'
import * as l from '~/utils/logger'
import { logLocationsTable } from '~/utils/logger/human-table'
import { logMediaGenerationStatus } from '~/cli/commands/process-steps/generation-command-utils'
import { readEnv } from '~/utils/validate/env-utils'
import { ELEVENLABS_DEFAULT_BASE_URL } from '~/utils/base-urls'
import { withRetry, classifyFetchRetry } from '~/utils/retries'
import { readElevenLabsError } from '~/cli/commands/process-steps/step-4-tts/tts-services/elevenlabs/elevenlabs-utils'
import { MEDIA_GENERATION_TIMEOUT_MS } from '~/utils/timeouts'

const ELEVENLABS_MIN_DURATION_MS = 3000
const ELEVENLABS_MAX_DURATION_MS = 600000
const REQUEST_TIMEOUT_MS = MEDIA_GENERATION_TIMEOUT_MS
const ELEVENLABS_MUSIC_OUTPUT_FORMAT = 'mp3_44100_128'
const ELEVENLABS_MUSIC_SAMPLE_RATE = 44100
const ELEVENLABS_MUSIC_BITRATE = 128000

type ElevenLabsMusicResponseAudio = {
  bytes: Uint8Array
  mimeType?: string | undefined
  requestId?: string | undefined
}

const normalizeMusicDurationMs = (durationSeconds: number | undefined): number | undefined => {
  if (durationSeconds === undefined) {
    return undefined
  }

  if (!Number.isFinite(durationSeconds)) {
    throw new Error(`Invalid music duration: ${durationSeconds}`)
  }

  const durationMs = Math.round(durationSeconds * 1000)
  if (durationMs < ELEVENLABS_MIN_DURATION_MS || durationMs > ELEVENLABS_MAX_DURATION_MS) {
    throw new Error(`ElevenLabs music duration must be between 3 and 600 seconds. Received: ${durationSeconds}s`)
  }

  return durationMs
}

const readElevenLabsRequestId = (headers: Headers): string | undefined =>
  headers.get('request-id')
  ?? headers.get('x-request-id')
  ?? headers.get('xi-request-id')
  ?? undefined

export const runElevenLabsMusicGen = async (
  prompt: string,
  outputDir: string,
  options: {
    model: ElevenlabsMusicModel
    durationSeconds?: number | undefined
    forceInstrumental?: boolean | undefined
  }
): Promise<{ musicPath: string, metadata: Step7MusicMetadata }> => {
  const apiKey = readEnv('ELEVENLABS_API_KEY')
  if (!apiKey) {
    throw new Error('ELEVENLABS_API_KEY environment variable is required for ElevenLabs music generation')
  }

  const baseURL = ELEVENLABS_DEFAULT_BASE_URL
  const musicPath = `${outputDir}/generated-music.mp3`
  const musicDurationMs = normalizeMusicDurationMs(options.durationSeconds)
  const forceInstrumental = options.forceInstrumental === true

  logMediaGenerationStatus(l, {
    mediaType: 'music',
    provider: 'elevenlabs',
    model: options.model,
    status: 'started'
  })

  const startTime = Date.now()

  const audioResponse = await withRetry(
    { retryClass: 'runtime_http_create_conservative', operationName: 'elevenlabs-music' },
    async (signal) => {
      const timeoutSignal = AbortSignal.timeout(REQUEST_TIMEOUT_MS)
      const combined = AbortSignal.any([...(signal ? [signal] : []), timeoutSignal])

      const response = await fetch(`${baseURL}/music?output_format=${ELEVENLABS_MUSIC_OUTPUT_FORMAT}`, {
        method: 'POST',
        headers: {
          'xi-api-key': apiKey,
          'Content-Type': 'application/json',
          Accept: 'audio/mpeg'
        },
        body: JSON.stringify({
          model_id: options.model,
          prompt,
          ...(musicDurationMs !== undefined ? { music_length_ms: musicDurationMs } : {}),
          ...(forceInstrumental ? { force_instrumental: true } : {})
        }),
        signal: combined
      })

      if (!response.ok) {
        const errText = await readElevenLabsError(response)
        const err = new Error(`ElevenLabs music generation failed (${response.status}): ${errText}`) as Error & { status: number }
        err.status = response.status
        throw err
      }

      return {
        bytes: new Uint8Array(await response.arrayBuffer()),
        mimeType: response.headers.get('content-type')?.split(';')[0]?.trim() || undefined,
        requestId: readElevenLabsRequestId(response.headers)
      } satisfies ElevenLabsMusicResponseAudio
    },
    (error) => classifyFetchRetry(error, 'runtime_http_create_conservative')
  )
  const audioBytes = audioResponse.bytes
  if (audioBytes.byteLength === 0) {
    throw new Error('ElevenLabs music generation returned empty audio')
  }

  await Bun.write(musicPath, audioBytes)

  const processingTime = Date.now() - startTime
  const musicFile = Bun.file(musicPath)

  logMediaGenerationStatus(l, {
    mediaType: 'music',
    provider: 'elevenlabs',
    model: options.model,
    status: 'completed',
    processingTimeMs: processingTime,
    outputCount: 1
  })
  logLocationsTable(l, [{ artifact: 'music', path: musicPath }], { level: 'success' })

  const metadata: Step7MusicMetadata = {
    musicService: 'elevenlabs',
    musicModel: options.model,
    processingTime,
    musicFileName: 'generated-music.mp3',
    musicFileSize: musicFile.size,
    musicDurationMs,
    lyricsSource: forceInstrumental ? 'none' : 'generated',
    providerRequestId: audioResponse.requestId,
    audioMimeType: audioResponse.mimeType ?? 'audio/mpeg',
    audioSampleRate: ELEVENLABS_MUSIC_SAMPLE_RATE,
    audioBitrate: ELEVENLABS_MUSIC_BITRATE,
    providerAudioByteSize: audioBytes.byteLength,
    outputFormat: ELEVENLABS_MUSIC_OUTPUT_FORMAT
  }

  return { musicPath, metadata }
}
