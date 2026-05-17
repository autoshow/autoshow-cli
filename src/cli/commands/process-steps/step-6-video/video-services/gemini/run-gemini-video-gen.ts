import { mkdir } from 'node:fs/promises'
import type { GeminiVideoModel, Step6VideoMetadata } from '~/types'
import { logMediaGenerationStatus } from '~/cli/commands/process-steps/generation-command-utils'
import { estimateVideoCost, logVideoEstimate } from '~/cli/commands/process-steps/step-6-video/video-utils/video-pricing'
import { readEnv } from '~/utils/validate/env-utils'
import * as l from '~/utils/logger'
import { normalizeGeminiDuration, normalizeGeminiResolution } from '~/cli/commands/process-steps/step-6-video/video-utils/video-normalization'
import { pollUntil } from '~/utils/retries'
import { MEDIA_GENERATION_TIMEOUT_MS } from '~/utils/timeouts'
import { geminiDownloadFile, geminiGetOperation, geminiPredictLongRunning } from '~/utils/gemini/gemini-rest'

const POLL_INTERVAL_MS = 10_000
const POLL_TIMEOUT_MS = MEDIA_GENERATION_TIMEOUT_MS

export const runGeminiVideoGen = async (
  prompt: string,
  outputDir: string,
  options: { model: GeminiVideoModel, aspectRatio?: string | undefined, resolution?: string | undefined, durationSeconds?: number | undefined }
): Promise<{ videoPath: string, metadata: Step6VideoMetadata }> => {
  const apiKey = readEnv('GEMINI_API_KEY')
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY environment variable is required')
  }

  logMediaGenerationStatus(l, {
    mediaType: 'video',
    provider: 'gemini',
    model: options.model,
    status: 'started'
  })

  const estimate = estimateVideoCost({
    geminiVideoModel: options.model,
    videoDuration: options.durationSeconds,
    videoResolution: options.resolution
  })
  logVideoEstimate(estimate)

  await mkdir(outputDir, { recursive: true })
  const normalizedResolution = normalizeGeminiResolution(options.resolution)
  const normalizedDuration = normalizeGeminiDuration(options.durationSeconds, normalizedResolution)

  const startTime = Date.now()
  let operation = await geminiPredictLongRunning(apiKey, {
    model: options.model,
    prompt,
    ...(options.aspectRatio ? { aspectRatio: options.aspectRatio } : {}),
    resolution: normalizedResolution,
    durationSeconds: normalizedDuration,
    numberOfVideos: 1
  })

  const completedOp = await pollUntil({
    operationName: 'gemini-video-gen',
    intervalMs: POLL_INTERVAL_MS,
    deadlineMs: POLL_TIMEOUT_MS,
    pollFn: async () => {
      logMediaGenerationStatus(l, {
        mediaType: 'video',
        provider: 'gemini',
        model: options.model,
        status: 'in_progress'
      })
      const operationName = operation.name
      if (!operationName) {
        throw new Error('Gemini video generation did not return an operation name')
      }
      operation = await geminiGetOperation(apiKey, operationName)
      return operation
    },
    isDone: (op) => op.done === true,
    isFailed: (op) => {
      if (op.error) {
        return { failed: true, reason: JSON.stringify(op.error) }
      }
      return { failed: false }
    }
  })
  operation = completedOp

  const video = operation.response?.generatedVideos?.[0]?.video
  if (!video) {
    throw new Error('Gemini video generation completed but no video was returned')
  }

  const outputPath = `${outputDir}/generated-video.mp4`
  await geminiDownloadFile(apiKey, video, outputPath)

  const processingTime = Date.now() - startTime
  const videoFile = Bun.file(outputPath)

  logMediaGenerationStatus(l, {
    mediaType: 'video',
    provider: 'gemini',
    model: options.model,
    status: 'completed',
    processingTimeMs: processingTime,
    outputCount: 1,
    detail: `Actual billed cost was not returned by the API; estimate ${estimate.totalCost.toFixed(3)}¢`
  })

  const metadata: Step6VideoMetadata = {
    videoGenService: 'gemini',
    videoGenModel: options.model,
    processingTime,
    videoFileName: 'generated-video.mp4',
    videoFileSize: videoFile.size,
    videoDuration: normalizedDuration
  }

  return { videoPath: outputPath, metadata }
}
