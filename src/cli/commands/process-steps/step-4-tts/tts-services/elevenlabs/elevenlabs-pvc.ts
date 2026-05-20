import { Buffer } from 'node:buffer'
import { mkdir, readdir, stat } from 'node:fs/promises'
import { basename, dirname, extname, join } from 'node:path'
import * as v from 'valibot'
import * as l from '~/utils/logger'
import { getAudioDuration } from '~/cli/commands/process-steps/step-2-extract/step-2-stt/stt-utils/audio-splitter'
import { withRetry, classifyFetchRetry } from '~/utils/retries'
import { validateData } from '~/utils/validate/validation'
import { readElevenLabsError } from './elevenlabs-utils'
import { materializeMediaInput, type MaterializedMediaInput } from '~/utils/media-url'

export const ELEVENLABS_TTS_PVC_COST_CENTS = 0
export const ELEVENLABS_TTS_PVC_ENGLISH_SETUP_MS = 3 * 60 * 60 * 1000
export const ELEVENLABS_TTS_PVC_MULTILINGUAL_SETUP_MS = 6 * 60 * 60 * 1000
export const ELEVENLABS_TTS_PVC_SETUP_NOTE = 'ElevenLabs professional voice clone training'

const ELEVENLABS_PVC_MIN_RECOMMENDED_SECONDS = 30 * 60
const ELEVENLABS_PVC_MAX_RECOMMENDED_SECONDS = 180 * 60
const ELEVENLABS_PVC_DEFAULT_POLL_INTERVAL_MS = 30_000
const ELEVENLABS_PVC_DEFAULT_TIMEOUT_MS = 8 * 60 * 60 * 1000

const ELEVENLABS_PVC_AUDIO_TYPES = new Map<string, string>([
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

const ElevenLabsPvcCreateResponseSchema = v.object({
  voice_id: v.string()
})

const ElevenLabsPvcSampleResponseSchema = v.array(v.looseObject({
  sample_id: v.optional(v.nullable(v.string()), undefined),
  file_name: v.optional(v.nullable(v.string()), undefined),
  mime_type: v.optional(v.nullable(v.string()), undefined),
  size_bytes: v.optional(v.nullable(v.number()), undefined),
  duration_secs: v.optional(v.nullable(v.number()), undefined)
}))

const ElevenLabsPvcStatusResponseSchema = v.object({
  status: v.string()
})

const ElevenLabsPvcVoiceResponseSchema = v.looseObject({
  voice_id: v.optional(v.string(), undefined),
  name: v.optional(v.string(), undefined),
  fine_tuning: v.optional(v.nullable(v.looseObject({
    state: v.optional(v.record(v.string(), v.string()), undefined),
    progress: v.optional(v.record(v.string(), v.number()), undefined)
  })), undefined)
})

export type ElevenLabsTtsPvcAudio = {
  path: string
  basename: string
  mimeType: string
  sizeBytes: number
  durationSeconds?: number | undefined
}

export type ElevenLabsTtsPvcUploadedSample = {
  sampleId?: string | undefined
  fileName?: string | undefined
  mimeType?: string | undefined
  sizeBytes?: number | undefined
  durationSeconds?: number | undefined
}

export type ElevenLabsTtsPvcSetupOptions = {
  model: string
  pvcVoiceId?: string | undefined
  samplePaths?: string[] | undefined
  sampleDir?: string | undefined
  voiceName?: string | undefined
  language?: string | undefined
  description?: string | undefined
  captchaOut?: string | undefined
  verifyAudioPath?: string | undefined
  wait?: boolean | undefined
  outputDir?: string | undefined
  pollIntervalMs?: number | undefined
  timeoutMs?: number | undefined
}

export type ElevenLabsTtsPvcPollResult = {
  voiceId: string
  model: string
  state?: string | undefined
  progress?: number | undefined
  elapsedMs: number
}

export type ElevenLabsTtsPvcSetupResult = {
  voiceId: string
  model: string
  voiceName?: string | undefined
  language: string
  description?: string | undefined
  createdVoice: boolean
  sampleAudio: ElevenLabsTtsPvcAudio[]
  totalSampleDurationSeconds?: number | undefined
  uploadedSamples: ElevenLabsTtsPvcUploadedSample[]
  captchaPath?: string | undefined
  verificationStatus?: string | undefined
  trainingStatus?: string | undefined
  fineTuningState?: string | undefined
  fineTuningProgress?: number | undefined
  readyForSynthesis: boolean
  actions: string[]
}

export type ElevenLabsTtsPvcStatusArtifact = ElevenLabsTtsPvcSetupResult & {
  status: 'setup_complete' | 'ready'
  createdAt: string
  statusFileName: string
}

export const getElevenLabsTtsPvcSetupMs = (language: string | undefined): number => {
  const normalized = (language?.trim() || 'en').toLowerCase()
  return normalized === 'en' || normalized.startsWith('en-')
    ? ELEVENLABS_TTS_PVC_ENGLISH_SETUP_MS
    : ELEVENLABS_TTS_PVC_MULTILINGUAL_SETUP_MS
}

export const defaultElevenLabsTtsPvcVoiceName = (): string => `AutoShow_PVC_${Date.now()}`

export const isElevenLabsTtsPvcSetupRequested = (options: {
  elevenlabsTtsPvcSamples?: string[] | undefined
  elevenlabsTtsPvcSampleDir?: string | undefined
  elevenlabsTtsPvcCaptchaOut?: string | undefined
  elevenlabsTtsPvcVerifyAudio?: string | undefined
}): boolean =>
  Boolean(
    (options.elevenlabsTtsPvcSamples?.length ?? 0) > 0
    || options.elevenlabsTtsPvcSampleDir?.trim()
    || options.elevenlabsTtsPvcCaptchaOut?.trim()
    || options.elevenlabsTtsPvcVerifyAudio?.trim()
  )

export const validateElevenLabsTtsPvcAudio = async (
  audioPath: string,
  label = 'sample audio'
): Promise<ElevenLabsTtsPvcAudio> => {
  const normalizedPath = audioPath.trim()
  if (normalizedPath.length === 0) {
    throw new Error(`ElevenLabs PVC ${label} path is empty.`)
  }

  const ext = extname(normalizedPath).toLowerCase()
  const mimeType = ELEVENLABS_PVC_AUDIO_TYPES.get(ext)
  if (!mimeType) {
    throw new Error(`ElevenLabs PVC ${label} must be an mp3/mpeg, wav, m4a/mp4, ogg, flac, aac, or webm file.`)
  }

  let fileStats: Awaited<ReturnType<typeof stat>>
  try {
    fileStats = await stat(normalizedPath)
  } catch {
    throw new Error(`ElevenLabs PVC ${label} not found: ${normalizedPath}`)
  }

  if (!fileStats.isFile()) {
    throw new Error(`ElevenLabs PVC ${label} is not a file: ${normalizedPath}`)
  }
  if (fileStats.size <= 0) {
    throw new Error(`ElevenLabs PVC ${label} is empty: ${normalizedPath}`)
  }

  let durationSeconds: number | undefined
  try {
    durationSeconds = await getAudioDuration(normalizedPath)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    l.warn(`Could not determine ElevenLabs PVC ${label} duration; continuing anyway: ${message}`)
  }

  return {
    path: normalizedPath,
    basename: basename(normalizedPath),
    mimeType,
    sizeBytes: fileStats.size,
    ...(durationSeconds !== undefined && Number.isFinite(durationSeconds) && durationSeconds > 0 ? { durationSeconds } : {})
  }
}

export const collectElevenLabsTtsPvcSamplePaths = async (
  samplePaths: string[] | undefined,
  sampleDir: string | undefined
): Promise<string[]> => {
  const paths = (samplePaths ?? []).map((item) => item.trim()).filter(Boolean)
  const dir = sampleDir?.trim()
  if (dir) {
    let dirStats: Awaited<ReturnType<typeof stat>>
    try {
      dirStats = await stat(dir)
    } catch {
      throw new Error(`ElevenLabs PVC sample directory not found: ${dir}`)
    }
    if (!dirStats.isDirectory()) {
      throw new Error(`ElevenLabs PVC sample directory is not a directory: ${dir}`)
    }

    const entries = await readdir(dir, { withFileTypes: true })
    for (const entry of entries) {
      if (!entry.isFile()) continue
      const fullPath = join(dir, entry.name)
      if (ELEVENLABS_PVC_AUDIO_TYPES.has(extname(fullPath).toLowerCase())) {
        paths.push(fullPath)
      }
    }
  }

  const uniquePaths = [...new Set(paths)]
  if (uniquePaths.length === 0) {
    throw new Error('ElevenLabs PVC setup requires at least one --elevenlabs-tts-pvc-sample or audio file in --elevenlabs-tts-pvc-sample-dir.')
  }
  return uniquePaths
}

export const validateElevenLabsTtsPvcSamples = async (
  samplePaths: string[] | undefined,
  sampleDir: string | undefined
): Promise<ElevenLabsTtsPvcAudio[]> => {
  const paths = await collectElevenLabsTtsPvcSamplePaths(samplePaths, sampleDir)
  const audio = await Promise.all(paths.map((path) => validateElevenLabsTtsPvcAudio(path, 'sample audio')))
  const durations = audio
    .map((item) => item.durationSeconds)
    .filter((duration): duration is number => typeof duration === 'number' && Number.isFinite(duration) && duration > 0)

  if (durations.length === audio.length) {
    const total = durations.reduce((sum, duration) => sum + duration, 0)
    if (total < ELEVENLABS_PVC_MIN_RECOMMENDED_SECONDS) {
      l.warn(`ElevenLabs PVC sample audio totals ${(total / 60).toFixed(1)} minutes; ElevenLabs recommends at least 30 minutes.`)
    } else if (total > ELEVENLABS_PVC_MAX_RECOMMENDED_SECONDS) {
      l.warn(`ElevenLabs PVC sample audio totals ${(total / 60).toFixed(1)} minutes; consider splitting or reducing samples near the 3 hour guidance.`)
    }
  } else {
    l.warn('Could not determine every ElevenLabs PVC sample duration; total sample duration guidance could not be checked.')
  }

  return audio
}

const parseElevenLabsJsonResponse = async <T extends v.BaseSchema<unknown, unknown, v.BaseIssue<unknown>>>(
  response: Response,
  schema: T,
  label: string
): Promise<v.InferOutput<T>> => {
  let payload: unknown
  try {
    payload = await response.json()
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    throw new Error(`${label} returned invalid JSON: ${message}`)
  }
  return validateData(schema, payload, label)
}

export const createElevenLabsTtsPvcVoice = async (
  baseURL: string,
  apiKey: string,
  options: { voiceName?: string | undefined, language?: string | undefined, description?: string | undefined }
): Promise<{ voiceId: string, voiceName: string, language: string }> => {
  const voiceName = options.voiceName?.trim() || defaultElevenLabsTtsPvcVoiceName()
  const language = options.language?.trim() || 'en'
  const body = {
    name: voiceName,
    language,
    ...(options.description?.trim() ? { description: options.description.trim() } : {})
  }

  const data = await withRetry(
    { retryClass: 'runtime_http_create_conservative', operationName: 'elevenlabs-pvc-create' },
    async () => {
      const response = await fetch(`${baseURL}/voices/pvc`, {
        method: 'POST',
        headers: {
          'xi-api-key': apiKey,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
      })

      if (!response.ok) {
        const errText = await readElevenLabsError(response)
        const err = new Error(`ElevenLabs PVC voice creation failed (${response.status}): ${errText}`) as Error & { status: number }
        err.status = response.status
        throw err
      }

      return await parseElevenLabsJsonResponse(response, ElevenLabsPvcCreateResponseSchema, 'ElevenLabs PVC voice creation response')
    },
    (error) => classifyFetchRetry(error, 'runtime_http_create_conservative')
  )

  return { voiceId: data.voice_id, voiceName, language }
}

export const uploadElevenLabsTtsPvcSamples = async (
  baseURL: string,
  apiKey: string,
  voiceId: string,
  samples: ElevenLabsTtsPvcAudio[]
): Promise<ElevenLabsTtsPvcUploadedSample[]> => {
  const data = await withRetry(
    { retryClass: 'runtime_http_create_conservative', operationName: 'elevenlabs-pvc-upload-samples' },
    async () => {
      const form = new FormData()
      for (const sample of samples) {
        form.append('files', Bun.file(sample.path, { type: sample.mimeType }), sample.basename)
      }
      form.append('remove_background_noise', 'false')

      const response = await fetch(`${baseURL}/voices/pvc/${encodeURIComponent(voiceId)}/samples`, {
        method: 'POST',
        headers: {
          'xi-api-key': apiKey
        },
        body: form
      })

      if (!response.ok) {
        const errText = await readElevenLabsError(response)
        const err = new Error(`ElevenLabs PVC sample upload failed (${response.status}): ${errText}`) as Error & { status: number }
        err.status = response.status
        throw err
      }

      return await parseElevenLabsJsonResponse(response, ElevenLabsPvcSampleResponseSchema, 'ElevenLabs PVC sample upload response')
    },
    (error) => classifyFetchRetry(error, 'runtime_http_create_conservative')
  )

  return data.map((sample) => ({
    ...(sample.sample_id ? { sampleId: sample.sample_id } : {}),
    ...(sample.file_name ? { fileName: sample.file_name } : {}),
    ...(sample.mime_type ? { mimeType: sample.mime_type } : {}),
    ...(typeof sample.size_bytes === 'number' ? { sizeBytes: sample.size_bytes } : {}),
    ...(typeof sample.duration_secs === 'number' ? { durationSeconds: sample.duration_secs } : {})
  }))
}

const decodeCaptchaBytes = async (response: Response): Promise<Uint8Array> => {
  const contentType = response.headers.get('content-type') ?? ''
  const raw = new Uint8Array(await response.arrayBuffer())
  if (contentType.startsWith('image/')) {
    return raw
  }

  const text = new TextDecoder().decode(raw).trim()
  const extractBase64 = (value: unknown): string | undefined => {
    if (typeof value === 'string' && value.trim().length > 0) {
      return value.trim()
    }
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      const record = value as Record<string, unknown>
      for (const key of ['captcha', 'image', 'image_base64', 'image_base_64', 'captcha_base64', 'captcha_image']) {
        const candidate = extractBase64(record[key])
        if (candidate) return candidate
      }
    }
    return undefined
  }

  let base64 = text
  try {
    const parsed = JSON.parse(text) as unknown
    base64 = extractBase64(parsed) ?? ''
  } catch {
    base64 = extractBase64(text) ?? ''
  }
  base64 = base64.replace(/^data:image\/[a-z0-9.+-]+;base64,/i, '')
  if (!base64) {
    throw new Error('ElevenLabs PVC captcha response did not include a captcha image.')
  }

  return new Uint8Array(Buffer.from(base64, 'base64'))
}

export const writeElevenLabsTtsPvcCaptcha = async (
  baseURL: string,
  apiKey: string,
  voiceId: string,
  outputPath: string
): Promise<string> => {
  const captchaBytes = await withRetry(
    { retryClass: 'runtime_http_create_conservative', operationName: 'elevenlabs-pvc-get-captcha' },
    async () => {
      const response = await fetch(`${baseURL}/voices/pvc/${encodeURIComponent(voiceId)}/captcha`, {
        method: 'GET',
        headers: {
          'xi-api-key': apiKey
        }
      })

      if (!response.ok) {
        const errText = await readElevenLabsError(response)
        const err = new Error(`ElevenLabs PVC captcha request failed (${response.status}): ${errText}`) as Error & { status: number }
        err.status = response.status
        throw err
      }

      return await decodeCaptchaBytes(response)
    },
    (error) => classifyFetchRetry(error, 'runtime_http_create_conservative')
  )

  await mkdir(dirname(outputPath), { recursive: true })
  await Bun.write(outputPath, captchaBytes)
  return outputPath
}

export const verifyElevenLabsTtsPvcCaptcha = async (
  baseURL: string,
  apiKey: string,
  voiceId: string,
  verifyAudioPath: string
): Promise<string> => {
  const recording = await validateElevenLabsTtsPvcAudio(verifyAudioPath, 'verification audio')
  const data = await withRetry(
    { retryClass: 'runtime_http_create_conservative', operationName: 'elevenlabs-pvc-verify-captcha' },
    async () => {
      const form = new FormData()
      form.append('recording', Bun.file(recording.path, { type: recording.mimeType }), recording.basename)

      const response = await fetch(`${baseURL}/voices/pvc/${encodeURIComponent(voiceId)}/captcha`, {
        method: 'POST',
        headers: {
          'xi-api-key': apiKey
        },
        body: form
      })

      if (!response.ok) {
        const errText = await readElevenLabsError(response)
        const err = new Error(`ElevenLabs PVC captcha verification failed (${response.status}): ${errText}`) as Error & { status: number }
        err.status = response.status
        throw err
      }

      return await parseElevenLabsJsonResponse(response, ElevenLabsPvcStatusResponseSchema, 'ElevenLabs PVC captcha verification response')
    },
    (error) => classifyFetchRetry(error, 'runtime_http_create_conservative')
  )

  return data.status
}

export const trainElevenLabsTtsPvcVoice = async (
  baseURL: string,
  apiKey: string,
  voiceId: string,
  model: string
): Promise<string> => {
  const data = await withRetry(
    { retryClass: 'runtime_http_create_conservative', operationName: 'elevenlabs-pvc-train' },
    async () => {
      const response = await fetch(`${baseURL}/voices/pvc/${encodeURIComponent(voiceId)}/train`, {
        method: 'POST',
        headers: {
          'xi-api-key': apiKey,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ model_id: model })
      })

      if (!response.ok) {
        const errText = await readElevenLabsError(response)
        const err = new Error(`ElevenLabs PVC training start failed (${response.status}): ${errText}`) as Error & { status: number }
        err.status = response.status
        throw err
      }

      return await parseElevenLabsJsonResponse(response, ElevenLabsPvcStatusResponseSchema, 'ElevenLabs PVC training response')
    },
    (error) => classifyFetchRetry(error, 'runtime_http_create_conservative')
  )

  return data.status
}

export const getElevenLabsTtsPvcFineTuningState = async (
  baseURL: string,
  apiKey: string,
  voiceId: string,
  model: string
): Promise<{ state?: string | undefined, progress?: number | undefined }> => {
  const data = await withRetry(
    { retryClass: 'runtime_http_create_conservative', operationName: 'elevenlabs-pvc-get-voice' },
    async () => {
      const response = await fetch(`${baseURL}/voices/${encodeURIComponent(voiceId)}`, {
        method: 'GET',
        headers: {
          'xi-api-key': apiKey
        }
      })

      if (!response.ok) {
        const errText = await readElevenLabsError(response)
        const err = new Error(`ElevenLabs PVC voice status failed (${response.status}): ${errText}`) as Error & { status: number }
        err.status = response.status
        throw err
      }

      return await parseElevenLabsJsonResponse(response, ElevenLabsPvcVoiceResponseSchema, 'ElevenLabs PVC voice status response')
    },
    (error) => classifyFetchRetry(error, 'runtime_http_create_conservative')
  )

  const state = data.fine_tuning?.state?.[model]
  const progress = data.fine_tuning?.progress?.[model]
  return {
    ...(state ? { state } : {}),
    ...(typeof progress === 'number' ? { progress } : {})
  }
}

export const pollElevenLabsTtsPvcTraining = async (
  baseURL: string,
  apiKey: string,
  voiceId: string,
  model: string,
  options: { pollIntervalMs?: number | undefined, timeoutMs?: number | undefined } = {}
): Promise<ElevenLabsTtsPvcPollResult> => {
  const startedAt = Date.now()
  const timeoutMs = Math.max(1, options.timeoutMs ?? ELEVENLABS_PVC_DEFAULT_TIMEOUT_MS)
  const pollIntervalMs = Math.max(1, options.pollIntervalMs ?? ELEVENLABS_PVC_DEFAULT_POLL_INTERVAL_MS)

  while (Date.now() - startedAt <= timeoutMs) {
    const { state, progress } = await getElevenLabsTtsPvcFineTuningState(baseURL, apiKey, voiceId, model)
    const elapsedMs = Date.now() - startedAt
    if (state === 'fine_tuned') {
      return { voiceId, model, state, ...(typeof progress === 'number' ? { progress } : {}), elapsedMs }
    }
    if (state === 'failed') {
      throw new Error(`ElevenLabs PVC training failed for ${voiceId} on ${model}.`)
    }
    await Bun.sleep(Math.min(pollIntervalMs, Math.max(1, timeoutMs - elapsedMs)))
  }

  throw new Error(`Timed out waiting for ElevenLabs PVC training for ${voiceId} on ${model}.`)
}

export const runElevenLabsTtsPvcSetup = async (
  baseURL: string,
  apiKey: string,
  options: ElevenLabsTtsPvcSetupOptions
): Promise<ElevenLabsTtsPvcSetupResult> => {
  const materializedSamplePaths: MaterializedMediaInput[] = []
  let materializedVerifyAudio: MaterializedMediaInput | undefined

  try {
  for (const samplePath of options.samplePaths ?? []) {
    materializedSamplePaths.push(await materializeMediaInput(samplePath, {
      accept: 'audio/*,application/octet-stream;q=0.9,*/*;q=0.8',
      label: 'ElevenLabs PVC sample audio'
    }))
  }
  if (options.verifyAudioPath?.trim()) {
    materializedVerifyAudio = await materializeMediaInput(options.verifyAudioPath, {
      accept: 'audio/*,application/octet-stream;q=0.9,*/*;q=0.8',
      label: 'ElevenLabs PVC verification audio'
    })
  }

  const actions: string[] = []
  const language = options.language?.trim() || 'en'
  const description = options.description?.trim() || undefined
  const hasSamples = (options.samplePaths?.length ?? 0) > 0 || Boolean(options.sampleDir?.trim())
  const samplePaths = materializedSamplePaths.length > 0
    ? materializedSamplePaths.map((item) => item.path)
    : options.samplePaths
  const sampleAudioForUpload = hasSamples
    ? await validateElevenLabsTtsPvcSamples(samplePaths, options.sampleDir)
    : []
  const sampleInputByMaterializedPath = new Map(
    materializedSamplePaths
      .filter((item) => item.isRemote)
      .map((item) => [item.path, item.input])
  )
  const sampleAudio = sampleAudioForUpload.map((sample) => {
    const sourceInput = sampleInputByMaterializedPath.get(sample.path)
    return sourceInput ? { ...sample, path: sourceInput, basename: basename(sourceInput) } : sample
  })
  const totalSampleDurationSeconds = sampleAudioForUpload.every((sample) => typeof sample.durationSeconds === 'number')
    ? sampleAudioForUpload.reduce((sum, sample) => sum + (sample.durationSeconds ?? 0), 0)
    : undefined

  let voiceId = options.pvcVoiceId?.trim()
  let voiceName = options.voiceName?.trim() || undefined
  let createdVoice = false
  if (sampleAudioForUpload.length > 0 && !voiceId) {
    const created = await createElevenLabsTtsPvcVoice(baseURL, apiKey, {
      voiceName,
      language,
      ...(description ? { description } : {})
    })
    voiceId = created.voiceId
    voiceName = created.voiceName
    createdVoice = true
    actions.push('create_voice')
  }

  if (!voiceId) {
    throw new Error('ElevenLabs PVC setup requires --elevenlabs-tts-pvc-voice for existing voice actions, or PVC samples to create a new voice.')
  }

  let uploadedSamples: ElevenLabsTtsPvcUploadedSample[] = []
  if (sampleAudioForUpload.length > 0) {
    uploadedSamples = await uploadElevenLabsTtsPvcSamples(baseURL, apiKey, voiceId, sampleAudioForUpload)
    actions.push('upload_samples')
  }

  const captchaPath = options.captchaOut?.trim()
    ? await writeElevenLabsTtsPvcCaptcha(baseURL, apiKey, voiceId, options.captchaOut.trim())
    : undefined
  if (captchaPath) {
    actions.push('write_captcha')
  }

  const verificationStatus = materializedVerifyAudio
    ? await verifyElevenLabsTtsPvcCaptcha(baseURL, apiKey, voiceId, materializedVerifyAudio.path)
    : undefined
  if (verificationStatus) {
    actions.push('verify_captcha')
  }

  const trainingStatus = verificationStatus
    ? await trainElevenLabsTtsPvcVoice(baseURL, apiKey, voiceId, options.model)
    : undefined
  if (trainingStatus) {
    actions.push('start_training')
  }

  const pollResult = options.wait === true
    ? await pollElevenLabsTtsPvcTraining(baseURL, apiKey, voiceId, options.model, {
        pollIntervalMs: options.pollIntervalMs,
        timeoutMs: options.timeoutMs
      })
    : undefined
  if (pollResult) {
    actions.push('wait_for_training')
  }

  return {
    voiceId,
    model: options.model,
    ...(voiceName ? { voiceName } : {}),
    language,
    ...(description ? { description } : {}),
    createdVoice,
    sampleAudio,
    ...(typeof totalSampleDurationSeconds === 'number' ? { totalSampleDurationSeconds } : {}),
    uploadedSamples,
    ...(captchaPath ? { captchaPath } : {}),
    ...(verificationStatus ? { verificationStatus } : {}),
    ...(trainingStatus ? { trainingStatus } : {}),
    ...(pollResult?.state ? { fineTuningState: pollResult.state } : {}),
    ...(typeof pollResult?.progress === 'number' ? { fineTuningProgress: pollResult.progress } : {}),
    readyForSynthesis: pollResult?.state === 'fine_tuned',
    actions
  }
  } finally {
    await Promise.all([
      ...materializedSamplePaths.map((item) => item.cleanup()),
      materializedVerifyAudio?.cleanup() ?? Promise.resolve()
    ])
  }
}

export const writeElevenLabsTtsPvcStatusArtifact = async (
  outputDir: string,
  result: ElevenLabsTtsPvcSetupResult
): Promise<ElevenLabsTtsPvcStatusArtifact> => {
  const statusFileName = 'elevenlabs-pvc-status.json'
  const artifact: ElevenLabsTtsPvcStatusArtifact = {
    ...result,
    status: result.readyForSynthesis ? 'ready' : 'setup_complete',
    createdAt: new Date().toISOString(),
    statusFileName
  }
  await Bun.write(join(outputDir, statusFileName), `${JSON.stringify(artifact, null, 2)}\n`)
  return artifact
}
