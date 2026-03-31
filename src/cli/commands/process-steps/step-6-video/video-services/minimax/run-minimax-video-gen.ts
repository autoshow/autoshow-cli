import * as v from 'valibot'
import type { Step6VideoMetadata } from '~/types'
import type { MinimaxVideoModel } from '~/cli/commands/models/model-options'
import { estimateVideoCost, logVideoEstimate } from '~/cli/commands/process-steps/step-6-video/video-utils/video-pricing'
import { readEnv } from '~/utils/validate/env-utils'
import { validateData } from '~/utils/validate/validation'
import * as l from '~/logger'
import { normalizeMinimaxDurationForApi, normalizeMinimaxResolutionForApi } from '~/cli/commands/process-steps/step-6-video/video-utils/video-normalization'
import { pollUntil } from '~/utils/retries'
import {
  MinimaxBaseRespSchema,
  ensureMinimaxBaseRespSuccess,
  isMinimaxTaskSuccess,
  isMinimaxTaskFailure
} from '~/utils/minimax-utils'

const MINIMAX_DEFAULT_BASE_URL = 'https://api.minimax.io'
const POLL_INTERVAL_MS = 10_000
const POLL_TIMEOUT_MS = 10 * 60_000

const MinimaxCreateVideoResponseSchema = v.object({
  task_id: v.union([v.string(), v.number()]),
  base_resp: v.optional(MinimaxBaseRespSchema, undefined)
})

const MinimaxQueryVideoDataSchema = v.object({
  status: v.optional(v.union([v.string(), v.number()]), undefined),
  file_id: v.optional(v.union([v.string(), v.number()]), undefined),
  error_message: v.optional(v.string(), undefined)
})

const MinimaxQueryVideoResponseSchema = v.object({
  status: v.optional(v.union([v.string(), v.number()]), undefined),
  file_id: v.optional(v.union([v.string(), v.number()]), undefined),
  error_message: v.optional(v.string(), undefined),
  data: v.optional(MinimaxQueryVideoDataSchema, undefined),
  base_resp: v.optional(MinimaxBaseRespSchema, undefined)
})

const MinimaxRetrieveFileResponseSchema = v.object({
  file: v.object({
    download_url: v.string()
  }),
  base_resp: v.optional(MinimaxBaseRespSchema, undefined)
})

const readTaskStatus = (query: v.InferOutput<typeof MinimaxQueryVideoResponseSchema>): string | number | undefined => {
  return query.data?.status ?? query.status
}

export const runMinimaxVideoGen = async (
  prompt: string,
  outputDir: string,
  options: { model: MinimaxVideoModel, durationSeconds?: number | undefined, resolution?: string | undefined }
): Promise<{ videoPath: string, metadata: Step6VideoMetadata }> => {
  const apiKey = readEnv('MINIMAX_API_KEY')
  if (!apiKey) {
    throw new Error('MINIMAX_API_KEY environment variable is required')
  }

  const baseURL = readEnv('MINIMAX_BASE_URL') ?? MINIMAX_DEFAULT_BASE_URL
  const resolutionForApi = normalizeMinimaxResolutionForApi(options.model, options.resolution)
  const durationForApi = normalizeMinimaxDurationForApi(options.model, resolutionForApi, options.durationSeconds)

  l.info(`Running MiniMax video model: ${options.model}`)

  const estimate = estimateVideoCost({
    minimaxVideoModel: options.model,
    videoDuration: options.durationSeconds,
    videoResolution: options.resolution
  })
  logVideoEstimate(estimate)

  const startTime = Date.now()
  const createResp = await fetch(`${baseURL}/v1/video_generation`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: options.model,
      prompt,
      duration: durationForApi,
      resolution: resolutionForApi
    })
  })

  if (!createResp.ok) {
    const body = await createResp.text()
    throw new Error(`MiniMax video generation request failed (${createResp.status}): ${body || 'No response body'}`)
  }

  const createData = validateData(
    MinimaxCreateVideoResponseSchema,
    await createResp.json() as unknown,
    'MiniMax video generation create response'
  )
  ensureMinimaxBaseRespSuccess(createData.base_resp, 'MiniMax video generation create request')

  const taskId = String(createData.task_id)

  const queryData = await pollUntil({
    operationName: 'minimax-video-gen',
    intervalMs: POLL_INTERVAL_MS,
    deadlineMs: POLL_TIMEOUT_MS,
    pollFn: async () => {
      const queryResp = await fetch(`${baseURL}/v1/query/video_generation?task_id=${encodeURIComponent(taskId)}`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        }
      })

      if (!queryResp.ok) {
        const body = await queryResp.text()
        throw new Error(`MiniMax video generation query failed (${queryResp.status}): ${body || 'No response body'}`)
      }

      const data = validateData(
        MinimaxQueryVideoResponseSchema,
        await queryResp.json() as unknown,
        'MiniMax video generation query response'
      )
      ensureMinimaxBaseRespSuccess(data.base_resp, 'MiniMax video generation query')

      const status = readTaskStatus(data)
      l.info(`MiniMax video status: ${status ?? 'processing'}`)
      return data
    },
    isDone: (data) => isMinimaxTaskSuccess(readTaskStatus(data)),
    isFailed: (data) => {
      const status = readTaskStatus(data)
      if (isMinimaxTaskFailure(status)) {
        return { failed: true, reason: data.data?.error_message ?? data.error_message ?? data.base_resp?.status_msg ?? 'Unknown error' }
      }
      return { failed: false }
    }
  })

  const fileId = (() => {
    const raw = queryData.data?.file_id ?? queryData.file_id
    return raw === undefined ? undefined : String(raw)
  })()
  if (!fileId) {
    throw new Error('MiniMax video generation succeeded but no file_id was returned')
  }

  const retrieveResp = await fetch(`${baseURL}/v1/files/retrieve?file_id=${encodeURIComponent(fileId)}`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    }
  })

  if (!retrieveResp.ok) {
    const body = await retrieveResp.text()
    throw new Error(`MiniMax file retrieve failed (${retrieveResp.status}): ${body || 'No response body'}`)
  }

  const retrieveData = validateData(
    MinimaxRetrieveFileResponseSchema,
    await retrieveResp.json() as unknown,
    'MiniMax video file retrieve response'
  )
  ensureMinimaxBaseRespSuccess(retrieveData.base_resp, 'MiniMax video file retrieve')

  const downloadResp = await fetch(retrieveData.file.download_url)
  if (!downloadResp.ok) {
    throw new Error(`MiniMax video download failed (${downloadResp.status})`)
  }

  const outputPath = `${outputDir}/generated-video.mp4`
  const bytes = new Uint8Array(await downloadResp.arrayBuffer())
  await Bun.write(outputPath, bytes)

  const processingTime = Date.now() - startTime
  const videoFile = Bun.file(outputPath)

  l.success(`MiniMax video generation completed in ${(processingTime / 1000).toFixed(1)}s`)

  const metadata: Step6VideoMetadata = {
    videoGenService: 'minimax',
    videoGenModel: options.model,
    processingTime,
    videoFileName: 'generated-video.mp4',
    videoFileSize: videoFile.size,
    videoDuration: durationForApi
  }

  return { videoPath: outputPath, metadata }
}
