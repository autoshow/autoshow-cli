import { stat } from 'node:fs/promises'
import { basename, extname } from 'node:path'
import * as v from 'valibot'
import { validateData } from '~/utils/validate/validation'

const OPENAI_DEFAULT_BASE_URL = 'https://api.openai.com/v1'
const OPENAI_DEFAULT_CONSENT_LANGUAGE = 'en-US'
const MAX_OPENAI_CUSTOM_VOICE_AUDIO_BYTES = 10 * 1024 * 1024

export const OPENAI_TTS_CLONE_COST_CENTS = 0
export const OPENAI_TTS_CLONE_SETUP_MS = 15_000
export const OPENAI_TTS_CLONE_SETUP_NOTE = 'OpenAI custom voice creation setup'

const OPENAI_CUSTOM_VOICE_AUDIO_TYPES = new Map<string, string>([
  ['.mp3', 'audio/mpeg'],
  ['.mpeg', 'audio/mpeg'],
  ['.mpga', 'audio/mpeg'],
  ['.wav', 'audio/wav'],
  ['.wave', 'audio/wav'],
  ['.ogg', 'audio/ogg'],
  ['.oga', 'audio/ogg'],
  ['.aac', 'audio/aac'],
  ['.flac', 'audio/flac'],
  ['.webm', 'audio/webm'],
  ['.mp4', 'audio/mp4'],
  ['.m4a', 'audio/mp4']
])

const OpenAIVoiceConsentResponseSchema = v.object({
  id: v.string()
})

const OpenAIVoiceResponseSchema = v.object({
  id: v.string(),
  name: v.optional(v.string(), undefined),
  object: v.optional(v.string(), undefined),
  created_at: v.optional(v.number(), undefined)
})

export type OpenAITtsCustomVoiceAudio = {
  path: string
  basename: string
  mimeType: string
  sizeBytes: number
}

export type OpenAITtsCustomVoiceResult = {
  voiceId: string
  sampleAudio: OpenAITtsCustomVoiceAudio
  voiceName: string
}

export type OpenAITtsCustomVoiceContext = {
  voicePromise?: Promise<OpenAITtsCustomVoiceResult> | undefined
}

export type OpenAITtsCustomVoiceOptions = {
  refAudioPath: string
  consentId?: string | undefined
  consentAudioPath?: string | undefined
  consentLanguage?: string | undefined
  consentName?: string | undefined
  voiceName?: string | undefined
  context?: OpenAITtsCustomVoiceContext | undefined
}

export const createOpenAITtsCustomVoiceContext = (): OpenAITtsCustomVoiceContext => ({})

export const resolveOpenAITtsBaseUrl = (baseURL?: string | undefined): string =>
  (baseURL?.trim() || OPENAI_DEFAULT_BASE_URL).replace(/\/+$/, '')

const sanitizeGeneratedName = (value: string): string =>
  value
    .trim()
    .replace(/\.[^.]+$/, '')
    .replace(/[^A-Za-z0-9_. -]+/g, '_')
    .replace(/\s+/g, '_')
    .replace(/^_+|_+$/g, '')

export const defaultOpenAITtsConsentName = (audioPath: string): string => {
  const label = sanitizeGeneratedName(basename(audioPath))
  return label || `AutoShow_consent_${Date.now()}`
}

export const defaultOpenAITtsVoiceName = (): string => `AutoShow_${Date.now()}`

const readOpenAIJsonResponse = async (response: Response, operationName: string): Promise<unknown> => {
  try {
    return await response.json()
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    throw new Error(`${operationName} returned invalid JSON: ${message}`)
  }
}

const readOpenAIErrorBody = async (response: Response): Promise<string> => {
  try {
    return await response.text()
  } catch {
    return ''
  }
}

export const validateOpenAITtsCustomVoiceAudio = async (
  audioPath: string,
  label = 'audio'
): Promise<OpenAITtsCustomVoiceAudio> => {
  const normalizedPath = audioPath.trim()
  if (normalizedPath.length === 0) {
    throw new Error(`OpenAI TTS custom voice ${label} path is empty.`)
  }

  const ext = extname(normalizedPath).toLowerCase()
  const mimeType = OPENAI_CUSTOM_VOICE_AUDIO_TYPES.get(ext)
  if (!mimeType) {
    throw new Error(`OpenAI TTS custom voice ${label} must be an mp3/mpeg, wav, ogg, aac, flac, webm, mp4, or m4a file.`)
  }

  let fileStats: Awaited<ReturnType<typeof stat>>
  try {
    fileStats = await stat(normalizedPath)
  } catch {
    throw new Error(`OpenAI TTS custom voice ${label} not found: ${normalizedPath}`)
  }

  if (!fileStats.isFile()) {
    throw new Error(`OpenAI TTS custom voice ${label} is not a file: ${normalizedPath}`)
  }
  if (fileStats.size <= 0) {
    throw new Error(`OpenAI TTS custom voice ${label} is empty: ${normalizedPath}`)
  }
  if (fileStats.size > MAX_OPENAI_CUSTOM_VOICE_AUDIO_BYTES) {
    throw new Error(`OpenAI TTS custom voice ${label} exceeds 10 MiB: ${normalizedPath}`)
  }

  return {
    path: normalizedPath,
    basename: basename(normalizedPath),
    mimeType,
    sizeBytes: fileStats.size
  }
}

const appendAudioFile = (form: FormData, fieldName: string, audio: OpenAITtsCustomVoiceAudio): void => {
  form.append(fieldName, Bun.file(audio.path, { type: audio.mimeType }), audio.basename)
}

const uploadOpenAITtsVoiceConsent = async (
  baseURL: string,
  apiKey: string,
  options: {
    consentAudioPath: string
    consentLanguage?: string | undefined
    consentName?: string | undefined
  }
): Promise<string> => {
  const consentAudio = await validateOpenAITtsCustomVoiceAudio(options.consentAudioPath, 'consent recording')
  const form = new FormData()
  form.append('name', options.consentName?.trim() || defaultOpenAITtsConsentName(consentAudio.path))
  form.append('language', options.consentLanguage?.trim() || OPENAI_DEFAULT_CONSENT_LANGUAGE)
  appendAudioFile(form, 'recording', consentAudio)

  const response = await fetch(`${baseURL}/audio/voice_consents`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`
    },
    body: form
  })

  if (!response.ok) {
    const body = await readOpenAIErrorBody(response)
    throw new Error(`OpenAI TTS voice consent upload failed (${response.status}): ${body || 'No response body'}`)
  }

  const data = validateData(
    OpenAIVoiceConsentResponseSchema,
    await readOpenAIJsonResponse(response, 'OpenAI TTS voice consent upload response'),
    'OpenAI TTS voice consent upload response'
  )
  return data.id
}

const createOpenAITtsCustomVoice = async (
  baseURL: string,
  apiKey: string,
  options: OpenAITtsCustomVoiceOptions
): Promise<OpenAITtsCustomVoiceResult> => {
  const sampleAudio = await validateOpenAITtsCustomVoiceAudio(options.refAudioPath, 'sample audio')
  const consentId = options.consentId?.trim() || (
    options.consentAudioPath
      ? await uploadOpenAITtsVoiceConsent(baseURL, apiKey, {
          consentAudioPath: options.consentAudioPath,
          consentLanguage: options.consentLanguage,
          consentName: options.consentName
        })
      : undefined
  )

  if (!consentId) {
    throw new Error('OpenAI TTS custom voice creation requires --openai-tts-consent-id or --openai-tts-consent-audio.')
  }

  const voiceName = options.voiceName?.trim() || defaultOpenAITtsVoiceName()
  const form = new FormData()
  form.append('name', voiceName)
  form.append('consent', consentId)
  appendAudioFile(form, 'audio_sample', sampleAudio)

  const response = await fetch(`${baseURL}/audio/voices`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`
    },
    body: form
  })

  if (!response.ok) {
    const body = await readOpenAIErrorBody(response)
    throw new Error(`OpenAI TTS voice creation failed (${response.status}): ${body || 'No response body'}`)
  }

  const data = validateData(
    OpenAIVoiceResponseSchema,
    await readOpenAIJsonResponse(response, 'OpenAI TTS voice creation response'),
    'OpenAI TTS voice creation response'
  )

  return {
    voiceId: data.id,
    sampleAudio,
    voiceName
  }
}

export const ensureOpenAITtsCustomVoice = async (
  baseURL: string,
  apiKey: string,
  options: OpenAITtsCustomVoiceOptions
): Promise<OpenAITtsCustomVoiceResult> => {
  const context = options.context
  if (context?.voicePromise) {
    return await context.voicePromise
  }

  let voicePromise: Promise<OpenAITtsCustomVoiceResult>
  voicePromise = createOpenAITtsCustomVoice(baseURL, apiKey, options).catch((error) => {
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

export const toOpenAISpeechVoice = (voiceId: string): string | { id: string } => {
  const normalized = voiceId.trim()
  return normalized.startsWith('voice_') ? { id: normalized } : normalized
}
