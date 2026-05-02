import * as v from 'valibot'
import type { MinimaxMusicModel, MinimaxMusicResponse, Step7MusicMetadata } from '~/types'
import * as l from '~/utils/logger'
import { logLocationsTable } from '~/utils/logger/human-table'
import { logMediaGenerationStatus } from '~/cli/commands/process-steps/generation-command-utils'
import { readEnv } from '~/utils/validate/env-utils'
import { validateData } from '~/utils/validate/validation'
import {
  MinimaxBaseRespSchema,
  ensureMinimaxBaseRespSuccess,
  parseMinimaxJsonResponse,
} from '~/cli/commands/process-steps/step-4-tts/tts-services/minimax/minimax-utils'
import { MEDIA_GENERATION_TIMEOUT_MS } from '~/utils/timeouts'

const MINIMAX_DEFAULT_BASE_URL = 'https://api.minimax.io'
const REQUEST_TIMEOUT_MS = MEDIA_GENERATION_TIMEOUT_MS
const INCOMPLETE_RESPONSE_RETRY_DELAY_MS = 3_000
const MINIMAX_MUSIC_PROMPT_MAX_CHARS = 2000

const MinimaxLyricsResponseSchema = v.object({
  song_title: v.optional(v.string(), undefined),
  style_tags: v.optional(v.string(), undefined),
  lyrics: v.optional(v.string(), undefined),
  base_resp: v.optional(MinimaxBaseRespSchema, undefined)
})

const MinimaxMusicDataSchema = v.object({
  status: v.optional(v.union([v.number(), v.string()]), undefined),
  audio: v.optional(v.string(), undefined)
})

const MinimaxMusicExtraInfoSchema = v.object({
  music_duration: v.optional(v.number(), undefined)
})

export const MinimaxMusicResponseSchema = v.object({
  data: v.optional(v.nullable(MinimaxMusicDataSchema), undefined),
  extra_info: v.optional(v.nullable(MinimaxMusicExtraInfoSchema), undefined),
  base_resp: v.optional(MinimaxBaseRespSchema, undefined)
})

const clampMinimaxMusicPrompt = (
  prompt: string
): { prompt: string, truncated: boolean } => {
  const trimmed = prompt.trim()
  if (trimmed.length <= MINIMAX_MUSIC_PROMPT_MAX_CHARS) {
    return { prompt: trimmed, truncated: false }
  }

  const candidate = trimmed.slice(0, MINIMAX_MUSIC_PROMPT_MAX_CHARS)
  const boundaryMatch = /^(.*)\s+\S*$/s.exec(candidate)
  const truncatedPrompt = boundaryMatch?.[1]?.trimEnd().length
    ? boundaryMatch[1].trimEnd()
    : candidate.trimEnd()

  return {
    prompt: truncatedPrompt,
    truncated: true
  }
}

const readProvidedLyrics = async (lyricsFile: string): Promise<string> => {
  const file = Bun.file(lyricsFile)
  if (!await file.exists()) {
    throw new Error(`Music lyrics file not found: ${lyricsFile}`)
  }

  const text = (await file.text()).trim()
  if (text.length === 0) {
    throw new Error(`Music lyrics file is empty: ${lyricsFile}`)
  }

  return text
}

const generateLyrics = async (
  baseURL: string,
  apiKey: string,
  prompt: string
): Promise<string> => {
  const response = await fetch(`${baseURL}/v1/lyrics_generation`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      mode: 'write_full_song',
      prompt
    })
  })

  if (!response.ok) {
    const body = await response.text()
    throw new Error(`MiniMax lyrics generation failed (${response.status}): ${body || 'No response body'}`)
  }

  const parsed = validateData(
    MinimaxLyricsResponseSchema,
    await parseMinimaxJsonResponse(response, 'MiniMax lyrics generation response'),
    'MiniMax lyrics generation response'
  )
  ensureMinimaxBaseRespSuccess(parsed.base_resp, 'MiniMax lyrics generation')

  const lyrics = parsed.lyrics?.trim()
  if (!lyrics) {
    throw new Error('MiniMax lyrics generation succeeded but no lyrics were returned')
  }

  return lyrics
}

const requestMusicGeneration = async (
  baseURL: string,
  apiKey: string,
  payload: {
    model: MinimaxMusicModel
    prompt: string
    lyrics: string
  }
): Promise<MinimaxMusicResponse> => {
  let response: Response
  try {
    response = await fetch(`${baseURL}/v1/music_generation`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: payload.model,
        prompt: payload.prompt,
        lyrics: payload.lyrics,
        output_format: 'hex',
        audio_setting: {
          sample_rate: 44100,
          bitrate: 256000,
          format: 'mp3'
        }
      }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS)
    })
  } catch (error) {
    if ((error instanceof DOMException && error.name === 'AbortError')
      || (error instanceof Error && error.name === 'AbortError')) {
      throw new Error(`MiniMax music generation timed out after ${REQUEST_TIMEOUT_MS}ms`)
    }
    throw error
  }

  if (!response.ok) {
    const body = await response.text()
    throw new Error(`MiniMax music generation failed (${response.status}): ${body || 'No response body'}`)
  }

  const parsed = validateData(
    MinimaxMusicResponseSchema,
    await parseMinimaxJsonResponse(response, 'MiniMax music generation response'),
    'MiniMax music generation response'
  )
  ensureMinimaxBaseRespSuccess(parsed.base_resp, 'MiniMax music generation')
  return parsed
}

const isIncompleteSuccessEnvelope = (payload: MinimaxMusicResponse): boolean =>
  payload.base_resp?.status_code === 0 && payload.data == null && payload.extra_info == null

const formatMusicResponseDetails = (payload: MinimaxMusicResponse): string => {
  const details: string[] = []
  if (payload.base_resp?.status_code !== undefined) {
    details.push(`status_code=${payload.base_resp.status_code}`)
  }
  if (payload.base_resp?.status_msg) {
    details.push(`status_msg=${payload.base_resp.status_msg}`)
  }
  if (payload.data?.status !== undefined) {
    details.push(`music_status=${payload.data.status}`)
  }
  details.push(`has_audio=${payload.data?.audio?.trim().length ? 'true' : 'false'}`)
  return details.join(', ')
}

const requestMusicGenerationWithIncompleteRetry = async (
  baseURL: string,
  apiKey: string,
  payload: {
    model: MinimaxMusicModel
    prompt: string
    lyrics: string
  }
): Promise<MinimaxMusicResponse> => {
  const result = await requestMusicGeneration(baseURL, apiKey, payload)
  if (!isIncompleteSuccessEnvelope(result)) {
    return result
  }

  l.warn('MiniMax music generation returned an incomplete success response; retrying once')
  await Bun.sleep(INCOMPLETE_RESPONSE_RETRY_DELAY_MS)

  const retried = await requestMusicGeneration(baseURL, apiKey, payload)
  if (isIncompleteSuccessEnvelope(retried)) {
    throw new Error(`MiniMax music generation returned an incomplete success response after retry (${formatMusicResponseDetails(retried)})`)
  }

  return retried
}

export const runMinimaxMusicGen = async (
  prompt: string,
  outputDir: string,
  options: {
    model: MinimaxMusicModel
    durationSeconds?: number | undefined
    lyricsFile?: string | undefined
    forceInstrumental?: boolean | undefined
  }
): Promise<{ musicPath: string, metadata: Step7MusicMetadata }> => {
  const apiKey = readEnv('MINIMAX_API_KEY')
  if (!apiKey) {
    throw new Error('MINIMAX_API_KEY environment variable is required for MiniMax music generation')
  }

  const baseURL = readEnv('MINIMAX_BASE_URL') ?? MINIMAX_DEFAULT_BASE_URL
  const musicPath = `${outputDir}/generated-music.mp3`

  if (options.durationSeconds !== undefined) {
    l.warn('MiniMax music generation currently ignores --music-duration')
  }
  if (options.forceInstrumental) {
    l.warn('MiniMax music generation currently ignores --music-instrumental')
  }

  const startTime = Date.now()
  const lyrics = options.lyricsFile
    ? await readProvidedLyrics(options.lyricsFile)
    : await generateLyrics(baseURL, apiKey, prompt)
  const lyricsSource: Step7MusicMetadata['lyricsSource'] = options.lyricsFile ? 'provided' : 'generated'
  const promptForMusic = clampMinimaxMusicPrompt(prompt)

  if (promptForMusic.truncated) {
    l.warn(`MiniMax music prompt exceeded ${MINIMAX_MUSIC_PROMPT_MAX_CHARS} characters; truncating to fit provider limit`)
  }

  logMediaGenerationStatus(l, {
    mediaType: 'music',
    provider: 'minimax',
    model: options.model,
    status: 'started'
  })

  const payload = {
    model: options.model,
    prompt: promptForMusic.prompt,
    lyrics
  }
  const generated = await requestMusicGenerationWithIncompleteRetry(baseURL, apiKey, payload)
  const hexAudio = generated.data?.audio

  if (!hexAudio || hexAudio.trim().length === 0) {
    throw new Error(`MiniMax music generation completed without audio payload (${formatMusicResponseDetails(generated)})`)
  }

  const audioBytes = new Uint8Array(Buffer.from(hexAudio, 'hex'))
  if (audioBytes.byteLength === 0) {
    throw new Error('MiniMax music generation returned empty audio')
  }

  await Bun.write(musicPath, audioBytes)

  const processingTime = Date.now() - startTime
  const musicFile = Bun.file(musicPath)
  const musicDurationMs = generated.extra_info?.music_duration

  logMediaGenerationStatus(l, {
    mediaType: 'music',
    provider: 'minimax',
    model: options.model,
    status: 'completed',
    processingTimeMs: processingTime,
    outputCount: 1
  })
  logLocationsTable(l, [{ artifact: 'music', path: musicPath }], { level: 'success' })

  const metadata: Step7MusicMetadata = {
    musicService: 'minimax',
    musicModel: options.model,
    processingTime,
    musicFileName: 'generated-music.mp3',
    musicFileSize: musicFile.size,
    musicDurationMs,
    lyricsSource
  }

  return { musicPath, metadata }
}
