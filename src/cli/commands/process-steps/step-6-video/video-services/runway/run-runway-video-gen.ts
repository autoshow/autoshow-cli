import * as v from 'valibot'
import * as l from '~/utils/logger'
import type { RunwayVideoModel, Step6VideoMetadata } from '~/types'
import { CLIUsageError } from '~/utils/error-handler'
import { logMediaGenerationStatus } from '~/cli/commands/process-steps/generation-command-utils'
import { estimateVideoCost, logVideoEstimate } from '~/cli/commands/process-steps/step-6-video/video-utils/video-pricing'
import { normalizeRunwayDuration, normalizeRunwayRatio } from '~/cli/commands/process-steps/step-6-video/video-utils/video-normalization'
import { pollUntil } from '~/utils/retries'
import { readEnv } from '~/utils/validate/env-utils'
import { validateData } from '~/utils/validate/validation'
import { MEDIA_GENERATION_TIMEOUT_MS } from '~/utils/timeouts'

const RUNWAY_BASE_URL = 'https://api.dev.runwayml.com/v1'
const RUNWAY_API_VERSION = '2024-11-06'
const POLL_INTERVAL_MS = 10_000
const POLL_TIMEOUT_MS = MEDIA_GENERATION_TIMEOUT_MS

const RunwayCreateTaskResponseSchema = v.object({
  id: v.string()
})

const RunwayTaskStatusResponseSchema = v.object({
  id: v.optional(v.string(), undefined),
  status: v.string(),
  output: v.optional(v.array(v.string()), undefined),
  failure: v.optional(v.unknown(), undefined),
  failureCode: v.optional(v.unknown(), undefined),
  createdAt: v.optional(v.string(), undefined)
})

const formatRunwayError = (task: v.InferOutput<typeof RunwayTaskStatusResponseSchema>): string => {
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

const validateRunwayPromptText = (prompt: string): void => {
  if (prompt.trim().length === 0) {
    throw CLIUsageError('Runway video prompt cannot be empty.')
  }
  if (prompt.length > 1000) {
    throw CLIUsageError(`Runway video prompts must be 1000 UTF-16 code units or fewer. Received ${prompt.length}.`)
  }
}

export const runRunwayVideoGen = async (
  prompt: string,
  outputDir: string,
  options: { model: RunwayVideoModel, durationSeconds?: number | undefined, aspectRatio?: string | undefined }
): Promise<{ videoPath: string, metadata: Step6VideoMetadata }> => {
  validateRunwayPromptText(prompt)

  const apiKey = readEnv('RUNWAYML_API_SECRET')
  if (!apiKey) {
    throw new Error('RUNWAYML_API_SECRET environment variable is required for Runway video generation')
  }

  const duration = normalizeRunwayDuration(options.durationSeconds)
  const ratio = normalizeRunwayRatio(options.aspectRatio)

  logMediaGenerationStatus(l, {
    mediaType: 'video',
    provider: 'runway',
    model: options.model,
    status: 'started'
  })

  const estimate = estimateVideoCost({
    runwayVideoModel: options.model,
    videoDuration: options.durationSeconds
  })
  logVideoEstimate(estimate)

  const startTime = Date.now()
  const createResp = await fetch(`${RUNWAY_BASE_URL}/text_to_video`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'X-Runway-Version': RUNWAY_API_VERSION,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: options.model,
      promptText: prompt,
      ratio,
      duration
    })
  })

  if (!createResp.ok) {
    const body = await createResp.text()
    throw new Error(`Runway video generation request failed (${createResp.status}): ${body || 'No response body'}`)
  }

  const createData = validateData(
    RunwayCreateTaskResponseSchema,
    await createResp.json() as unknown,
    'Runway video generation create response'
  )

  const taskData = await pollUntil({
    operationName: 'runway-video-gen',
    intervalMs: POLL_INTERVAL_MS,
    deadlineMs: POLL_TIMEOUT_MS,
    pollFn: async () => {
      const pollResp = await fetch(`${RUNWAY_BASE_URL}/tasks/${encodeURIComponent(createData.id)}`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'X-Runway-Version': RUNWAY_API_VERSION,
          'Content-Type': 'application/json'
        }
      })

      if (!pollResp.ok) {
        const body = await pollResp.text()
        throw new Error(`Runway video generation query failed (${pollResp.status}): ${body || 'No response body'}`)
      }

      const data = validateData(
        RunwayTaskStatusResponseSchema,
        await pollResp.json() as unknown,
        'Runway video generation query response'
      )
      logMediaGenerationStatus(l, {
        mediaType: 'video',
        provider: 'runway',
        model: options.model,
        status: data.status
      })
      return data
    },
    isDone: (data) => data.status === 'SUCCEEDED',
    isFailed: (data) => ['FAILED', 'CANCELLED', 'THROTTLED'].includes(data.status)
      ? { failed: true, reason: formatRunwayError(data) }
      : { failed: false }
  })

  const videoUrl = taskData.output?.[0]
  if (!videoUrl) {
    throw new Error('Runway video generation succeeded but no output[0] URL was returned')
  }

  const downloadResp = await fetch(videoUrl)
  if (!downloadResp.ok) {
    throw new Error(`Runway video download failed (${downloadResp.status})`)
  }

  const outputPath = `${outputDir}/generated-video.mp4`
  await Bun.write(outputPath, new Uint8Array(await downloadResp.arrayBuffer()))

  const processingTime = Date.now() - startTime
  const videoFile = Bun.file(outputPath)

  logMediaGenerationStatus(l, {
    mediaType: 'video',
    provider: 'runway',
    model: options.model,
    status: 'completed',
    processingTimeMs: processingTime,
    outputCount: 1
  })

  return {
    videoPath: outputPath,
    metadata: {
      videoGenService: 'runway',
      videoGenModel: options.model,
      processingTime,
      videoFileName: 'generated-video.mp4',
      videoFileSize: videoFile.size,
      videoDuration: duration
    }
  }
}
