import { mkdir } from 'node:fs/promises'
import { basename, dirname, extname } from 'node:path'
import * as v from 'valibot'
import type { GcloudTtsModel, Step4Metadata } from '~/types'
import { logTtsConfig } from '~/cli/commands/process-steps/step-4-tts/tts-utils/log-tts-config'
import { splitTextIntoUtf8ByteChunks, concatAndConvertToWav } from '~/cli/commands/process-steps/step-4-tts/tts-utils/audio-utils'
import { finalizeTtsRun } from '~/cli/commands/process-steps/step-4-tts/tts-utils/finalize-tts-run'
import {
  GCLOUD_DEFAULT_ICV_CONSENT_LANGUAGE,
  GCLOUD_DEFAULT_TTS_LANGUAGE,
  GCLOUD_DEFAULT_TTS_VOICES,
  validateGcloudTtsVoice
} from '~/cli/commands/setup-and-utilities/models/model-options'
import { withRetry, classifyFetchRetry } from '~/utils/retries'
import { readEnv } from '~/utils/validate/env-utils'
import { validateDataSafe } from '~/utils/validate/validation'
import { exec } from '~/utils/cli-utils'
import { materializeMediaInput } from '~/utils/media-url'
import { ensureGcloudTtsSetup } from './gcloud-tts'

const GCLOUD_TTS_DEFAULT_BASE_URL = 'https://texttospeech.googleapis.com'
const MAX_BYTES_PER_CHUNK = 4800
const GCLOUD_TTS_SAMPLE_RATE_HZ = 24000
const GCLOUD_TTS_ICV_MODEL = 'instant-custom-voice' as const

const GcloudSynthesizeResponseSchema = v.object({
  audioContent: v.string()
})

const GcloudVoiceCloningKeyResponseSchema = v.object({
  voiceCloningKey: v.string()
})

const GCLOUD_ICV_CONSENT_SCRIPTS = {
  'en-US': 'I am the owner of this voice and I consent to Google using this voice to create a synthetic voice model.'
} as const

const GCLOUD_ICV_AUDIO_ENCODINGS = {
  '.wav': 'LINEAR16',
  '.mp3': 'MP3',
  '.m4a': 'M4A',
  '.pcm': 'PCM'
} as const

type GcloudIcvAudioEncoding = typeof GCLOUD_ICV_AUDIO_ENCODINGS[keyof typeof GCLOUD_ICV_AUDIO_ENCODINGS]

type GcloudTtsRunOptions = {
  model: GcloudTtsModel
  voice?: string | undefined
  language?: string | undefined
  refAudioPath?: string | undefined
  consentAudioPath?: string | undefined
  consentLanguage?: string | undefined
  voiceCloningKey?: string | undefined
  voiceCloningKeyOut?: string | undefined
}

const trimTrailingSlash = (value: string): string => value.replace(/\/+$/, '')

const getGcloudTtsBaseUrl = (): string =>
  trimTrailingSlash(readEnv('GCLOUD_TTS_BASE_URL') ?? GCLOUD_TTS_DEFAULT_BASE_URL)

const decodeBase64Audio = (value: string): Uint8Array =>
  new Uint8Array(Buffer.from(value, 'base64'))

const inferLanguageFromVoice = (voice: string | undefined): string | undefined => {
  const parts = voice?.split('-')
  if (!parts || parts.length < 2) {
    return undefined
  }
  const [language, region] = parts
  if (!language || !region) {
    return undefined
  }
  return `${language}-${region}`
}

const resolveGcloudPrebuiltVoice = (model: Exclude<GcloudTtsModel, typeof GCLOUD_TTS_ICV_MODEL>, voice?: string | undefined): string =>
  validateGcloudTtsVoice(voice?.trim() || readEnv('GCLOUD_TTS_VOICE') || GCLOUD_DEFAULT_TTS_VOICES[model])

const resolveGcloudLanguage = (voice: string | undefined, explicitLanguage: string | undefined, fallback = GCLOUD_DEFAULT_TTS_LANGUAGE): string =>
  explicitLanguage?.trim() || readEnv('GCLOUD_TTS_LANGUAGE') || inferLanguageFromVoice(voice) || fallback

const readGcloudError = async (response: Response): Promise<string> => {
  const text = await response.text()
  return text.trim() || `HTTP ${response.status}`
}

const gcloudHeaders = (accessToken: string, projectId: string): Record<string, string> => ({
  Authorization: `Bearer ${accessToken}`,
  'x-goog-user-project': projectId,
  'Content-Type': 'application/json; charset=utf-8'
})

const synthesizeGcloudChunk = async (
  chunk: string,
  context: { accessToken: string, projectId: string },
  body: Record<string, unknown>,
  url: string,
  operationName: string
): Promise<Uint8Array> => {
  const payload = await withRetry(
    { retryClass: 'runtime_http_create_conservative', operationName },
    async (signal) => {
      const response = await fetch(url, {
        method: 'POST',
        headers: gcloudHeaders(context.accessToken, context.projectId),
        body: JSON.stringify({
          input: { text: chunk },
          ...body
        }),
        ...(signal ? { signal } : {})
      })

      if (!response.ok) {
        const errText = await readGcloudError(response)
        const err = new Error(`Google Cloud TTS failed (${response.status}): ${errText}`) as Error & { status: number, headers: Headers }
        err.status = response.status
        err.headers = response.headers
        throw err
      }

      const validated = validateDataSafe(GcloudSynthesizeResponseSchema, await response.json())
      if (!validated) {
        throw new Error('Google Cloud TTS returned an invalid response: missing audioContent')
      }
      return decodeBase64Audio(validated.audioContent)
    },
    (error) => classifyFetchRetry(error, 'runtime_http_create_conservative')
  )

  if (payload.byteLength === 0) {
    throw new Error('Google Cloud TTS returned empty audio')
  }

  return payload
}

const validateGcloudIcvConsentLanguage = (language: string): keyof typeof GCLOUD_ICV_CONSENT_SCRIPTS => {
  if (language in GCLOUD_ICV_CONSENT_SCRIPTS) {
    return language as keyof typeof GCLOUD_ICV_CONSENT_SCRIPTS
  }
  throw new Error(
    `Google Cloud instant custom voice consent language "${language}" is not supported by AutoShow yet. ` +
    `Allowed values: ${Object.keys(GCLOUD_ICV_CONSENT_SCRIPTS).join(', ')}.`
  )
}

const readFfprobeAudioInfo = async (
  audioPath: string
): Promise<{ durationSeconds?: number | undefined, channels?: number | undefined } | undefined> => {
  if (!Bun.which('ffprobe')) {
    return undefined
  }

  const result = await exec('ffprobe', [
    '-v', 'error',
    '-select_streams', 'a:0',
    '-show_entries', 'stream=channels:format=duration',
    '-of', 'json',
    audioPath
  ])
  if (result.exitCode !== 0) {
    return undefined
  }

  try {
    const payload = JSON.parse(result.stdout) as {
      streams?: Array<{ channels?: number }>
      format?: { duration?: string }
    }
    const durationRaw = payload.format?.duration
    const durationSeconds = durationRaw === undefined ? undefined : Number(durationRaw)
    const channels = payload.streams?.[0]?.channels
    return {
      ...(Number.isFinite(durationSeconds) ? { durationSeconds } : {}),
      ...(typeof channels === 'number' ? { channels } : {})
    }
  } catch {
    return undefined
  }
}

const validateGcloudIcvAudioFile = async (
  audioPath: string,
  label: string
): Promise<{ content: string, audioEncoding: GcloudIcvAudioEncoding }> => {
  const normalizedExt = extname(audioPath).toLowerCase() as keyof typeof GCLOUD_ICV_AUDIO_ENCODINGS
  const audioEncoding = GCLOUD_ICV_AUDIO_ENCODINGS[normalizedExt]
  if (!audioEncoding) {
    throw new Error(
      `Google Cloud instant custom voice ${label} audio must use one of these extensions: ` +
      `${Object.keys(GCLOUD_ICV_AUDIO_ENCODINGS).join(', ')}. Got: ${audioPath}`
    )
  }

  const file = Bun.file(audioPath)
  if (!await file.exists()) {
    throw new Error(`Google Cloud instant custom voice ${label} audio file not found: ${audioPath}`)
  }

  const bytes = await file.bytes()
  if (bytes.byteLength === 0) {
    throw new Error(`Google Cloud instant custom voice ${label} audio file is empty: ${audioPath}`)
  }

  const mediaInfo = await readFfprobeAudioInfo(audioPath)
  if (mediaInfo?.durationSeconds !== undefined && mediaInfo.durationSeconds > 10) {
    throw new Error(
      `Google Cloud instant custom voice ${label} audio must be 10 seconds or shorter. ` +
      `${basename(audioPath)} is ${mediaInfo.durationSeconds.toFixed(2)} seconds.`
    )
  }
  if (mediaInfo?.channels !== undefined && mediaInfo.channels !== 1) {
    throw new Error(
      `Google Cloud instant custom voice ${label} audio must be single-channel. ` +
      `${basename(audioPath)} has ${mediaInfo.channels} channels.`
    )
  }

  return {
    content: Buffer.from(bytes).toString('base64'),
    audioEncoding
  }
}

const writeGeneratedVoiceCloningKey = async (path: string, key: string): Promise<void> => {
  const dir = dirname(path)
  if (dir && dir !== '.') {
    await mkdir(dir, { recursive: true })
  }
  await Bun.write(path, `${key}\n`)
}

const generateGcloudVoiceCloningKey = async (
  context: { accessToken: string, projectId: string },
  options: {
    refAudioPath: string
    consentAudioPath: string
    consentLanguage: string
  }
): Promise<string> => {
  const consentLanguage = validateGcloudIcvConsentLanguage(options.consentLanguage)
  const [materializedRefAudio, materializedConsentAudio] = await Promise.all([
    materializeMediaInput(options.refAudioPath, {
      accept: 'audio/*,application/octet-stream;q=0.9,*/*;q=0.8',
      label: 'Google Cloud instant custom voice reference audio'
    }),
    materializeMediaInput(options.consentAudioPath, {
      accept: 'audio/*,application/octet-stream;q=0.9,*/*;q=0.8',
      label: 'Google Cloud instant custom voice consent audio'
    })
  ])

  try {
  const [referenceAudio, consentAudio] = await Promise.all([
    validateGcloudIcvAudioFile(materializedRefAudio.path, 'reference'),
    validateGcloudIcvAudioFile(materializedConsentAudio.path, 'consent')
  ])

  const response = await withRetry(
    {
      retryClass: 'runtime_http_create_conservative',
      operationName: 'gcloud-tts-voice-cloning-key',
      policy: { maxAttempts: 2 }
    },
    async (signal) => {
      const result = await fetch(`${getGcloudTtsBaseUrl()}/v1beta1/voices:generateVoiceCloningKey`, {
        method: 'POST',
        headers: gcloudHeaders(context.accessToken, context.projectId),
        body: JSON.stringify({
          reference_audio: {
            audio_config: { audio_encoding: referenceAudio.audioEncoding },
            content: referenceAudio.content
          },
          voice_talent_consent: {
            audio_config: { audio_encoding: consentAudio.audioEncoding },
            content: consentAudio.content
          },
          consent_script: GCLOUD_ICV_CONSENT_SCRIPTS[consentLanguage],
          language_code: consentLanguage
        }),
        ...(signal ? { signal } : {})
      })

      if (!result.ok) {
        const errText = await readGcloudError(result)
        const err = new Error(`Google Cloud TTS voice cloning key generation failed (${result.status}): ${errText}`) as Error & { status: number, headers: Headers }
        err.status = result.status
        err.headers = result.headers
        throw err
      }

      const validated = validateDataSafe(GcloudVoiceCloningKeyResponseSchema, await result.json())
      if (!validated || !validated.voiceCloningKey.trim()) {
        throw new Error('Google Cloud TTS voice cloning key generation returned an invalid response: missing voiceCloningKey')
      }
      return validated.voiceCloningKey
    },
    (error) => classifyFetchRetry(error, 'runtime_http_create_conservative')
  )

  return response.trim()
  } finally {
    await Promise.all([
      materializedRefAudio.cleanup(),
      materializedConsentAudio.cleanup()
    ])
  }
}

const resolveGcloudVoiceCloningKey = async (
  context: { accessToken: string, projectId: string },
  options: GcloudTtsRunOptions
): Promise<string> => {
  const providedKey = options.voiceCloningKey?.trim()
  if (providedKey) {
    return providedKey
  }

  const refAudioPath = options.refAudioPath?.trim()
  const consentAudioPath = options.consentAudioPath?.trim()
  if (!refAudioPath || !consentAudioPath) {
    throw new Error('Google Cloud instant custom voice requires --gcloud-tts-voice-cloning-key or both --gcloud-tts-ref-audio and --gcloud-tts-consent-audio.')
  }

  const consentLanguage = options.consentLanguage?.trim() || GCLOUD_DEFAULT_ICV_CONSENT_LANGUAGE
  const generatedKey = await generateGcloudVoiceCloningKey(context, {
    refAudioPath,
    consentAudioPath,
    consentLanguage
  })

  const keyOut = options.voiceCloningKeyOut?.trim()
  if (keyOut) {
    await writeGeneratedVoiceCloningKey(keyOut, generatedKey)
  }

  return generatedKey
}

export const runGcloudTts = async (
  text: string,
  outputDir: string,
  options: GcloudTtsRunOptions
): Promise<{ audioPath: string, metadata: Step4Metadata }> => {
  const context = await ensureGcloudTtsSetup()
  const chunks = splitTextIntoUtf8ByteChunks(text, MAX_BYTES_PER_CHUNK)
  if (chunks.length === 0) {
    throw new Error('Google Cloud TTS input text is empty')
  }

  const startTime = Date.now()
  const chunkPaths: string[] = []

  if (options.model === GCLOUD_TTS_ICV_MODEL) {
    const voiceCloningKey = await resolveGcloudVoiceCloningKey(context, options)
    const language = resolveGcloudLanguage(undefined, options.language, options.consentLanguage?.trim() || GCLOUD_DEFAULT_ICV_CONSENT_LANGUAGE)
    logTtsConfig('Google Cloud', [
      { label: 'model', value: options.model },
      { label: 'voice', value: 'instant-custom-voice' },
      { label: 'language', value: language },
      { label: 'chunk count', value: chunks.length },
      ...(options.voiceCloningKeyOut ? [{ label: 'voice cloning key out', value: options.voiceCloningKeyOut }] : [])
    ])

    try {
      for (let i = 0; i < chunks.length; i++) {
        const chunkIndex = i + 1
        const chunkPath = `${outputDir}/speech-gcloud-chunk-${String(chunkIndex).padStart(3, '0')}.wav`
        const audioBytes = await synthesizeGcloudChunk(
          chunks[i] as string,
          context,
          {
            voice: {
              language_code: language,
              voice_clone: {
                voice_cloning_key: voiceCloningKey
              }
            },
            audioConfig: {
              audioEncoding: 'LINEAR16',
              sampleRateHertz: GCLOUD_TTS_SAMPLE_RATE_HZ
            }
          },
          `${getGcloudTtsBaseUrl()}/v1beta1/text:synthesize`,
          `gcloud-tts-icv-chunk-${chunkIndex}`
        )
        await Bun.write(chunkPath, audioBytes)
        chunkPaths.push(chunkPath)
      }

      const audioPath = await concatAndConvertToWav(chunkPaths, outputDir, 'Gcloud')
      return finalizeTtsRun({
        service: 'gcloud',
        model: options.model,
        speaker: 'instant-custom-voice',
        audioPath,
        chunkCount: chunks.length,
        startTime
      })
    } finally {
      for (const chunkPath of chunkPaths) {
        await Bun.$`rm -f ${chunkPath}`.quiet().nothrow()
      }
    }
  }

  const voice = resolveGcloudPrebuiltVoice(options.model, options.voice)
  const language = resolveGcloudLanguage(voice, options.language)
  logTtsConfig('Google Cloud', [
    { label: 'model', value: options.model },
    { label: 'voice', value: voice },
    { label: 'language', value: language },
    { label: 'chunk count', value: chunks.length }
  ])

  try {
    for (let i = 0; i < chunks.length; i++) {
      const chunkIndex = i + 1
      const chunkPath = `${outputDir}/speech-gcloud-chunk-${String(chunkIndex).padStart(3, '0')}.wav`
      const audioBytes = await synthesizeGcloudChunk(
        chunks[i] as string,
        context,
        {
          voice: {
            languageCode: language,
            name: voice
          },
          audioConfig: {
            audioEncoding: 'LINEAR16',
            sampleRateHertz: GCLOUD_TTS_SAMPLE_RATE_HZ
          }
        },
        `${getGcloudTtsBaseUrl()}/v1/text:synthesize`,
        `gcloud-tts-chunk-${chunkIndex}`
      )
      await Bun.write(chunkPath, audioBytes)
      chunkPaths.push(chunkPath)
    }

    const audioPath = await concatAndConvertToWav(chunkPaths, outputDir, 'Gcloud')
    return finalizeTtsRun({
      service: 'gcloud',
      model: options.model,
      speaker: voice,
      audioPath,
      chunkCount: chunks.length,
      startTime
    })
  } finally {
    for (const chunkPath of chunkPaths) {
      await Bun.$`rm -f ${chunkPath}`.quiet().nothrow()
    }
  }
}
