import * as v from 'valibot'
import * as l from '~/utils/logger'
import type { DeapiVideoModel, Step6VideoMetadata } from '~/types'
import { logMediaGenerationStatus } from '~/cli/commands/process-steps/generation-command-utils'
import { estimateVideoCost, logVideoEstimate } from '~/cli/commands/process-steps/step-6-video/video-utils/video-pricing'
import {
  getDeapiVideoFps,
  normalizeDeapiVideoDuration,
  normalizeDeapiVideoFrames,
  normalizeDeapiVideoSize
} from '~/cli/commands/process-steps/step-6-video/video-utils/video-normalization'
import {
  deapiFetch,
  ensureDeapiApiKey,
  extractDeapiErrorMessage,
  extractResultUrl,
  parseRequestId,
  pollDeapiJob,
  readJsonOrText
} from '~/utils/deapi'
import { validateData } from '~/utils/validate/validation'
import { MEDIA_GENERATION_TIMEOUT_MS } from '~/utils/timeouts'

const POLL_INITIAL_INTERVAL_MS = 10_000
const POLL_TIMEOUT_MS = MEDIA_GENERATION_TIMEOUT_MS
const MAX_31_BIT_SEED = 0x7fffffff

const DeapiCreateVideoResponseSchema = v.object({
  data: v.object({
    request_id: v.string()
  })
})

const DeapiJobDataSchema = v.object({
  status: v.string(),
  result_url: v.optional(v.string(), undefined),
  result: v.optional(v.unknown(), undefined)
})

const DeapiPollVideoResponseSchema = v.union([
  v.object({ data: DeapiJobDataSchema }),
  DeapiJobDataSchema
])

const buildSeed = (): number =>
  Math.floor(Math.random() * MAX_31_BIT_SEED) + 1

const shouldSendSteps = (model: DeapiVideoModel): boolean =>
  model === 'Ltxv_13B_0_9_8_Distilled_FP8'

const downloadResultVideo = async (resultUrl: string, outputPath: string): Promise<void> => {
  const response = await fetch(resultUrl, {
    method: 'GET',
    headers: { accept: 'video/mp4,video/*;q=0.9,*/*;q=0.8' }
  })
  if (!response.ok) {
    throw new Error(`deAPI video result download failed (${response.status})`)
  }

  const bytes = new Uint8Array(await response.arrayBuffer())
  if (bytes.byteLength === 0) {
    throw new Error('deAPI video generation returned an empty video')
  }
  await Bun.write(outputPath, bytes)
}

export const runDeapiVideoGen = async (
  prompt: string,
  outputDir: string,
  options: {
    model: DeapiVideoModel
    durationSeconds?: number | undefined
    videoSize?: string | undefined
  }
): Promise<{ videoPath: string, metadata: Step6VideoMetadata }> => {
  const apiKey = ensureDeapiApiKey('deAPI video generation')
  const { width, height } = normalizeDeapiVideoSize(options.model, options.videoSize)
  const frames = normalizeDeapiVideoFrames(options.model, options.durationSeconds)
  const duration = normalizeDeapiVideoDuration(options.model, options.durationSeconds)
  const fps = getDeapiVideoFps(options.model)
  const outputPath = `${outputDir}/generated-video.mp4`

  const estimate = estimateVideoCost({
    deapiVideoModel: options.model,
    videoDuration: options.durationSeconds,
    videoSize: options.videoSize
  })
  logVideoEstimate(estimate)

  logMediaGenerationStatus(l, {
    mediaType: 'video',
    provider: 'deapi',
    model: options.model,
    status: 'started'
  })

  const startTime = Date.now()
  const createResponse = await deapiFetch('/api/v2/videos/generations', {
    apiKey,
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      prompt,
      model: options.model,
      width,
      height,
      guidance: 0,
      ...(shouldSendSteps(options.model) ? { steps: 1 } : {}),
      frames,
      fps,
      seed: buildSeed()
    })
  })

  const createPayload = await readJsonOrText(createResponse)
  if (!createResponse.ok) {
    throw new Error(`deAPI video request failed (${createResponse.status}): ${extractDeapiErrorMessage(createPayload) ?? 'Unknown error'}`)
  }

  validateData(DeapiCreateVideoResponseSchema, createPayload, 'deAPI video generation create response')
  const requestId = parseRequestId(createPayload)
  if (!requestId) {
    throw new Error('deAPI video request did not return request_id')
  }

  const { status } = await pollDeapiJob({
    requestId,
    apiKey,
    operationName: 'deapi-poll-video',
    initialPollIntervalMs: POLL_INITIAL_INTERVAL_MS,
    maxPollIntervalMs: POLL_INITIAL_INTERVAL_MS,
    deadlineMs: POLL_TIMEOUT_MS
  })
  validateData(DeapiPollVideoResponseSchema, status.raw, 'deAPI video generation poll response')

  const resultUrl = extractResultUrl(status)
  if (!resultUrl) {
    throw new Error('deAPI video generation completed without result_url')
  }

  await downloadResultVideo(resultUrl, outputPath)

  const processingTime = Date.now() - startTime
  const videoFile = Bun.file(outputPath)

  logMediaGenerationStatus(l, {
    mediaType: 'video',
    provider: 'deapi',
    model: options.model,
    status: 'completed',
    processingTimeMs: processingTime,
    outputCount: 1
  })

  return {
    videoPath: outputPath,
    metadata: {
      videoGenService: 'deapi',
      videoGenModel: options.model,
      processingTime,
      videoFileName: 'generated-video.mp4',
      videoFileSize: videoFile.size,
      videoDuration: duration
    }
  }
}
