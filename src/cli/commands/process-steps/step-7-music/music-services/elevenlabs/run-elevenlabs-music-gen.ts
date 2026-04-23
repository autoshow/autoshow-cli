import type { Step7MusicMetadata } from '~/types'
import * as l from '~/utils/logger'
import { logLocationsTable } from '~/utils/logger/human-table'
import { logMediaGenerationStatus } from '~/cli/commands/process-steps/generation-command-utils'
import type { ElevenlabsMusicModel } from '~/cli/commands/setup-and-utilities/models/model-options'
import { readEnv } from '~/utils/validate/env-utils'
import { withRetry, classifyFetchRetry } from '~/utils/retries'
import { readElevenLabsError } from '~/utils/elevenlabs-utils'

const ELEVENLABS_MIN_DURATION_MS = 3000
const ELEVENLABS_MAX_DURATION_MS = 600000
const REQUEST_TIMEOUT_MS = 10 * 60_000

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

  const baseURL = readEnv('ELEVENLABS_BASE_URL') ?? 'https://api.elevenlabs.io/v1'
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

  const audioBytes = await withRetry(
    { retryClass: 'runtime_http_create_conservative', operationName: 'elevenlabs-music' },
    async (signal) => {
      const timeoutSignal = AbortSignal.timeout(REQUEST_TIMEOUT_MS)
      const combined = AbortSignal.any([...(signal ? [signal] : []), timeoutSignal])

      const response = await fetch(`${baseURL}/music?output_format=mp3_44100_128`, {
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

      return new Uint8Array(await response.arrayBuffer())
    },
    (error) => classifyFetchRetry(error, 'runtime_http_create_conservative')
  )
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
    lyricsSource: forceInstrumental ? 'none' : 'generated'
  }

  return { musicPath, metadata }
}
