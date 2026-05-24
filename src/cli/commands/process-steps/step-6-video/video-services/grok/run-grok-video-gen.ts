import * as v from 'valibot'
import * as l from '~/utils/logger'
import type { GrokVideoModel, Step6VideoMetadata } from '~/types'
import { logMediaGenerationStatus } from '~/cli/commands/process-steps/generation-command-utils'
import { estimateVideoCost, logVideoEstimate } from '~/cli/commands/process-steps/step-6-video/video-utils/video-pricing'
import {
  normalizeGrokVideoAspectRatio,
  normalizeGrokVideoDuration,
  normalizeGrokVideoExtensionDuration,
  normalizeGrokVideoResolution
} from '~/cli/commands/process-steps/step-6-video/video-utils/video-normalization'
import { pollUntil } from '~/utils/retries'
import { readEnv } from '~/utils/validate/env-utils'
import { XAI_DEFAULT_BASE_URL } from '~/utils/base-urls'
import { validateData } from '~/utils/validate/validation'
import { MEDIA_GENERATION_TIMEOUT_MS } from '~/utils/timeouts'
import { videoMediaReferenceToGrokUrlObject } from '../../video-utils/video-media-inputs'
import type { VideoMode } from '../../video-types'
const POLL_INTERVAL_MS = 10_000
const POLL_TIMEOUT_MS = MEDIA_GENERATION_TIMEOUT_MS

const GrokCreateVideoResponseSchema = v.object({
  request_id: v.string()
})

const GrokPollVideoResponseSchema = v.object({
  status: v.string(),
  error: v.optional(v.unknown(), undefined),
  model: v.optional(v.string(), undefined),
  progress: v.optional(v.number(), undefined),
  usage: v.optional(v.object({
    cost_in_usd_ticks: v.optional(v.number(), undefined)
  }), undefined),
  video: v.optional(v.object({
    url: v.optional(v.nullable(v.string()), undefined),
    duration: v.optional(v.number(), undefined),
    respect_moderation: v.optional(v.boolean(), undefined),
    file_output: v.optional(v.unknown(), undefined),
    storage_error: v.optional(v.unknown(), undefined)
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
  options: {
    model: GrokVideoModel
    mode?: VideoMode | undefined
    durationSeconds?: number | undefined
    aspectRatio?: string | undefined
    resolution?: string | undefined
    inputImage?: string | undefined
    referenceImages?: string[] | undefined
    inputVideo?: string | undefined
    storageFilename?: string | undefined
    storageExpiresAfter?: number | undefined
  }
): Promise<{ videoPath: string, metadata: Step6VideoMetadata }> => {
  const apiKey = readEnv('XAI_API_KEY')
  if (!apiKey) {
    throw new Error('XAI_API_KEY environment variable is required for Grok video generation')
  }

  const baseURL = XAI_DEFAULT_BASE_URL
  const mode = options.mode ?? 'text'
  const duration = mode === 'extend'
    ? normalizeGrokVideoExtensionDuration(options.durationSeconds)
    : normalizeGrokVideoDuration(options.durationSeconds)
  const aspectRatio = mode === 'edit' || mode === 'extend' ? undefined : normalizeGrokVideoAspectRatio(options.aspectRatio)
  const resolution = mode === 'edit' || mode === 'extend' ? undefined : normalizeGrokVideoResolution(options.resolution)
  const storageOptions = options.storageFilename || options.storageExpiresAfter !== undefined
    ? {
        ...(options.storageFilename ? { filename: options.storageFilename } : {}),
        ...(options.storageExpiresAfter !== undefined ? { expires_after: options.storageExpiresAfter } : {})
      }
    : undefined
  const endpoint = mode === 'edit'
    ? '/videos/edits'
    : mode === 'extend'
      ? '/videos/extensions'
      : '/videos/generations'

  logMediaGenerationStatus(l, {
    mediaType: 'video',
    provider: 'grok',
    model: options.model,
    status: 'started'
  })

  const estimate = estimateVideoCost({
    grokVideoModel: options.model,
    videoDuration: options.durationSeconds,
    videoResolution: options.resolution,
    videoMode: options.mode
  })
  logVideoEstimate(estimate)

  const startTime = Date.now()
  const image = options.inputImage
    ? await videoMediaReferenceToGrokUrlObject(options.inputImage, 'image')
    : undefined
  const referenceImages = options.referenceImages && options.referenceImages.length > 0
    ? await Promise.all(options.referenceImages.map(async (input) => await videoMediaReferenceToGrokUrlObject(input, 'image')))
    : undefined
  const inputVideo = options.inputVideo
    ? await videoMediaReferenceToGrokUrlObject(options.inputVideo, 'video')
    : undefined

  const requestBody: Record<string, unknown> = {
    model: options.model,
    prompt,
    ...(storageOptions ? { storage_options: storageOptions } : {})
  }
  if (mode === 'edit') {
    requestBody['video'] = inputVideo
  } else if (mode === 'extend') {
    requestBody['video'] = inputVideo
    requestBody['duration'] = duration
  } else {
    requestBody['duration'] = duration
    requestBody['aspect_ratio'] = aspectRatio
    requestBody['resolution'] = resolution
    if (image) requestBody['image'] = image
    if (referenceImages && referenceImages.length > 0) requestBody['reference_images'] = referenceImages
  }

  const createResp = await fetch(`${baseURL}${endpoint}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(requestBody)
  })

  if (!createResp.ok) {
    const body = await createResp.text()
    throw new Error(`Grok video ${mode} request failed (${createResp.status}): ${body || 'No response body'}`)
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
  if (!videoUrl && taskData.video?.respect_moderation === false) {
    throw new Error('Grok video generation was blocked by moderation and no video URL was returned')
  }
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
      videoDuration: taskData.video?.duration ?? duration,
      requestMode: mode,
      ...(resolution ? { videoResolution: resolution } : {}),
      ...(aspectRatio ? { videoAspectRatio: aspectRatio } : {}),
      ...(options.inputImage ? { inputImage: options.inputImage } : {}),
      ...(options.referenceImages && options.referenceImages.length > 0 ? { referenceImages: options.referenceImages } : {}),
      ...(options.inputVideo ? { inputVideo: options.inputVideo } : {}),
      providerRequestId: createData.request_id,
      ...(taskData.model ? { providerReturnedModel: taskData.model } : {}),
      providerVideoUrl: videoUrl,
      ...(typeof taskData.progress === 'number' ? { providerProgress: taskData.progress } : {}),
      ...(taskData.video?.respect_moderation !== undefined ? { providerModeration: taskData.video.respect_moderation } : {}),
      ...(taskData.video?.file_output !== undefined ? { providerFileOutput: taskData.video.file_output } : {}),
      ...(taskData.video?.storage_error !== undefined ? { providerStorageError: taskData.video.storage_error } : {}),
      ...(typeof taskData.usage?.cost_in_usd_ticks === 'number'
        ? {
            providerCostCents: taskData.usage.cost_in_usd_ticks / 100_000_000,
            providerCostSource: 'provider_usage' as const
          }
        : {})
    }
  }
}
