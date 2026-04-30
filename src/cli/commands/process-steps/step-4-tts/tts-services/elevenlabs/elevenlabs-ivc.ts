import { stat } from 'node:fs/promises'
import { basename, extname } from 'node:path'
import * as v from 'valibot'
import * as l from '~/utils/logger'
import { validateData } from '~/utils/validate/validation'
import { getAudioDuration } from '~/cli/commands/process-steps/step-2-extract/step-2-stt/stt-utils/audio-splitter'
import { withRetry, classifyFetchRetry } from '~/utils/retries'
import { readElevenLabsError } from './elevenlabs-utils'

export const ELEVENLABS_TTS_IVC_COST_CENTS = 0
export const ELEVENLABS_TTS_IVC_SETUP_MS = 10_000
export const ELEVENLABS_TTS_IVC_SETUP_NOTE = 'ElevenLabs instant voice clone setup'

const ELEVENLABS_IVC_BEST_PRACTICE_MIN_SECONDS = 10
const ELEVENLABS_IVC_BEST_PRACTICE_MAX_SECONDS = 2 * 60

const ELEVENLABS_IVC_AUDIO_TYPES = new Map<string, string>([
  ['.mp3', 'audio/mpeg'],
  ['.mpeg', 'audio/mpeg'],
  ['.mpga', 'audio/mpeg'],
  ['.wav', 'audio/wav'],
  ['.wave', 'audio/wav'],
  ['.m4a', 'audio/mp4'],
  ['.mp4', 'audio/mp4'],
  ['.ogg', 'audio/ogg'],
  ['.oga', 'audio/ogg'],
  ['.flac', 'audio/flac'],
  ['.aac', 'audio/aac'],
  ['.webm', 'audio/webm']
])

const ElevenLabsIvcResponseSchema = v.object({
  voice_id: v.string(),
  requires_verification: v.boolean()
})

export type ElevenLabsTtsIvcAudio = {
  path: string
  basename: string
  mimeType: string
  sizeBytes: number
  durationSeconds?: number | undefined
}

export type ElevenLabsTtsIvcResult = {
  voiceId: string
  voiceName: string
  sourceAudio: ElevenLabsTtsIvcAudio
  requiresVerification: boolean
}

export type ElevenLabsTtsIvcContext = {
  voicePromise?: Promise<ElevenLabsTtsIvcResult> | undefined
}

export type ElevenLabsTtsIvcOptions = {
  refAudioPath: string
  voiceName?: string | undefined
  removeBackgroundNoise?: boolean | undefined
  context?: ElevenLabsTtsIvcContext | undefined
}

export const createElevenLabsTtsIvcContext = (): ElevenLabsTtsIvcContext => ({})

export const defaultElevenLabsTtsIvcVoiceName = (): string => `AutoShow_${Date.now()}`

export const validateElevenLabsTtsIvcAudio = async (
  audioPath: string
): Promise<ElevenLabsTtsIvcAudio> => {
  const normalizedPath = audioPath.trim()
  if (normalizedPath.length === 0) {
    throw new Error('ElevenLabs TTS IVC reference audio path is empty.')
  }

  const ext = extname(normalizedPath).toLowerCase()
  const mimeType = ELEVENLABS_IVC_AUDIO_TYPES.get(ext)
  if (!mimeType) {
    throw new Error('ElevenLabs TTS IVC reference audio must be an mp3/mpeg, wav, m4a/mp4, ogg, flac, aac, or webm file.')
  }

  let fileStats: Awaited<ReturnType<typeof stat>>
  try {
    fileStats = await stat(normalizedPath)
  } catch {
    throw new Error(`ElevenLabs TTS IVC reference audio not found: ${normalizedPath}`)
  }

  if (!fileStats.isFile()) {
    throw new Error(`ElevenLabs TTS IVC reference audio is not a file: ${normalizedPath}`)
  }
  if (fileStats.size <= 0) {
    throw new Error(`ElevenLabs TTS IVC reference audio is empty: ${normalizedPath}`)
  }

  let durationSeconds: number | undefined
  try {
    durationSeconds = await getAudioDuration(normalizedPath)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    l.warn(`Could not determine ElevenLabs TTS IVC reference audio duration; continuing anyway: ${message}`)
  }

  if (durationSeconds !== undefined && Number.isFinite(durationSeconds) && durationSeconds > 0) {
    if (durationSeconds < ELEVENLABS_IVC_BEST_PRACTICE_MIN_SECONDS) {
      l.warn(`ElevenLabs IVC reference audio is short (${durationSeconds.toFixed(2)}s); longer, varied speech samples usually improve clone consistency.`)
    } else if (durationSeconds > ELEVENLABS_IVC_BEST_PRACTICE_MAX_SECONDS) {
      l.warn(`ElevenLabs IVC reference audio is longer than the usual short-sample guidance (${durationSeconds.toFixed(2)}s); continuing without trimming.`)
    }
  }

  return {
    path: normalizedPath,
    basename: basename(normalizedPath),
    mimeType,
    sizeBytes: fileStats.size,
    ...(durationSeconds !== undefined && Number.isFinite(durationSeconds) && durationSeconds > 0 ? { durationSeconds } : {})
  }
}

const createElevenLabsTtsIvcVoice = async (
  baseURL: string,
  apiKey: string,
  options: ElevenLabsTtsIvcOptions
): Promise<ElevenLabsTtsIvcResult> => {
  const sourceAudio = await validateElevenLabsTtsIvcAudio(options.refAudioPath)
  const voiceName = options.voiceName?.trim() || defaultElevenLabsTtsIvcVoiceName()

  const data = await withRetry(
    { retryClass: 'runtime_http_create_conservative', operationName: 'elevenlabs-ivc-create' },
    async () => {
      const form = new FormData()
      form.append('name', voiceName)
      form.append('files', Bun.file(sourceAudio.path, { type: sourceAudio.mimeType }), sourceAudio.basename)
      form.append('remove_background_noise', options.removeBackgroundNoise === true ? 'true' : 'false')

      const response = await fetch(`${baseURL}/voices/add`, {
        method: 'POST',
        headers: {
          'xi-api-key': apiKey
        },
        body: form
      })

      if (!response.ok) {
        const errText = await readElevenLabsError(response)
        const err = new Error(`ElevenLabs IVC voice creation failed (${response.status}): ${errText}`) as Error & { status: number }
        err.status = response.status
        throw err
      }

      let payload: unknown
      try {
        payload = await response.json()
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        throw new Error(`ElevenLabs IVC voice creation returned invalid JSON: ${message}`)
      }

      return validateData(ElevenLabsIvcResponseSchema, payload, 'ElevenLabs IVC voice creation response')
    },
    (error) => classifyFetchRetry(error, 'runtime_http_create_conservative')
  )

  const result = {
    voiceId: data.voice_id,
    voiceName,
    sourceAudio,
    requiresVerification: data.requires_verification
  }

  if (result.requiresVerification) {
    throw new Error(
      `ElevenLabs IVC voice ${result.voiceId} was created but requires verification. Verify it in ElevenLabs, then rerun with --elevenlabs-voice ${result.voiceId} and omit --elevenlabs-tts-ref-audio.`
    )
  }

  return result
}

export const ensureElevenLabsTtsIvcVoice = async (
  baseURL: string,
  apiKey: string,
  options: ElevenLabsTtsIvcOptions
): Promise<ElevenLabsTtsIvcResult> => {
  const context = options.context
  if (context?.voicePromise) {
    return await context.voicePromise
  }

  let voicePromise: Promise<ElevenLabsTtsIvcResult>
  voicePromise = createElevenLabsTtsIvcVoice(baseURL, apiKey, options).catch((error) => {
    if (context?.voicePromise === voicePromise) {
      context.voicePromise = undefined
    }
    throw error
  })

  if (context) {
    context.voicePromise = voicePromise
  }

  return await voicePromise
}
