import * as v from 'valibot'
import * as l from '~/utils/logger'
import type { GrokVideoModel, Step6VideoMetadata } from '~/types'
import { logMediaGenerationStatus } from '~/cli/commands/process-steps/generation-command-utils'
import { estimateVideoCost, logVideoEstimate } from '~/cli/commands/process-steps/step-6-video/video-utils/video-pricing'
import {
  normalizeGrokVideoAspectRatio,
  normalizeGrokVideoDuration,
  normalizeGrokVideoResolution
} from '~/cli/commands/process-steps/step-6-video/video-utils/video-normalization'
import { pollUntil } from '~/utils/retries'
import { readEnv } from '~/utils/validate/env-utils'
import { validateData } from '~/utils/validate/validation'

const DEFAULT_XAI_BASE_URL = 'https://api.x.ai/v1'
const POLL_INTERVAL_MS = 10_000
const POLL_TIMEOUT_MS = 10 * 60_000

const GrokCreateVideoResponseSchema = v.object({
  request_id: v.string()
})

const GrokPollVideoResponseSchema = v.object({
  status: v.string(),
  error: v.optional(v.unknown(), undefined),
  video: v.optional(v.object({
    url: v.optional(v.string(), undefined)
  }), undefined)
})

const formatGrokError = (value: unknown): string => {
  if (value === undefined || value === null) return 'Unknown error'
  if (typeof value === 'string') return value
  try {
    return JSON.stringify(value)
  } catch {
    return String(value)
  }
}

export const runGrokVideoGen = async (
  prompt: string,
  outputDir: string,
  options: { model: GrokVideoModel, durationSeconds?: number | undefined, aspectRatio?: string | undefined, resolution?: string | undefined }
): Promise<{ videoPath: string, metadata: Step6VideoMetadata }> => {
  const apiKey = readEnv('XAI_API_KEY')
  if (!apiKey) {
    throw new Error('XAI_API_KEY environment variable is required for Grok video generation')
  }

  const baseURL = (readEnv('XAI_BASE_URL') ?? DEFAULT_XAI_BASE_URL).replace(/\/+$/, '')
  const duration = normalizeGrokVideoDuration(options.durationSeconds)
  const aspectRatio = normalizeGrokVideoAspectRatio(options.aspectRatio)
  const resolution = normalizeGrokVideoResolution(options.resolution)

  logMediaGenerationStatus(l, {
    mediaType: 'video',
    provider: 'grok',
    model: options.model,
    status: 'started'
  })

  const estimate = estimateVideoCost({
    grokVideoModel: options.model,
    videoDuration: options.durationSeconds,
    videoResolution: options.resolution
  })
  logVideoEstimate(estimate)

  const startTime = Date.now()
  const createResp = await fetch(`${baseURL}/videos/generations`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: options.model,
      prompt,
      duration,
      aspect_ratio: aspectRatio,
      resolution
    })
  })

  if (!createResp.ok) {
    const body = await createResp.text()
    throw new Error(`Grok video generation request failed (${createResp.status}): ${body || 'No response body'}`)
  }

  const createData = validateData(
    GrokCreateVideoResponseSchema,
    await createResp.json() as unknown,
    'Grok video generation create response'
  )

  const taskData = await pollUntil({
    operationName: 'grok-video-gen',
    intervalMs: POLL_INTERVAL_MS,
    deadlineMs: POLL_TIMEOUT_MS,
    pollFn: async () => {
      const pollResp = await fetch(`${baseURL}/videos/${encodeURIComponent(createData.request_id)}`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        }
      })

      if (!pollResp.ok) {
        const body = await pollResp.text()
        throw new Error(`Grok video generation query failed (${pollResp.status}): ${body || 'No response body'}`)
      }

      const data = validateData(
        GrokPollVideoResponseSchema,
        await pollResp.json() as unknown,
        'Grok video generation query response'
      )
      logMediaGenerationStatus(l, {
        mediaType: 'video',
        provider: 'grok',
        model: options.model,
        status: data.status
      })
      return data
    },
    isDone: (data) => data.status === 'done',
    isFailed: (data) => data.status === 'failed' || data.status === 'expired'
      ? { failed: true, reason: formatGrokError(data.error) }
      : { failed: false }
  })

  const videoUrl = taskData.video?.url
  if (!videoUrl) {
    throw new Error('Grok video generation succeeded but no video.url was returned')
  }

  const downloadResp = await fetch(videoUrl)
  if (!downloadResp.ok) {
    throw new Error(`Grok video download failed (${downloadResp.status})`)
  }

  const outputPath = `${outputDir}/generated-video.mp4`
  await Bun.write(outputPath, new Uint8Array(await downloadResp.arrayBuffer()))

  const processingTime = Date.now() - startTime
  const videoFile = Bun.file(outputPath)

  logMediaGenerationStatus(l, {
    mediaType: 'video',
    provider: 'grok',
    model: options.model,
    status: 'completed',
    processingTimeMs: processingTime,
    outputCount: 1
  })

  return {
    videoPath: outputPath,
    metadata: {
      videoGenService: 'grok',
      videoGenModel: options.model,
      processingTime,
      videoFileName: 'generated-video.mp4',
      videoFileSize: videoFile.size,
      videoDuration: duration
    }
  }
}
