import * as v from 'valibot'
import * as l from '~/utils/logger'
import type { GlmVideoModel, Step6VideoMetadata } from '~/types'
import { CLIUsageError } from '~/utils/error-handler'
import { logMediaGenerationStatus } from '~/cli/commands/process-steps/generation-command-utils'
import { ensureGlmApiKey, resolveGlmBaseUrl } from '~/cli/commands/process-steps/step-2-extract/step-2-ocr/ocr-services/glm-ocr/glm'
import { estimateVideoCost, logVideoEstimate } from '~/cli/commands/process-steps/step-6-video/video-utils/video-pricing'
import {
  normalizeGlmAspectRatio,
  normalizeGlmDuration,
  normalizeGlmFps,
  normalizeGlmQuality,
  normalizeGlmSize
} from '~/cli/commands/process-steps/step-6-video/video-utils/video-normalization'
import { pollUntil } from '~/utils/retries'
import { validateData } from '~/utils/validate/validation'
import { MEDIA_GENERATION_TIMEOUT_MS } from '~/utils/timeouts'
import { videoMediaReferenceToUrlOrDataUrl } from '../../video-utils/video-media-inputs'
import type { VideoMode } from '../../video-types'

const POLL_INTERVAL_MS = 10_000
const POLL_TIMEOUT_MS = MEDIA_GENERATION_TIMEOUT_MS
const GLM_PROMPT_MAX_CHARS = 512

const GlmCreateVideoResponseSchema = v.object({
  id: v.string(),
  request_id: v.optional(v.string(), undefined),
  model: v.optional(v.string(), undefined),
  task_status: v.optional(v.string(), undefined),
  error: v.optional(v.unknown(), undefined)
})

const GlmPollVideoResponseSchema = v.object({
  id: v.optional(v.string(), undefined),
  request_id: v.optional(v.string(), undefined),
  task_status: v.string(),
  video_result: v.optional(v.array(v.object({ url: v.string() })), undefined),
  error: v.optional(v.unknown(), undefined)
})

const formatGlmError = (value: unknown): string => {
  if (value === undefined || value === null) return 'Unknown error'
  if (typeof value === 'string') return value
  try {
    return JSON.stringify(value)
  } catch {
    return String(value)
  }
}

export const runGlmVideoGen = async (
  prompt: string,
  outputDir: string,
  options: {
    model: GlmVideoModel
    mode?: VideoMode | undefined
    durationSeconds?: number | undefined
    size?: string | undefined
    aspectRatio?: string | undefined
    inputImage?: string | undefined
    lastFrameImage?: string | undefined
    referenceImages?: string[] | undefined
  }
): Promise<{ videoPath: string, metadata: Step6VideoMetadata }> => {
  if (prompt.length > GLM_PROMPT_MAX_CHARS) {
    throw CLIUsageError(`GLM video prompts must be ${GLM_PROMPT_MAX_CHARS} characters or fewer. Received ${prompt.length}.`)
  }

  const apiKey = ensureGlmApiKey('GLM video generation')
  const baseURL = resolveGlmBaseUrl()
  const duration = normalizeGlmDuration(options.model, options.durationSeconds)
  const size = normalizeGlmSize(options.model, options.size)
  const aspectRatio = normalizeGlmAspectRatio(options.aspectRatio)
  const mode = options.mode ?? 'text'

  logMediaGenerationStatus(l, {
    mediaType: 'video',
    provider: 'glm',
    model: options.model,
    status: 'started'
  })

  const estimate = estimateVideoCost({
    glmVideoModel: options.model,
    videoDuration: options.durationSeconds,
    videoSize: options.size
  })
  logVideoEstimate(estimate)

  const inputImageUrl = options.inputImage
    ? await videoMediaReferenceToUrlOrDataUrl(options.inputImage, 'image')
    : undefined
  const lastFrameUrl = options.lastFrameImage
    ? await videoMediaReferenceToUrlOrDataUrl(options.lastFrameImage, 'image')
    : undefined
  const referenceImageUrls = options.referenceImages && options.referenceImages.length > 0
    ? await Promise.all(options.referenceImages.map(async (input) => await videoMediaReferenceToUrlOrDataUrl(input, 'image')))
    : undefined

  const imageUrl = mode === 'interpolate'
    ? [inputImageUrl, lastFrameUrl].filter((value): value is string => typeof value === 'string')
    : mode === 'reference-to-video'
      ? referenceImageUrls
      : inputImageUrl

  const requestBody: Record<string, unknown> = options.model === 'cogvideox-3'
    ? {
        model: options.model,
        prompt,
        quality: normalizeGlmQuality(undefined),
        with_audio: false,
        size,
        fps: normalizeGlmFps(undefined),
        duration,
        ...(imageUrl ? { image_url: imageUrl } : {})
      }
    : {
        model: options.model,
        prompt,
        duration,
        size,
        movement_amplitude: 'auto',
        ...(options.model === 'viduq1-text' ? { style: 'general', aspect_ratio: aspectRatio } : {}),
        ...(options.model === 'vidu2-reference' ? { aspect_ratio: aspectRatio, with_audio: false } : {}),
        ...(imageUrl ? { image_url: imageUrl } : {})
      }

  const startTime = Date.now()
  const createResp = await fetch(`${baseURL}/videos/generations`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(requestBody)
  })

  if (!createResp.ok) {
    const body = await createResp.text()
    throw new Error(`GLM video generation request failed (${createResp.status}): ${body || 'No response body'}`)
  }

  const createData = validateData(
    GlmCreateVideoResponseSchema,
    await createResp.json() as unknown,
    'GLM video generation create response'
  )

  if (createData.task_status === 'FAIL') {
    throw new Error(`GLM video generation failed: ${formatGlmError(createData.error)}`)
  }

  const taskData = await pollUntil({
    operationName: 'glm-video-gen',
    intervalMs: POLL_INTERVAL_MS,
    deadlineMs: POLL_TIMEOUT_MS,
    pollFn: async () => {
      const pollResp = await fetch(`${baseURL}/async-result/${encodeURIComponent(createData.id)}`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        }
      })

      if (!pollResp.ok) {
        const body = await pollResp.text()
        throw new Error(`GLM video generation query failed (${pollResp.status}): ${body || 'No response body'}`)
      }

      const data = validateData(
        GlmPollVideoResponseSchema,
        await pollResp.json() as unknown,
        'GLM video generation query response'
      )
      logMediaGenerationStatus(l, {
        mediaType: 'video',
        provider: 'glm',
        model: options.model,
        status: data.task_status
      })
      return data
    },
    isDone: (data) => data.task_status === 'SUCCESS',
    isFailed: (data) => data.task_status === 'FAIL'
      ? { failed: true, reason: formatGlmError(data.error) }
      : { failed: false }
  })

  const videoUrl = taskData.video_result?.[0]?.url
  if (!videoUrl) {
    throw new Error('GLM video generation succeeded but no video_result[0].url was returned')
  }

  const downloadResp = await fetch(videoUrl)
  if (!downloadResp.ok) {
    throw new Error(`GLM video download failed (${downloadResp.status})`)
  }

  const outputPath = `${outputDir}/generated-video.mp4`
  await Bun.write(outputPath, new Uint8Array(await downloadResp.arrayBuffer()))

  const processingTime = Date.now() - startTime
  const videoFile = Bun.file(outputPath)

  logMediaGenerationStatus(l, {
    mediaType: 'video',
    provider: 'glm',
    model: options.model,
    status: 'completed',
    processingTimeMs: processingTime,
    outputCount: 1
  })

  return {
    videoPath: outputPath,
    metadata: {
      videoGenService: 'glm',
      videoGenModel: options.model,
      processingTime,
      videoFileName: 'generated-video.mp4',
      videoFileSize: videoFile.size,
      videoDuration: duration,
      requestMode: mode,
      ...(options.inputImage ? { inputImage: options.inputImage } : {}),
      ...(options.lastFrameImage ? { lastFrameImage: options.lastFrameImage } : {}),
      ...(options.referenceImages && options.referenceImages.length > 0 ? { referenceImages: options.referenceImages } : {})
    }
  }
}
