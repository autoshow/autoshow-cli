import * as v from 'valibot'
import * as l from '~/utils/logger'
import type { RunwayTtsModel, Step4Metadata } from '~/types'
import { splitTextIntoChunks, concatAndConvertToWav } from '~/cli/commands/process-steps/step-4-tts/tts-utils/audio-utils'
import { finalizeTtsRun } from '~/cli/commands/process-steps/step-4-tts/tts-utils/finalize-tts-run'
import { logTtsConfig } from '~/cli/commands/process-steps/step-4-tts/tts-utils/log-tts-config'
import { RUNWAY_DEFAULT_TTS_VOICE, validateRunwayTtsVoice } from '~/cli/commands/setup-and-utilities/models/model-options'
import { logMediaGenerationStatus } from '~/cli/commands/process-steps/generation-command-utils'
import { pollUntil } from '~/utils/retries'
import { readEnv } from '~/utils/validate/env-utils'
import { validateData } from '~/utils/validate/validation'
import { MEDIA_GENERATION_TIMEOUT_MS } from '~/utils/timeouts'

const RUNWAY_BASE_URL = 'https://api.dev.runwayml.com/v1'
const RUNWAY_API_VERSION = '2024-11-06'
const MAX_CHARS_PER_CHUNK = 1000
const POLL_INTERVAL_MS = 10_000
const POLL_TIMEOUT_MS = MEDIA_GENERATION_TIMEOUT_MS

const RunwayCreateTaskSchema = v.object({
  id: v.string()
})

const RunwayTaskSchema = v.object({
  id: v.optional(v.string(), undefined),
  status: v.string(),
  output: v.optional(v.array(v.string()), undefined),
  failure: v.optional(v.unknown(), undefined),
  failureCode: v.optional(v.unknown(), undefined)
})

const trimTrailingSlash = (value: string): string => value.replace(/\/+$/, '')

const contentTypeToExtension = (contentType: string | null): string => {
  const normalized = contentType?.split(';')[0]?.trim().toLowerCase()
  if (normalized === 'audio/wav' || normalized === 'audio/wave' || normalized === 'audio/x-wav') return 'wav'
  if (normalized === 'audio/mpeg' || normalized === 'audio/mp3') return 'mp3'
  if (normalized === 'audio/ogg') return 'ogg'
  if (normalized === 'audio/mp4' || normalized === 'audio/aac') return 'm4a'
  return 'mp3'
}

const formatRunwayError = (task: v.InferOutput<typeof RunwayTaskSchema>): string => {
  const detail = task.failure ?? task.failureCode
  if (typeof detail === 'string') return detail
  if (detail !== undefined && detail !== null) {
    try {
      return JSON.stringify(detail)
    } catch {
      return String(detail)
    }
  }
  return `Runway task status ${task.status}`
}

const createRunwayTtsTask = async (
  baseURL: string,
  apiKey: string,
  model: RunwayTtsModel,
  promptText: string,
  voiceId: string,
  chunkIndex: number
): Promise<string> => {
  const response = await fetch(`${baseURL}/text_to_speech`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'X-Runway-Version': RUNWAY_API_VERSION,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model,
      promptText,
      voice: {
        type: 'runway-preset',
        presetId: voiceId
      }
    })
  })

  if (!response.ok) {
    const body = await response.text()
    throw new Error(`Runway TTS request failed for chunk ${chunkIndex} (${response.status}): ${body || 'No response body'}`)
  }

  const createData = validateData(
    RunwayCreateTaskSchema,
    await response.json() as unknown,
    'Runway TTS create response'
  )
  return createData.id
}

const pollRunwayTtsTask = async (
  baseURL: string,
  apiKey: string,
  taskId: string,
  model: RunwayTtsModel,
  chunkIndex: number
): Promise<v.InferOutput<typeof RunwayTaskSchema>> =>
  await pollUntil({
    operationName: `runway-tts-chunk-${chunkIndex}`,
    intervalMs: POLL_INTERVAL_MS,
    deadlineMs: POLL_TIMEOUT_MS,
    pollFn: async () => {
      const response = await fetch(`${baseURL}/tasks/${encodeURIComponent(taskId)}`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'X-Runway-Version': RUNWAY_API_VERSION,
          'Content-Type': 'application/json'
        }
      })

      if (!response.ok) {
        const body = await response.text()
        throw new Error(`Runway TTS query failed for chunk ${chunkIndex} (${response.status}): ${body || 'No response body'}`)
      }

      const data = validateData(
        RunwayTaskSchema,
        await response.json() as unknown,
        'Runway TTS query response'
      )
      logMediaGenerationStatus(l, {
        mediaType: 'tts',
        provider: 'runway',
        model,
        status: data.status
      })
      return data
    },
    isDone: (data) => data.status.toUpperCase() === 'SUCCEEDED',
    isFailed: (data) => {
      const status = data.status.toUpperCase()
      if (status === 'FAILED' || status === 'CANCELLED' || status === 'CANCELED' || status === 'THROTTLED') {
        return { failed: true, reason: formatRunwayError(data) }
      }
      return { failed: false }
    }
  })

export const runRunwayTts = async (
  text: string,
  outputDir: string,
  options: { model: RunwayTtsModel, voiceId?: string | undefined }
): Promise<{ audioPath: string, metadata: Step4Metadata }> => {
  const apiKey = readEnv('RUNWAYML_API_SECRET')
  if (!apiKey) {
    throw new Error('RUNWAYML_API_SECRET environment variable is required for Runway TTS')
  }

  const baseURL = trimTrailingSlash(readEnv('RUNWAY_BASE_URL') ?? RUNWAY_BASE_URL)
  const rawVoice = options.voiceId?.trim() || readEnv('RUNWAY_TTS_VOICE') || RUNWAY_DEFAULT_TTS_VOICE
  const voice = validateRunwayTtsVoice(rawVoice)
  const chunks = splitTextIntoChunks(text, MAX_CHARS_PER_CHUNK)

  if (chunks.length === 0) {
    throw new Error('Runway TTS input text is empty')
  }

  logTtsConfig('Runway', [
    { label: 'model', value: options.model },
    { label: 'voice', value: voice },
    { label: 'chunk count', value: chunks.length }
  ])

  logMediaGenerationStatus(l, {
    mediaType: 'tts',
    provider: 'runway',
    model: options.model,
    status: 'started',
    outputCount: chunks.length,
    detail: `speaker: ${voice}`
  })

  const startTime = Date.now()
  const chunkPaths: string[] = []

  try {
    for (let i = 0; i < chunks.length; i++) {
      const chunkIndex = i + 1
      const taskId = await createRunwayTtsTask(
        baseURL,
        apiKey,
        options.model,
        chunks[i] as string,
        voice,
        chunkIndex
      )
      const task = await pollRunwayTtsTask(baseURL, apiKey, taskId, options.model, chunkIndex)
      const audioUrl = task.output?.[0]
      if (!audioUrl) {
        throw new Error(`Runway TTS chunk ${chunkIndex} succeeded but no output[0] URL was returned`)
      }

      const downloadResp = await fetch(audioUrl)
      if (!downloadResp.ok) {
        throw new Error(`Runway TTS audio download failed for chunk ${chunkIndex} (${downloadResp.status})`)
      }

      const ext = contentTypeToExtension(downloadResp.headers.get('content-type'))
      const chunkPath = `${outputDir}/speech-runway-chunk-${String(chunkIndex).padStart(3, '0')}.${ext}`
      const audioBytes = new Uint8Array(await downloadResp.arrayBuffer())
      if (audioBytes.byteLength === 0) {
        throw new Error(`Runway TTS returned empty audio for chunk ${chunkIndex}`)
      }
      await Bun.write(chunkPath, audioBytes)
      chunkPaths.push(chunkPath)
    }

    const audioPath = await concatAndConvertToWav(chunkPaths, outputDir, 'Runway')
    return finalizeTtsRun({
      service: 'runway',
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
