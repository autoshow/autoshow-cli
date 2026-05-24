import { stat } from 'node:fs/promises'
import { basename, extname } from 'node:path'
import * as v from 'valibot'
import { validateData } from '~/utils/validate/validation'
import { createOpenAIVoice, createOpenAIVoiceConsent } from '~/utils/openai/client'
import { OPENAI_DEFAULT_BASE_URL } from '~/utils/base-urls'
import { materializeMediaInput } from '~/utils/media-url'
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

  const data = validateData(
    OpenAIVoiceConsentResponseSchema,
    await createOpenAIVoiceConsent({ apiKey, baseURL }, form, {
      errorMessagePrefix: 'OpenAI TTS voice consent upload failed'
    }),
    'OpenAI TTS voice consent upload response'
  )
  return data.id
}

const createOpenAITtsCustomVoice = async (
  baseURL: string,
  apiKey: string,
  options: OpenAITtsCustomVoiceOptions
): Promise<OpenAITtsCustomVoiceResult> => {
  const materializedSampleAudio = await materializeMediaInput(options.refAudioPath, {
    accept: 'audio/*,application/octet-stream;q=0.9,*/*;q=0.8',
    label: 'OpenAI TTS custom voice sample audio'
  })
  const materializedConsentAudio = options.consentAudioPath
    ? await materializeMediaInput(options.consentAudioPath, {
        accept: 'audio/*,application/octet-stream;q=0.9,*/*;q=0.8',
        label: 'OpenAI TTS custom voice consent recording'
      })
    : undefined

  try {
  const sampleAudio = await validateOpenAITtsCustomVoiceAudio(materializedSampleAudio.path, 'sample audio')
  const consentId = options.consentId?.trim() || (
    materializedConsentAudio
      ? await uploadOpenAITtsVoiceConsent(baseURL, apiKey, {
          consentAudioPath: materializedConsentAudio.path,
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

  const data = validateData(
    OpenAIVoiceResponseSchema,
    await createOpenAIVoice({ apiKey, baseURL }, form, {
      errorMessagePrefix: 'OpenAI TTS voice creation failed'
    }),
    'OpenAI TTS voice creation response'
  )

  return {
    voiceId: data.id,
    sampleAudio,
    voiceName
  }
  } finally {
    await Promise.all([
      materializedSampleAudio.cleanup(),
      materializedConsentAudio?.cleanup() ?? Promise.resolve()
    ])
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
