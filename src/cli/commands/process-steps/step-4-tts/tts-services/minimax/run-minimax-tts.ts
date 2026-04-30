import { stat } from 'node:fs/promises'
import { basename, extname, resolve } from 'node:path'
import * as v from 'valibot'
import type { MinimaxTtsModel, Step4Metadata } from '~/types'
import * as l from '~/utils/logger'
import { logTtsConfig } from '~/cli/commands/process-steps/step-4-tts/tts-utils/log-tts-config'
import { splitTextIntoChunks } from '~/cli/commands/process-steps/step-4-tts/tts-utils/audio-utils'
import { finalizeTtsRun } from '~/cli/commands/process-steps/step-4-tts/tts-utils/finalize-tts-run'
import { exec } from '~/utils/cli-utils'
import { readEnv } from '~/utils/validate/env-utils'
import { validateData } from '~/utils/validate/validation'
import { pollUntil } from '~/utils/retries'
import { getAudioDuration } from '~/cli/commands/process-steps/step-2-extract/step-2-stt/stt-utils/audio-splitter'
import {
  MinimaxBaseRespSchema,
  ensureMinimaxBaseRespSuccess,
  parseMinimaxJsonResponse,
  isMinimaxTaskSuccess,
  isMinimaxTaskFailure
} from '~/cli/commands/process-steps/step-4-tts/tts-services/minimax/minimax-utils'

const MINIMAX_DEFAULT_BASE_URL = 'https://api.minimax.io'
const MINIMAX_DEFAULT_VOICE_ID = 'English_expressive_narrator'
const MAX_CHARS_PER_CHUNK = 50_000
const POLL_INTERVAL_MS = 3_000
const POLL_TIMEOUT_MS = 10 * 60_000
export const MINIMAX_TTS_CLONE_COST_CENTS = 150
export const MINIMAX_TTS_CLONE_SETUP_MS = 15_000

const MAX_MINIMAX_TTS_CLONE_AUDIO_BYTES = 20 * 1024 * 1024
const MIN_MINIMAX_TTS_SOURCE_AUDIO_SECONDS = 10
const MAX_MINIMAX_TTS_SOURCE_AUDIO_SECONDS = 5 * 60
const MAX_MINIMAX_TTS_PROMPT_AUDIO_SECONDS = 8
const MINIMAX_TTS_CLONE_AUDIO_EXTENSIONS = new Set(['.mp3', '.m4a', '.wav'])

export type MinimaxTtsCloneAudioKind = 'source' | 'prompt'

export type MinimaxTtsCloneAudio = {
  path: string
  basename: string
  durationSeconds: number
  sizeBytes: number
}

export type MinimaxTtsCloneResult = {
  voiceId: string
  sourceAudio: MinimaxTtsCloneAudio
  promptAudio?: MinimaxTtsCloneAudio | undefined
}

export type MinimaxTtsCloneContext = {
  clonePromise?: Promise<MinimaxTtsCloneResult> | undefined
  cloneCostReported: boolean
}

export type MinimaxTtsCloneOptions = {
  refAudioPath: string
  voiceId?: string | undefined
  promptAudioPath?: string | undefined
  promptText?: string | undefined
  needNoiseReduction?: boolean | undefined
  needVolumeNormalization?: boolean | undefined
  context?: MinimaxTtsCloneContext | undefined
}

export const createMinimaxTtsCloneContext = (): MinimaxTtsCloneContext => ({
  cloneCostReported: false
})

const MinimaxCreateResponseSchema = v.object({
  task_id: v.union([v.string(), v.number()]),
  file_id: v.optional(v.union([v.string(), v.number()]), undefined),
  base_resp: v.optional(MinimaxBaseRespSchema, undefined)
})

const MinimaxQueryDataSchema = v.object({
  status: v.optional(v.union([v.string(), v.number()]), undefined),
  file_id: v.optional(v.union([v.string(), v.number()]), undefined)
})

const MinimaxQueryResponseSchema = v.object({
  status: v.optional(v.union([v.string(), v.number()]), undefined),
  file_id: v.optional(v.union([v.string(), v.number()]), undefined),
  error_message: v.optional(v.string(), undefined),
  data: v.optional(MinimaxQueryDataSchema, undefined),
  base_resp: v.optional(MinimaxBaseRespSchema, undefined)
})

const MinimaxUploadResponseSchema = v.object({
  file: v.object({
    file_id: v.union([v.string(), v.number()])
  }),
  base_resp: v.optional(MinimaxBaseRespSchema, undefined)
})

const MinimaxVoiceCloneResponseSchema = v.object({
  demo_audio: v.optional(v.string(), undefined),
  base_resp: v.optional(MinimaxBaseRespSchema, undefined)
})

const generateMinimaxCloneVoiceId = (): string => {
  const suffix = `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 12)}`
  return `AutoShow_${suffix}`
}

export const validateMinimaxTtsCloneVoiceId = (voiceId: string): string => {
  const normalized = voiceId.trim()
  if (normalized.length < 8 || normalized.length > 256) {
    throw new Error('MiniMax TTS clone voice_id must be 8-256 characters long.')
  }
  if (!/^[A-Za-z]/.test(normalized)) {
    throw new Error('MiniMax TTS clone voice_id must start with an English letter.')
  }
  if (!/^[A-Za-z0-9_-]+$/.test(normalized)) {
    throw new Error('MiniMax TTS clone voice_id can contain only letters, digits, "-", and "_".')
  }
  if (/[-_]$/.test(normalized)) {
    throw new Error('MiniMax TTS clone voice_id cannot end with "-" or "_".')
  }
  return normalized
}

const resolveMinimaxCloneVoiceId = (voiceId: string | undefined): string =>
  validateMinimaxTtsCloneVoiceId(voiceId?.trim() || generateMinimaxCloneVoiceId())

export const validateMinimaxTtsCloneAudio = async (
  audioPath: string,
  kind: MinimaxTtsCloneAudioKind
): Promise<MinimaxTtsCloneAudio> => {
  const normalizedPath = audioPath.trim()
  const label = kind === 'source' ? 'source audio' : 'prompt audio'
  if (normalizedPath.length === 0) {
    throw new Error(`MiniMax TTS clone ${label} path is empty.`)
  }

  const ext = extname(normalizedPath).toLowerCase()
  if (!MINIMAX_TTS_CLONE_AUDIO_EXTENSIONS.has(ext)) {
    throw new Error(`MiniMax TTS clone ${label} must be an mp3, m4a, or wav file.`)
  }

  let fileStats: Awaited<ReturnType<typeof stat>>
  try {
    fileStats = await stat(normalizedPath)
  } catch {
    throw new Error(`MiniMax TTS clone ${label} not found: ${normalizedPath}`)
  }

  if (!fileStats.isFile()) {
    throw new Error(`MiniMax TTS clone ${label} is not a file: ${normalizedPath}`)
  }
  if (fileStats.size <= 0) {
    throw new Error(`MiniMax TTS clone ${label} is empty: ${normalizedPath}`)
  }
  if (fileStats.size > MAX_MINIMAX_TTS_CLONE_AUDIO_BYTES) {
    throw new Error(`MiniMax TTS clone ${label} exceeds 20 MB: ${normalizedPath}`)
  }

  let durationSeconds: number
  try {
    durationSeconds = await getAudioDuration(normalizedPath)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    throw new Error(`Could not determine MiniMax TTS clone ${label} duration: ${message}`)
  }

  if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) {
    throw new Error(`Could not determine MiniMax TTS clone ${label} duration: ${normalizedPath}`)
  }

  if (
    kind === 'source'
    && (
      durationSeconds < MIN_MINIMAX_TTS_SOURCE_AUDIO_SECONDS
      || durationSeconds > MAX_MINIMAX_TTS_SOURCE_AUDIO_SECONDS
    )
  ) {
    throw new Error(`MiniMax TTS clone source audio must be 10 seconds to 5 minutes long. Received ${durationSeconds.toFixed(2)} seconds.`)
  }
  if (kind === 'prompt' && durationSeconds >= MAX_MINIMAX_TTS_PROMPT_AUDIO_SECONDS) {
    throw new Error(`MiniMax TTS clone prompt audio must be less than 8 seconds long. Received ${durationSeconds.toFixed(2)} seconds.`)
  }

  return {
    path: normalizedPath,
    basename: basename(normalizedPath),
    durationSeconds,
    sizeBytes: fileStats.size
  }
}

const uploadMinimaxCloneAudio = async (
  baseURL: string,
  apiKey: string,
  audio: MinimaxTtsCloneAudio,
  purpose: 'voice_clone' | 'prompt_audio'
): Promise<string | number> => {
  const form = new FormData()
  form.append('purpose', purpose)
  form.append('file', Bun.file(audio.path), audio.basename)

  const response = await fetch(`${baseURL}/v1/files/upload`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`
    },
    body: form
  })

  if (!response.ok) {
    const body = await response.text()
    throw new Error(`MiniMax TTS clone audio upload failed (${response.status}): ${body || 'No response body'}`)
  }

  const data = validateData(
    MinimaxUploadResponseSchema,
    await parseMinimaxJsonResponse(response, 'MiniMax TTS clone audio upload response'),
    'MiniMax TTS clone audio upload response'
  )
  ensureMinimaxBaseRespSuccess(data.base_resp, 'MiniMax TTS clone audio upload')
  return data.file.file_id
}

const cloneMinimaxVoice = async (
  baseURL: string,
  apiKey: string,
  options: MinimaxTtsCloneOptions
): Promise<MinimaxTtsCloneResult> => {
  const promptAudioPath = options.promptAudioPath?.trim() || undefined
  const promptText = options.promptText?.trim() || undefined
  if (promptAudioPath && !promptText) {
    throw new Error('MiniMax TTS --minimax-tts-prompt-audio requires --minimax-tts-prompt-text.')
  }
  if (promptText && !promptAudioPath) {
    throw new Error('MiniMax TTS --minimax-tts-prompt-text requires --minimax-tts-prompt-audio.')
  }

  const voiceId = resolveMinimaxCloneVoiceId(options.voiceId)
  const sourceAudio = await validateMinimaxTtsCloneAudio(options.refAudioPath, 'source')
  const sourceFileId = await uploadMinimaxCloneAudio(baseURL, apiKey, sourceAudio, 'voice_clone')

  const promptAudio = promptAudioPath
    ? await validateMinimaxTtsCloneAudio(promptAudioPath, 'prompt')
    : undefined
  const promptFileId = promptAudio
    ? await uploadMinimaxCloneAudio(baseURL, apiKey, promptAudio, 'prompt_audio')
    : undefined

  const requestBody = {
    file_id: sourceFileId,
    voice_id: voiceId,
    ...(promptAudio && promptFileId !== undefined && promptText
      ? {
          clone_prompt: {
            prompt_audio: promptFileId,
            prompt_text: promptText
          }
        }
      : {}),
    need_noise_reduction: options.needNoiseReduction === true,
    need_volume_normalization: options.needVolumeNormalization === true
  }

  const response = await fetch(`${baseURL}/v1/voice_clone`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(requestBody)
  })

  if (!response.ok) {
    const body = await response.text()
    throw new Error(`MiniMax TTS voice clone failed (${response.status}): ${body || 'No response body'}`)
  }

  const data = validateData(
    MinimaxVoiceCloneResponseSchema,
    await parseMinimaxJsonResponse(response, 'MiniMax TTS voice clone response'),
    'MiniMax TTS voice clone response'
  )
  ensureMinimaxBaseRespSuccess(data.base_resp, 'MiniMax TTS voice clone')

  return {
    voiceId,
    sourceAudio,
    ...(promptAudio ? { promptAudio } : {})
  }
}

export const ensureMinimaxTtsClone = async (
  baseURL: string,
  apiKey: string,
  options: MinimaxTtsCloneOptions
): Promise<MinimaxTtsCloneResult> => {
  const context = options.context
  if (context?.clonePromise) {
    return await context.clonePromise
  }

  let clonePromise: Promise<MinimaxTtsCloneResult>
  clonePromise = cloneMinimaxVoice(baseURL, apiKey, options).catch((error) => {
    if (context?.clonePromise === clonePromise) {
      context.clonePromise = undefined
    }
    throw error
  })
  if (context) {
    context.clonePromise = clonePromise
  }
  return await clonePromise
}

const readTaskStatus = (query: v.InferOutput<typeof MinimaxQueryResponseSchema>): string | number | undefined => {
  return query.data?.status ?? query.status
}

const extractFileId = (
  createResp: v.InferOutput<typeof MinimaxCreateResponseSchema>,
  queryResp: v.InferOutput<typeof MinimaxQueryResponseSchema>
): string | undefined => {
  const rawFileId = queryResp.data?.file_id ?? queryResp.file_id ?? createResp.file_id
  return rawFileId === undefined ? undefined : String(rawFileId)
}

const downloadChunkAudio = async (
  baseURL: string,
  apiKey: string,
  fileId: string,
  chunkPath: string
): Promise<void> => {
  const response = await fetch(`${baseURL}/v1/files/retrieve_content?file_id=${encodeURIComponent(fileId)}`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    }
  })

  if (!response.ok) {
    const body = await response.text()
    throw new Error(`MiniMax TTS download failed (${response.status}): ${body || 'No response body'}`)
  }

  const bytes = new Uint8Array(await response.arrayBuffer())
  if (bytes.byteLength === 0) {
    throw new Error('MiniMax TTS download returned empty audio')
  }

  await Bun.write(chunkPath, bytes)
}

const concatAndConvertToWav = async (chunkPaths: string[], outputDir: string): Promise<string> => {
  const wavPath = `${outputDir}/speech.wav`

  if (chunkPaths.length === 1) {
    const ffmpeg = await exec('ffmpeg', [
      '-i', chunkPaths[0] as string,
      '-ar', '16000',
      '-ac', '1',
      '-c:a', 'pcm_s16le',
      '-y',
      wavPath
    ])
    if (ffmpeg.exitCode !== 0) {
      throw new Error(`Failed to convert MiniMax audio to WAV: ${ffmpeg.stderr.trim()}`)
    }
    return wavPath
  }

  const concatListPath = `${outputDir}/speech-minimax-chunks.txt`
  const mergedPath = `${outputDir}/speech-minimax-merged.mp3`
  const concatList = chunkPaths
    .map(path => `file '${resolve(path).replace(/'/g, `'\\''`)}'`)
    .join('\n')
  await Bun.write(concatListPath, `${concatList}\n`)

  const concat = await exec('ffmpeg', [
    '-f', 'concat',
    '-safe', '0',
    '-i', concatListPath,
    '-c', 'copy',
    '-y',
    mergedPath
  ])

  if (concat.exitCode !== 0) {
    throw new Error(`Failed to concatenate MiniMax audio chunks: ${concat.stderr.trim()}`)
  }

  const convert = await exec('ffmpeg', [
    '-i', mergedPath,
    '-ar', '16000',
    '-ac', '1',
    '-c:a', 'pcm_s16le',
    '-y',
    wavPath
  ])

  if (convert.exitCode !== 0) {
    throw new Error(`Failed to convert concatenated MiniMax audio to WAV: ${convert.stderr.trim()}`)
  }

  return wavPath
}

export const runMinimaxTts = async (
  text: string,
  outputDir: string,
  options: { model: MinimaxTtsModel, voiceId?: string | undefined, clone?: MinimaxTtsCloneOptions | undefined }
): Promise<{ audioPath: string, metadata: Step4Metadata }> => {
  const apiKey = readEnv('MINIMAX_API_KEY')
  if (!apiKey) {
    throw new Error('MINIMAX_API_KEY environment variable is required for MiniMax TTS')
  }

  const baseURL = readEnv('MINIMAX_BASE_URL') ?? MINIMAX_DEFAULT_BASE_URL
  const chunks = splitTextIntoChunks(text, MAX_CHARS_PER_CHUNK)
  if (chunks.length === 0) {
    throw new Error('MiniMax TTS input text is empty')
  }

  const startTime = Date.now()
  const cloneResult = options.clone
    ? await ensureMinimaxTtsClone(baseURL, apiKey, options.clone)
    : undefined
  const voiceId = cloneResult?.voiceId ?? options.voiceId?.trim() ?? MINIMAX_DEFAULT_VOICE_ID
  const speaker = cloneResult ? `ref_audio:${cloneResult.sourceAudio.basename}` : voiceId

  logTtsConfig('MiniMax', [
    { label: 'model', value: options.model },
    { label: cloneResult ? 'reference audio' : 'voice', value: cloneResult ? cloneResult.sourceAudio.basename : voiceId },
    ...(cloneResult ? [{ label: 'cloned voice_id', value: cloneResult.voiceId }] : []),
    { label: 'chunk count', value: chunks.length }
  ])

  const chunkPaths: string[] = []

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i] as string
    const chunkIndex = i + 1
    l.debug(`Submitting MiniMax TTS chunk ${chunkIndex}/${chunks.length}`)

    const createTaskResponse = await fetch(`${baseURL}/v1/t2a_async_v2`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: options.model,
        text: chunk,
        voice_setting: {
          voice_id: voiceId
        },
        audio_setting: {
          format: 'mp3',
          audio_sample_rate: 32000,
          channel: 1
        }
      })
    })

    if (!createTaskResponse.ok) {
      const body = await createTaskResponse.text()
      throw new Error(`MiniMax TTS task creation failed (${createTaskResponse.status}): ${body || 'No response body'}`)
    }

    const createTaskData = validateData(
      MinimaxCreateResponseSchema,
      await parseMinimaxJsonResponse(createTaskResponse, 'MiniMax TTS create task response'),
      'MiniMax TTS create task response'
    )
    ensureMinimaxBaseRespSuccess(createTaskData.base_resp, 'MiniMax TTS task creation')

    const taskId = String(createTaskData.task_id)

    const queryData = await pollUntil({
      operationName: `minimax-tts-chunk-${chunkIndex}`,
      intervalMs: POLL_INTERVAL_MS,
      deadlineMs: POLL_TIMEOUT_MS,
      pollFn: async () => {
        const queryResponse = await fetch(`${baseURL}/v1/query/t2a_async_query_v2?task_id=${encodeURIComponent(taskId)}`, {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
          }
        })

        if (!queryResponse.ok) {
          const body = await queryResponse.text()
          throw new Error(`MiniMax TTS task query failed (${queryResponse.status}): ${body || 'No response body'}`)
        }

        const data = validateData(
          MinimaxQueryResponseSchema,
          await parseMinimaxJsonResponse(queryResponse, 'MiniMax TTS query task response'),
          'MiniMax TTS query task response'
        )
        ensureMinimaxBaseRespSuccess(data.base_resp, 'MiniMax TTS task query')
        return data
      },
      isDone: (data) => isMinimaxTaskSuccess(readTaskStatus(data)),
      isFailed: (data) => {
        const status = readTaskStatus(data)
        if (isMinimaxTaskFailure(status)) {
          return { failed: true, reason: data.error_message ?? data.base_resp?.status_msg ?? 'Unknown error' }
        }
        return { failed: false }
      }
    })

    const fileId = extractFileId(createTaskData, queryData)
    if (!fileId) {
      throw new Error('MiniMax TTS task succeeded but no file_id was returned')
    }

    const chunkPath = `${outputDir}/speech-minimax-chunk-${chunkIndex}.mp3`
    await downloadChunkAudio(baseURL, apiKey, fileId, chunkPath)
    chunkPaths.push(chunkPath)
  }

  const audioPath = await concatAndConvertToWav(chunkPaths, outputDir)
  for (const chunkPath of chunkPaths) {
    await Bun.$`rm -f ${chunkPath}`.quiet().nothrow()
  }
  await Bun.$`rm -f ${outputDir}/speech-minimax-chunks.txt ${outputDir}/speech-minimax-merged.mp3`.quiet().nothrow()

  const cloneContext = options.clone?.context
  const shouldReportCloneCost = cloneResult !== undefined && (!cloneContext || !cloneContext.cloneCostReported)
  if (shouldReportCloneCost && cloneContext) {
    cloneContext.cloneCostReported = true
  }

  const result = finalizeTtsRun({
    service: 'minimax',
    model: options.model,
    speaker,
    audioPath,
    chunkCount: chunks.length,
    startTime
  })

  return {
    audioPath: result.audioPath,
    metadata: {
      ...result.metadata,
      ...(cloneResult ? { clonedVoiceId: cloneResult.voiceId } : {}),
      ...(shouldReportCloneCost ? { cloneCostCents: MINIMAX_TTS_CLONE_COST_CENTS } : {})
    }
  }
}
