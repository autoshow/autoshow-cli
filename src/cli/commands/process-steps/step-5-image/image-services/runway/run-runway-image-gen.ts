import * as v from 'valibot'
import * as l from '~/utils/logger'
import type { RunwayImageModel, Step5Metadata } from '~/types'
import { CLIUsageError } from '~/utils/error-handler'
import { logMediaGenerationStatus } from '~/cli/commands/process-steps/generation-command-utils'
import { readEnv } from '~/utils/validate/env-utils'
import { validateData } from '~/utils/validate/validation'
import { pollUntil } from '~/utils/retries'
import { MEDIA_GENERATION_TIMEOUT_MS } from '~/utils/timeouts'

const RUNWAY_BASE_URL = 'https://api.dev.runwayml.com/v1'
const RUNWAY_API_VERSION = '2024-11-06'
const POLL_INTERVAL_MS = 10_000
const POLL_TIMEOUT_MS = MEDIA_GENERATION_TIMEOUT_MS

const RunwayCreateTaskSchema = v.object({
  id: v.string()
})

const RunwayTaskSchema = v.object({
  id: v.optional(v.string(), undefined),
  status: v.string(),
  output: v.optional(v.array(v.string()), undefined),
  failure: v.optional(v.string(), undefined),
  failureCode: v.optional(v.string(), undefined)
})

const RUNWAY_RATIOS: Record<'720p' | '1080p', Record<string, string>> = {
  '720p': {
    '1:1': '720:720',
    '16:9': '1280:720',
    '9:16': '720:1280',
    '4:3': '960:720',
    '3:4': '720:960',
    '21:9': '1680:720'
  },
  '1080p': {
    '1:1': '1080:1080',
    '16:9': '1920:1080',
    '9:16': '1080:1920',
    '4:3': '1440:1080',
    '3:4': '1080:1440',
    '21:9': '2112:912'
  }
}

const contentTypeToExtension = (contentType: string | null): string => {
  const normalized = contentType?.split(';')[0]?.trim().toLowerCase()
  if (normalized === 'image/jpeg' || normalized === 'image/jpg') return 'jpg'
  if (normalized === 'image/webp') return 'webp'
  if (normalized === 'image/png') return 'png'
  return 'png'
}

export const normalizeRunwayImageResolution = (size: string | undefined): '720p' | '1080p' => {
  if (size === undefined || size.length === 0) return '720p'
  const normalized = size.toLowerCase()
  if (normalized === '720p' || normalized === '1080p') return normalized
  throw CLIUsageError(`Invalid --image-size value "${size}" for Runway. Expected 720p or 1080p.`)
}

export const normalizeRunwayImageRatio = (
  aspectRatio: string | undefined,
  resolution: '720p' | '1080p'
): string => {
  const requested = aspectRatio ?? '16:9'
  const ratio = RUNWAY_RATIOS[resolution][requested]
  if (!ratio) {
    throw CLIUsageError(`Invalid --image-aspect-ratio value "${requested}" for Runway. Expected one of: ${Object.keys(RUNWAY_RATIOS[resolution]).join(', ')}.`)
  }
  return ratio
}

export const runRunwayImageGen = async (
  prompt: string,
  outputDir: string,
  options: { model: RunwayImageModel, aspectRatio?: string | undefined, imageSize?: string | undefined }
): Promise<{ imagePaths: string[], metadata: Step5Metadata }> => {
  const apiKey = readEnv('RUNWAYML_API_SECRET')
  if (!apiKey) {
    throw new Error('RUNWAYML_API_SECRET environment variable is required for Runway image generation')
  }

  if (prompt.length > 1000) {
    throw CLIUsageError('Runway gen4_image prompts must be 1000 UTF-16 code units or fewer.')
  }

  const resolution = normalizeRunwayImageResolution(options.imageSize)
  const ratio = normalizeRunwayImageRatio(options.aspectRatio, resolution)
  const startTime = Date.now()

  logMediaGenerationStatus(l, {
    mediaType: 'image',
    provider: 'runway',
    model: options.model,
    status: 'started'
  })

  const createResp = await fetch(`${RUNWAY_BASE_URL}/text_to_image`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'X-Runway-Version': RUNWAY_API_VERSION
    },
    body: JSON.stringify({
      model: options.model,
      promptText: prompt,
      ratio
    })
  })

  if (!createResp.ok) {
    const body = await createResp.text()
    throw new Error(`Runway image generation request failed (${createResp.status}): ${body || 'No response body'}`)
  }

  const createData = validateData(
    RunwayCreateTaskSchema,
    await createResp.json() as unknown,
    'Runway image generation create response'
  )

  const task = await pollUntil({
    operationName: 'runway-image-gen',
    intervalMs: POLL_INTERVAL_MS,
    deadlineMs: POLL_TIMEOUT_MS,
    pollFn: async () => {
      const taskResp = await fetch(`${RUNWAY_BASE_URL}/tasks/${encodeURIComponent(createData.id)}`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'X-Runway-Version': RUNWAY_API_VERSION
        }
      })

      if (!taskResp.ok) {
        const body = await taskResp.text()
        throw new Error(`Runway image generation query failed (${taskResp.status}): ${body || 'No response body'}`)
      }

      const data = validateData(
        RunwayTaskSchema,
        await taskResp.json() as unknown,
        'Runway image generation task response'
      )
      logMediaGenerationStatus(l, {
        mediaType: 'image',
        provider: 'runway',
        model: options.model,
        status: data.status
      })
      return data
    },
    isDone: (data) => data.status.toUpperCase() === 'SUCCEEDED',
    isFailed: (data) => {
      const status = data.status.toUpperCase()
      if (status === 'FAILED' || status === 'CANCELED') {
        return { failed: true, reason: data.failure ?? data.failureCode ?? 'Unknown error' }
      }
      return { failed: false }
    }
  })

  const imageUrl = task.output?.[0]
  if (!imageUrl) {
    throw new Error('Runway image generation succeeded but no output URL was returned')
  }

  const downloadResp = await fetch(imageUrl)
  if (!downloadResp.ok) {
    throw new Error(`Runway image download failed (${downloadResp.status})`)
  }

  const ext = contentTypeToExtension(downloadResp.headers.get('content-type'))
  const fileName = `generated-image.${ext}`
  const outputPath = `${outputDir}/${fileName}`
  await Bun.write(outputPath, new Uint8Array(await downloadResp.arrayBuffer()))

  const processingTime = Date.now() - startTime
  const imageFile = Bun.file(outputPath)

  logMediaGenerationStatus(l, {
    mediaType: 'image',
    provider: 'runway',
    model: options.model,
    status: 'completed',
    processingTimeMs: processingTime,
    outputCount: 1
  })

  return {
    imagePaths: [outputPath],
    metadata: {
      imageService: 'runway',
      imageModel: options.model,
      processingTime,
      imageCount: 1,
      imageFileNames: [fileName],
      imageFileSize: imageFile.size,
      imageWidth: undefined,
      imageHeight: undefined,
      requestMode: 'generation'
    }
  }
}
