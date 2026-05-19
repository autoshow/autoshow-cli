import * as v from 'valibot'
import type { MinimaxMusicModel, MinimaxMusicResponse, Step7MusicMetadata } from '~/types'
import { isMinimaxInstrumentalMusicModel } from '~/cli/commands/setup-and-utilities/models/model-options'
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
const MINIMAX_MUSIC_LYRICS_MAX_CHARS = 3500
const MINIMAX_MUSIC_OUTPUT_FORMAT = 'hex'
const MINIMAX_MUSIC_AUDIO_SETTING = {
  sample_rate: 44100,
  bitrate: 256000,
  format: 'mp3'
} as const
const MINIMAX_MUSIC_AUDIO_MIME_TYPE = 'audio/mpeg'

type MinimaxLyricsGenerationResult = {
  lyrics: string
  songTitle?: string | undefined
  styleTags?: string | undefined
}

type MinimaxMusicGenerationPayload = {
  model: MinimaxMusicModel
  prompt: string
} & (
  | { lyrics: string, isInstrumental?: false | undefined }
  | { lyrics?: undefined, isInstrumental: true }
)

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
  music_duration: v.optional(v.number(), undefined),
  music_sample_rate: v.optional(v.number(), undefined),
  music_channel: v.optional(v.number(), undefined),
  bitrate: v.optional(v.number(), undefined),
  music_size: v.optional(v.number(), undefined)
})

export const MinimaxMusicResponseSchema = v.object({
  data: v.optional(v.nullable(MinimaxMusicDataSchema), undefined),
  extra_info: v.optional(v.nullable(MinimaxMusicExtraInfoSchema), undefined),
  trace_id: v.optional(v.string(), undefined),
  base_resp: v.optional(MinimaxBaseRespSchema, undefined)
})

const normalizeMinimaxMusicPrompt = (
  prompt: string
): string => {
  const trimmed = prompt.trim()
  if (trimmed.length === 0) {
    throw new Error('MiniMax music prompt must not be empty')
  }
  if (trimmed.length > MINIMAX_MUSIC_PROMPT_MAX_CHARS) {
    l.warn(`MiniMax music prompt is ${trimmed.length} characters; truncating to ${MINIMAX_MUSIC_PROMPT_MAX_CHARS} characters`)
    return trimmed.slice(0, MINIMAX_MUSIC_PROMPT_MAX_CHARS).trimEnd()
  }
  return trimmed
}

const validateMinimaxMusicLyrics = (
  lyrics: string,
  source: string
): string => {
  const trimmed = lyrics.trim()
  if (trimmed.length === 0) {
    throw new Error(`${source} must not be empty`)
  }
  if (trimmed.length > MINIMAX_MUSIC_LYRICS_MAX_CHARS) {
    throw new Error(`${source} must be ${MINIMAX_MUSIC_LYRICS_MAX_CHARS} characters or fewer. Received ${trimmed.length} characters.`)
  }
  return trimmed
}

const readProvidedLyrics = async (lyricsFile: string): Promise<string> => {
  const file = Bun.file(lyricsFile)
  if (!await file.exists()) {
    throw new Error(`Music lyrics file not found: ${lyricsFile}`)
  }

  return validateMinimaxMusicLyrics(await file.text(), `MiniMax music lyrics file ${lyricsFile}`)
}

const generateLyrics = async (
  baseURL: string,
  apiKey: string,
  prompt: string
): Promise<MinimaxLyricsGenerationResult> => {
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

  return {
    lyrics: validateMinimaxMusicLyrics(parsed.lyrics ?? '', 'MiniMax generated lyrics'),
    ...(parsed.song_title?.trim() ? { songTitle: parsed.song_title.trim() } : {}),
    ...(parsed.style_tags?.trim() ? { styleTags: parsed.style_tags.trim() } : {})
  }
}

const requestMusicGeneration = async (
  baseURL: string,
  apiKey: string,
  payload: MinimaxMusicGenerationPayload
): Promise<MinimaxMusicResponse> => {
  const body = {
    model: payload.model,
    prompt: payload.prompt,
    ...(payload.isInstrumental ? { is_instrumental: true } : { lyrics: payload.lyrics }),
    output_format: MINIMAX_MUSIC_OUTPUT_FORMAT,
    audio_setting: MINIMAX_MUSIC_AUDIO_SETTING
  }

  let response: Response
  try {
    response = await fetch(`${baseURL}/v1/music_generation`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body),
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
  payload: MinimaxMusicGenerationPayload
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
  const supportsInstrumental = isMinimaxInstrumentalMusicModel(options.model)
  const useInstrumental = options.forceInstrumental === true && supportsInstrumental
  if (options.forceInstrumental && !supportsInstrumental) {
    l.warn(`MiniMax music model ${options.model} does not support --music-instrumental; generating with lyrics`)
  }
  if (useInstrumental && options.lyricsFile) {
    l.warn('Ignoring --music-lyrics-file because --music-instrumental was provided for MiniMax music generation')
  }

  const startTime = Date.now()
  const promptForMusic = normalizeMinimaxMusicPrompt(prompt)
  const generatedLyrics = useInstrumental || options.lyricsFile
    ? undefined
    : await generateLyrics(baseURL, apiKey, promptForMusic)
  const lyrics = useInstrumental
    ? undefined
    : options.lyricsFile
      ? await readProvidedLyrics(options.lyricsFile)
      : generatedLyrics?.lyrics
  const lyricsSource: Step7MusicMetadata['lyricsSource'] = useInstrumental
    ? 'none'
    : options.lyricsFile ? 'provided' : 'generated'

  logMediaGenerationStatus(l, {
    mediaType: 'music',
    provider: 'minimax',
    model: options.model,
    status: 'started'
  })

  let payload: MinimaxMusicGenerationPayload
  if (useInstrumental) {
    payload = {
      model: options.model,
      prompt: promptForMusic,
      isInstrumental: true
    }
  } else {
    if (lyrics === undefined) {
      throw new Error('MiniMax music lyrics were not resolved')
    }
    payload = {
      model: options.model,
      prompt: promptForMusic,
      lyrics
    }
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
    lyricsSource,
    audioMimeType: MINIMAX_MUSIC_AUDIO_MIME_TYPE,
    audioSampleRate: generated.extra_info?.music_sample_rate ?? MINIMAX_MUSIC_AUDIO_SETTING.sample_rate,
    audioChannelCount: generated.extra_info?.music_channel,
    audioBitrate: generated.extra_info?.bitrate ?? MINIMAX_MUSIC_AUDIO_SETTING.bitrate,
    providerAudioByteSize: generated.extra_info?.music_size,
    outputFormat: MINIMAX_MUSIC_AUDIO_SETTING.format,
    providerTraceId: generated.trace_id,
    ...(generatedLyrics?.lyrics ? { generatedLyrics: generatedLyrics.lyrics } : {}),
    ...(generatedLyrics?.songTitle ? { generatedSongTitle: generatedLyrics.songTitle } : {}),
    ...(generatedLyrics?.styleTags ? { generatedStyleTags: generatedLyrics.styleTags } : {})
  }

  return { musicPath, metadata }
}
