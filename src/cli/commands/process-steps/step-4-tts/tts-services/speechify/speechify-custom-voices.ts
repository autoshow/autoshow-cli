import { stat } from 'node:fs/promises'
import { basename, extname } from 'node:path'
import * as v from 'valibot'
import * as l from '~/utils/logger'
import { getAudioDuration } from '~/cli/commands/process-steps/step-2-extract/step-2-stt/stt-utils/audio-splitter'
import { withRetry, classifyFetchRetry } from '~/utils/retries'
import { validateData } from '~/utils/validate/validation'
import { materializeMediaInput } from '~/utils/media-url'

export const SPEECHIFY_TTS_CUSTOM_VOICE_COST_CENTS = 0
export const SPEECHIFY_TTS_CUSTOM_VOICE_SETUP_MS = 10_000
export const SPEECHIFY_TTS_CUSTOM_VOICE_SETUP_NOTE = 'Speechify custom voice creation setup'

const SPEECHIFY_TTS_DEFAULT_CUSTOM_VOICE_LOCALE = 'en-US'
const SPEECHIFY_TTS_DEFAULT_CUSTOM_VOICE_GENDER = 'notSpecified'
const SPEECHIFY_TTS_CUSTOM_VOICE_MIN_SECONDS = 10
const SPEECHIFY_TTS_CUSTOM_VOICE_MAX_SECONDS = 30
const SPEECHIFY_TTS_CUSTOM_VOICE_MAX_BYTES = 5 * 1024 * 1024

const SPEECHIFY_CUSTOM_VOICE_AUDIO_TYPES = new Map<string, string>([
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

const SpeechifyVoiceResponseSchema = v.object({
  id: v.string()
})

const SPEECHIFY_CUSTOM_VOICE_GENDERS = ['male', 'female', 'notSpecified'] as const

type SpeechifyTtsCustomVoiceGender = typeof SPEECHIFY_CUSTOM_VOICE_GENDERS[number]

export type SpeechifyTtsCustomVoiceAudio = {
  path: string
  basename: string
  mimeType: string
  sizeBytes: number
  durationSeconds?: number | undefined
}

export type SpeechifyTtsCustomVoiceResult = {
  voiceId: string
  voiceName: string
  locale: string
  gender: SpeechifyTtsCustomVoiceGender
  sourceAudio: SpeechifyTtsCustomVoiceAudio
}

export type SpeechifyTtsCustomVoiceContext = {
  voicePromise?: Promise<SpeechifyTtsCustomVoiceResult> | undefined
}

export type SpeechifyTtsCustomVoiceOptions = {
  refAudioPath: string
  voiceName?: string | undefined
  consentName?: string | undefined
  consentEmail?: string | undefined
  locale?: string | undefined
  gender?: string | undefined
  context?: SpeechifyTtsCustomVoiceContext | undefined
}

export const createSpeechifyTtsCustomVoiceContext = (): SpeechifyTtsCustomVoiceContext => ({})

export const defaultSpeechifyTtsCustomVoiceName = (): string => `AutoShow_${Date.now()}`

const isSpeechifyCustomVoiceGender = (value: string): value is SpeechifyTtsCustomVoiceGender =>
  (SPEECHIFY_CUSTOM_VOICE_GENDERS as readonly string[]).includes(value)

export const validateSpeechifyTtsCustomVoiceGender = (
  value: string | undefined
): SpeechifyTtsCustomVoiceGender => {
  const normalized = value?.trim() || SPEECHIFY_TTS_DEFAULT_CUSTOM_VOICE_GENDER
  if (isSpeechifyCustomVoiceGender(normalized)) {
    return normalized
  }

  throw new Error('Invalid --speechify-tts-voice-gender value. Expected male, female, or notSpecified.')
}

const resolveSpeechifyTtsCustomVoiceLocale = (value: string | undefined): string => {
  const normalized = value?.trim() || SPEECHIFY_TTS_DEFAULT_CUSTOM_VOICE_LOCALE
  if (normalized.length === 0) {
    throw new Error('Speechify TTS custom voice locale is empty.')
  }
  return normalized
}

const resolveSpeechifyTtsCustomVoiceConsent = (
  consentName: string | undefined,
  consentEmail: string | undefined
): { fullName: string, email: string } => {
  const fullName = consentName?.trim()
  const email = consentEmail?.trim()

  if (!fullName) {
    throw new Error('Speechify TTS custom voice creation requires --speechify-tts-consent-name.')
  }
  if (!email) {
    throw new Error('Speechify TTS custom voice creation requires --speechify-tts-consent-email.')
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error('Invalid --speechify-tts-consent-email value. Expected an email address.')
  }

  return { fullName, email }
}

export const validateSpeechifyTtsCustomVoiceAudio = async (
  audioPath: string
): Promise<SpeechifyTtsCustomVoiceAudio> => {
  const normalizedPath = audioPath.trim()
  if (normalizedPath.length === 0) {
    throw new Error('Speechify TTS custom voice reference audio path is empty.')
  }

  const ext = extname(normalizedPath).toLowerCase()
  const mimeType = SPEECHIFY_CUSTOM_VOICE_AUDIO_TYPES.get(ext)
  if (!mimeType) {
    throw new Error('Speechify TTS custom voice reference audio must be an mp3/mpeg, wav, m4a/mp4, ogg, flac, aac, or webm file.')
  }

  let fileStats: Awaited<ReturnType<typeof stat>>
  try {
    fileStats = await stat(normalizedPath)
  } catch {
    throw new Error(`Speechify TTS custom voice reference audio not found: ${normalizedPath}`)
  }

  if (!fileStats.isFile()) {
    throw new Error(`Speechify TTS custom voice reference audio is not a file: ${normalizedPath}`)
  }
  if (fileStats.size <= 0) {
    throw new Error(`Speechify TTS custom voice reference audio is empty: ${normalizedPath}`)
  }
  if (fileStats.size > SPEECHIFY_TTS_CUSTOM_VOICE_MAX_BYTES) {
    throw new Error(`Speechify TTS custom voice reference audio exceeds 5 MiB: ${normalizedPath}`)
  }

  let durationSeconds: number | undefined
  try {
    const detectedDuration = await getAudioDuration(normalizedPath)
    if (Number.isFinite(detectedDuration) && detectedDuration > 0) {
      durationSeconds = detectedDuration
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    l.warn(`Could not determine Speechify TTS custom voice reference audio duration; continuing anyway: ${message}`)
  }

  if (durationSeconds !== undefined) {
    if (durationSeconds < SPEECHIFY_TTS_CUSTOM_VOICE_MIN_SECONDS || durationSeconds > SPEECHIFY_TTS_CUSTOM_VOICE_MAX_SECONDS) {
      throw new Error(`Speechify TTS custom voice reference audio must be 10-30 seconds when duration can be detected; got ${durationSeconds.toFixed(2)}s.`)
    }
  }

  return {
    path: normalizedPath,
    basename: basename(normalizedPath),
    mimeType,
    sizeBytes: fileStats.size,
    ...(durationSeconds !== undefined ? { durationSeconds } : {})
  }
}

const readSpeechifyErrorBody = async (response: Response): Promise<string> => {
  try {
    const text = await response.text()
    return text.trim()
  } catch {
    return ''
  }
}

const readSpeechifyJsonResponse = async (response: Response, operationName: string): Promise<unknown> => {
  try {
    return await response.json()
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    throw new Error(`${operationName} returned invalid JSON: ${message}`)
  }
}

const appendAudioFile = (form: FormData, fieldName: string, audio: SpeechifyTtsCustomVoiceAudio): void => {
  form.append(
    fieldName,
    new File([Bun.file(audio.path, { type: audio.mimeType })], audio.basename, { type: audio.mimeType }),
    audio.basename
  )
}

const createSpeechifyTtsCustomVoice = async (
  baseURL: string,
  apiKey: string,
  options: SpeechifyTtsCustomVoiceOptions
): Promise<SpeechifyTtsCustomVoiceResult> => {
  const materializedRefAudio = await materializeMediaInput(options.refAudioPath, {
    accept: 'audio/*,application/octet-stream;q=0.9,*/*;q=0.8',
    label: 'Speechify TTS custom voice reference audio'
  })

  try {
  const sourceAudio = await validateSpeechifyTtsCustomVoiceAudio(materializedRefAudio.path)
  const voiceName = options.voiceName?.trim() || defaultSpeechifyTtsCustomVoiceName()
  const locale = resolveSpeechifyTtsCustomVoiceLocale(options.locale)
  const gender = validateSpeechifyTtsCustomVoiceGender(options.gender)
  resolveSpeechifyTtsCustomVoiceConsent(options.consentName, options.consentEmail)

  const data = await withRetry(
    { retryClass: 'runtime_http_create_conservative', operationName: 'speechify-tts-custom-voice-create' },
    async (signal) => {
      const form = new FormData()
      form.append('name', voiceName)
      form.append('consent', 'true')
      appendAudioFile(form, 'sample', sourceAudio)

      const response = await fetch(`${baseURL}/v1/voices`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`
        },
        body: form,
        ...(signal ? { signal } : {})
      })

      if (!response.ok) {
        const body = await readSpeechifyErrorBody(response)
        const err = new Error(`Speechify TTS custom voice creation failed (${response.status}): ${body || 'No response body'}`) as Error & { status: number, headers: Headers }
        err.status = response.status
        err.headers = response.headers
        throw err
      }

      return validateData(
        SpeechifyVoiceResponseSchema,
        await readSpeechifyJsonResponse(response, 'Speechify TTS custom voice creation response'),
        'Speechify TTS custom voice creation response'
      )
    },
    (error) => classifyFetchRetry(error, 'runtime_http_create_conservative')
  )

  return {
    voiceId: data.id,
    voiceName,
    locale,
    gender,
    sourceAudio
  }
  } finally {
    await materializedRefAudio.cleanup()
  }
}

export const ensureSpeechifyTtsCustomVoice = async (
  baseURL: string,
  apiKey: string,
  options: SpeechifyTtsCustomVoiceOptions
): Promise<SpeechifyTtsCustomVoiceResult> => {
  const context = options.context
  if (context?.voicePromise) {
    return await context.voicePromise
  }

  let voicePromise: Promise<SpeechifyTtsCustomVoiceResult>
  voicePromise = createSpeechifyTtsCustomVoice(baseURL, apiKey, options).catch((error) => {
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
