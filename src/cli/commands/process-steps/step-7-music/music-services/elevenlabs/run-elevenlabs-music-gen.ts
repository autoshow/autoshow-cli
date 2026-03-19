import * as v from 'valibot'
import type { Step7MusicMetadata } from '~/types'
import * as l from '~/logger'
import type { ElevenlabsMusicModel } from '~/cli/commands/models/model-options'
import { readEnv, readEnvFallback } from '~/utils/validate/env-utils'
import { validateDataSafe } from '~/utils/validate/validation'
import { withRetry, classifyFetchRetry } from '~/utils/retries'

const ELEVENLABS_MIN_DURATION_MS = 3000
const ELEVENLABS_MAX_DURATION_MS = 600000
const REQUEST_TIMEOUT_MS = 10 * 60_000

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
    const validated = validateDataSafe(ElevenLabsErrorSchema, parsed, 'ElevenLabs music error response')
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
  const apiKey = readEnvFallback('ELEVENLABS_API_KEY')
  if (!apiKey) {
    throw new Error('ELEVENLABS_API_KEY environment variable is required for ElevenLabs music generation')
  }

  const baseURL = readEnv('ELEVENLABS_BASE_URL') ?? 'https://api.elevenlabs.io/v1'
  const musicPath = `${outputDir}/generated-music.mp3`
  const musicDurationMs = normalizeMusicDurationMs(options.durationSeconds)
  const forceInstrumental = options.forceInstrumental === true

  l.info(`ElevenLabs music model: ${options.model}`)

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

  l.success(`Music saved to ${musicPath}`)

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
