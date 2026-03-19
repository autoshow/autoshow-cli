import OpenAI from 'openai'
import { mkdir } from 'node:fs/promises'
import type { Step6VideoMetadata } from '~/types'
import type { SoraVideoModel } from '~/cli/commands/models/model-options'
import { estimateVideoCost, logVideoEstimate } from '~/cli/commands/process-steps/step-6-video/video-utils/video-pricing'
import { readEnv, readEnvFallback } from '~/utils/validate/env-utils'
import * as l from '~/logger'
import { normalizeSoraSeconds, normalizeSoraSize, parseSoraSeconds } from '~/cli/commands/process-steps/step-6-video/video-utils/video-normalization'
import { pollUntil } from '~/utils/retries'

const POLL_INTERVAL_MS = 10_000
const POLL_TIMEOUT_MS = 10 * 60_000

const getClientConfig = (): { apiKey: string, baseURL?: string } => {
  const apiKey = readEnvFallback('OPENAI_API_KEY', 'NITRO_OPENAI_API_KEY')
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY environment variable is required')
  }

  const baseURL = readEnv('OPENAI_BASE_URL')
  return baseURL ? { apiKey, baseURL } : { apiKey }
}

export const runSoraVideoGen = async (
  prompt: string,
  outputDir: string,
  options: { model: SoraVideoModel, seconds?: number | undefined, size?: string | undefined }
): Promise<{ videoPath: string, metadata: Step6VideoMetadata }> => {
  l.info(`Running Sora video model: ${options.model}`)

  const estimate = estimateVideoCost({
    soraVideoModel: options.model,
    videoDuration: options.seconds,
    videoSize: options.size
  })
  logVideoEstimate(estimate)

  const config = getClientConfig()
  const client = new OpenAI({ apiKey: config.apiKey, ...(config.baseURL ? { baseURL: config.baseURL } : {}) })

  await mkdir(outputDir, { recursive: true })

  const seconds = normalizeSoraSeconds(options.seconds)
  const size = normalizeSoraSize(options.size)

  const startTime = Date.now()
  const initialJob = await client.videos.create({
    model: options.model,
    prompt,
    seconds,
    size
  })

  const job = await pollUntil({
    operationName: 'sora-video-gen',
    intervalMs: POLL_INTERVAL_MS,
    deadlineMs: POLL_TIMEOUT_MS,
    pollFn: async () => {
      const latest = await client.videos.retrieve(initialJob.id)
      l.info(`Sora video status: ${latest.status} (${latest.progress}%)`)
      return latest
    },
    isDone: (j) => j.status === 'completed',
    isFailed: (j) => {
      if (j.status === 'failed') {
        return { failed: true, reason: j.error?.message ?? 'Sora video generation failed' }
      }
      return { failed: false }
    }
  })

  const response = await client.videos.downloadContent(job.id)
  if (!response.ok) {
    throw new Error(`Failed to download generated Sora video: HTTP ${response.status}`)
  }

  const outputPath = `${outputDir}/generated-video.mp4`
  const bytes = new Uint8Array(await response.arrayBuffer())
  await Bun.write(outputPath, bytes)

  const processingTime = Date.now() - startTime
  const videoFile = Bun.file(outputPath)

  l.success(`Sora video generation completed in ${(processingTime / 1000).toFixed(1)}s`)
  l.info(`Actual billed cost was not returned by the API; using estimate ${estimate.totalCost.toFixed(4)}¢`)

  const metadata: Step6VideoMetadata = {
    videoGenService: 'sora',
    videoGenModel: options.model,
    processingTime,
    videoFileName: 'generated-video.mp4',
    videoFileSize: videoFile.size,
    videoDuration: parseSoraSeconds(seconds)
  }

  return { videoPath: outputPath, metadata }
}
