import { resolve } from 'node:path'
import * as v from 'valibot'
import type { MinimaxTtsModel, Step4Metadata } from '~/types'
import * as l from '~/utils/logger'
import { logTtsConfig } from '~/cli/commands/process-steps/step-4-tts/tts-utils/log-tts-config'
import { runTtsChunks, splitTextIntoChunks } from '~/cli/commands/process-steps/step-4-tts/tts-utils/audio-utils'
import { TTS_CHUNK_CHARACTER_LIMITS } from '~/cli/commands/process-steps/step-4-tts/tts-utils/tts-chunking'
import { finalizeTtsRun } from '~/cli/commands/process-steps/step-4-tts/tts-utils/finalize-tts-run'
import { exec } from '~/utils/cli-utils'
import { readEnv } from '~/utils/validate/env-utils'
import { MINIMAX_DEFAULT_BASE_URL } from '~/utils/base-urls'
import { validateData } from '~/utils/validate/validation'
import { pollUntil } from '~/utils/retries'
import {
  MinimaxBaseRespSchema,
  ensureMinimaxBaseRespSuccess,
  parseMinimaxJsonResponse,
  isMinimaxTaskSuccess,
  isMinimaxTaskFailure
} from '~/cli/commands/process-steps/step-4-tts/tts-services/minimax/minimax-utils'
import { MEDIA_GENERATION_TIMEOUT_MS } from '~/utils/timeouts'
const MINIMAX_DEFAULT_VOICE_ID = 'English_expressive_narrator'
const POLL_INTERVAL_MS = 3_000
const POLL_TIMEOUT_MS = MEDIA_GENERATION_TIMEOUT_MS

type MinimaxTtsOptions = {
  model: MinimaxTtsModel
  voiceId?: string | undefined
  languageBoost?: string | undefined
  speed?: number | undefined
  volume?: number | undefined
  pitch?: number | undefined
  emotion?: string | undefined
  englishNormalization?: boolean | undefined
  pronunciations?: string[] | undefined
  chunkConcurrency?: number | undefined
}

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
  options: MinimaxTtsOptions
): Promise<{ audioPath: string, metadata: Step4Metadata }> => {
  const apiKey = readEnv('MINIMAX_API_KEY')
  if (!apiKey) {
    throw new Error('MINIMAX_API_KEY environment variable is required for MiniMax TTS')
  }

  const baseURL = MINIMAX_DEFAULT_BASE_URL
  const chunks = splitTextIntoChunks(text, TTS_CHUNK_CHARACTER_LIMITS.minimax)
  if (chunks.length === 0) {
    throw new Error('MiniMax TTS input text is empty')
  }

  const startTime = Date.now()
  const voiceId = options.voiceId?.trim() ?? MINIMAX_DEFAULT_VOICE_ID

  logTtsConfig('MiniMax', [
    { label: 'model', value: options.model },
    { label: 'voice', value: voiceId },
    ...(options.languageBoost ? [{ label: 'language boost', value: options.languageBoost }] : []),
    ...(typeof options.speed === 'number' ? [{ label: 'speed', value: options.speed }] : []),
    ...(typeof options.volume === 'number' ? [{ label: 'volume', value: options.volume }] : []),
    ...(typeof options.pitch === 'number' ? [{ label: 'pitch', value: options.pitch }] : []),
    ...(options.emotion ? [{ label: 'emotion', value: options.emotion }] : []),
    ...(options.englishNormalization === true ? [{ label: 'English normalization', value: 'enabled' }] : []),
    ...(options.pronunciations && options.pronunciations.length > 0 ? [{ label: 'pronunciation rules', value: options.pronunciations.length }] : []),
    { label: 'chunk count', value: chunks.length }
  ])

  const chunkPaths: string[] = []

  try {
    const orderedChunkPaths = await runTtsChunks(chunks, options.chunkConcurrency, async (chunk, index) => {
      const chunkIndex = index + 1
      l.debug(`Submitting MiniMax TTS chunk ${chunkIndex}/${chunks.length}`)
      const voiceSetting = {
        voice_id: voiceId,
        ...(typeof options.speed === 'number' ? { speed: options.speed } : {}),
        ...(typeof options.volume === 'number' ? { vol: options.volume } : {}),
        ...(typeof options.pitch === 'number' ? { pitch: options.pitch } : {}),
        ...(options.emotion ? { emotion: options.emotion } : {}),
        ...(options.englishNormalization === true ? { english_normalization: true } : {})
      }
      const pronunciationRules = options.pronunciations?.map(item => item.trim()).filter(Boolean)
      const requestBody = {
        model: options.model,
        text: chunk,
        voice_setting: voiceSetting,
        audio_setting: {
          format: 'mp3',
          audio_sample_rate: 32000,
          channel: 1
        },
        ...(options.languageBoost ? { language_boost: options.languageBoost } : {}),
        ...(pronunciationRules && pronunciationRules.length > 0 ? { pronunciation_dict: { tone: pronunciationRules } } : {})
      }

      const createTaskResponse = await fetch(`${baseURL}/v1/t2a_async_v2`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody)
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
      return chunkPath
    })

    const audioPath = await concatAndConvertToWav(orderedChunkPaths, outputDir)
    const result = finalizeTtsRun({
      service: 'minimax',
      model: options.model,
      speaker: voiceId,
      audioPath,
      chunkCount: chunks.length,
      startTime
    })

    return {
      audioPath: result.audioPath,
      metadata: result.metadata
    }
  } finally {
    for (const chunkPath of chunkPaths) {
      await Bun.$`rm -f ${chunkPath}`.quiet().nothrow()
    }
    await Bun.$`rm -f ${outputDir}/speech-minimax-chunks.txt ${outputDir}/speech-minimax-merged.mp3`.quiet().nothrow()
  }
}
