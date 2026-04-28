import type { DeapiMusicModel, Step7MusicMetadata } from '~/types'
import * as l from '~/utils/logger'
import { logLocationsTable } from '~/utils/logger/human-table'
import { logMediaGenerationStatus } from '~/cli/commands/process-steps/generation-command-utils'
import {
  deapiFetch,
  ensureDeapiApiKey,
  extractDeapiErrorMessage,
  extractResultUrl,
  parseRequestId,
  pollDeapiJob,
  readJsonOrText
} from '~/utils/deapi'
import { normalizeDeapiMusicParams, resolveDeapiMusicPrice } from './deapi-music-pricing'

const MIN_CAPTION_CHARS = 3
const MAX_CAPTION_CHARS = 300

const normalizeCaption = (prompt: string): string => {
  const caption = prompt.trim()
  if (caption.length < MIN_CAPTION_CHARS) {
    throw new Error(`deAPI music prompt must be at least ${MIN_CAPTION_CHARS} characters.`)
  }
  if (caption.length > MAX_CAPTION_CHARS) {
    throw new Error(`deAPI music prompt must be ${MAX_CAPTION_CHARS} characters or fewer. Received ${caption.length} characters.`)
  }
  return caption
}

const resolveLyrics = async (
  lyricsFile: string | undefined,
  forceInstrumental: boolean | undefined
): Promise<{ lyrics: string, lyricsSource: Step7MusicMetadata['lyricsSource'] }> => {
  if (forceInstrumental || !lyricsFile) {
    return { lyrics: '[Instrumental]', lyricsSource: 'none' }
  }

  const lyrics = (await Bun.file(lyricsFile).text()).trim()
  if (!lyrics) {
    throw new Error(`deAPI music lyrics file is empty: ${lyricsFile}`)
  }
  return { lyrics, lyricsSource: 'provided' }
}

const downloadResultAudio = async (resultUrl: string, outputPath: string): Promise<void> => {
  const response = await fetch(resultUrl, {
    method: 'GET',
    headers: { accept: 'audio/mpeg,audio/*;q=0.9,*/*;q=0.8' }
  })
  if (!response.ok) {
    throw new Error(`deAPI music result download failed (${response.status})`)
  }

  const bytes = new Uint8Array(await response.arrayBuffer())
  if (bytes.byteLength === 0) {
    throw new Error('deAPI music generation returned empty audio')
  }
  await Bun.write(outputPath, bytes)
}

export const runDeapiMusicGen = async (
  prompt: string,
  outputDir: string,
  options: {
    model: DeapiMusicModel
    durationSeconds?: number | undefined
    lyricsFile?: string | undefined
    forceInstrumental?: boolean | undefined
  }
): Promise<{ musicPath: string, metadata: Step7MusicMetadata }> => {
  const apiKey = ensureDeapiApiKey('deAPI music generation')
  const caption = normalizeCaption(prompt)
  const params = normalizeDeapiMusicParams(options.model, options.durationSeconds)
  const { lyrics, lyricsSource } = await resolveLyrics(options.lyricsFile, options.forceInstrumental)
  const musicPath = `${outputDir}/generated-music.mp3`

  const price = await resolveDeapiMusicPrice({ model: options.model, params })
  if (price.warning) {
    l.warn(price.warning)
  }

  logMediaGenerationStatus(l, {
    mediaType: 'music',
    provider: 'deapi',
    model: options.model,
    status: 'started'
  })

  const startTime = Date.now()
  const body = new FormData()
  body.append('caption', caption)
  body.append('model', options.model)
  body.append('lyrics', lyrics)
  body.append('duration', String(params.duration))
  body.append('inference_steps', String(params.inferenceSteps))
  body.append('guidance_scale', String(params.guidanceScale))
  body.append('seed', '-1')
  body.append('format', 'mp3')

  const createResponse = await deapiFetch('/api/v2/audio/music', {
    apiKey,
    method: 'POST',
    body
  })
  const createPayload = await readJsonOrText(createResponse)
  if (!createResponse.ok) {
    throw new Error(`deAPI music request failed (${createResponse.status}): ${extractDeapiErrorMessage(createPayload) ?? 'Unknown error'}`)
  }

  const requestId = parseRequestId(createPayload)
  if (!requestId) {
    throw new Error('deAPI music request did not return request_id')
  }

  const { status } = await pollDeapiJob({
    requestId,
    apiKey,
    operationName: 'deapi-poll-music'
  })
  const resultUrl = extractResultUrl(status)
  if (!resultUrl) {
    throw new Error('deAPI music completed without result_url')
  }

  await downloadResultAudio(resultUrl, musicPath)

  const processingTime = Date.now() - startTime
  const musicFile = Bun.file(musicPath)

  logMediaGenerationStatus(l, {
    mediaType: 'music',
    provider: 'deapi',
    model: options.model,
    status: 'completed',
    processingTimeMs: processingTime,
    outputCount: 1
  })
  logLocationsTable(l, [{ artifact: 'music', path: musicPath }], { level: 'success' })

  const metadata: Step7MusicMetadata = {
    musicService: 'deapi',
    musicModel: options.model,
    processingTime,
    musicFileName: 'generated-music.mp3',
    musicFileSize: musicFile.size,
    musicDurationMs: params.duration * 1000,
    lyricsSource,
    providerCostCents: price.totalCost,
    providerCostSource: price.source
  }

  return { musicPath, metadata }
}
