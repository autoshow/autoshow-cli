import * as v from 'valibot'
import type { Step7MusicMetadata } from '~/types'
import * as l from '~/logger'
import type { MinimaxMusicModel } from '~/cli/commands/models/model-options'
import { readEnv } from '~/utils/validate/env-utils'
import { validateData } from '~/utils/validate/validation'
import { pollUntil } from '~/utils/retries'
import {
  MinimaxBaseRespSchema,
  ensureMinimaxBaseRespSuccess,
  parseMinimaxJsonResponse,
  isMinimaxTaskSuccess
} from '~/utils/minimax-utils'

const MINIMAX_DEFAULT_BASE_URL = 'https://api.minimax.io'
const POLL_INTERVAL_MS = 3_000
const POLL_TIMEOUT_MS = 10 * 60_000

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

const MinimaxMusicResponseSchema = v.object({
  data: v.optional(MinimaxMusicDataSchema, undefined),
  extra_info: v.optional(MinimaxMusicExtraInfoSchema, undefined),
  base_resp: v.optional(MinimaxBaseRespSchema, undefined)
})

const readMusicStatus = (
  payload: v.InferOutput<typeof MinimaxMusicResponseSchema>
): string | number | undefined => {
  return payload.data?.status
}

const isMusicInProgress = (status: string | number | undefined): boolean => {
  if (status === 1 || status === '1') return true
  if (typeof status === 'string') {
    const normalized = status.trim().toLowerCase()
    return normalized === 'pending' || normalized === 'processing' || normalized === 'in_progress'
  }
  return false
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
): Promise<v.InferOutput<typeof MinimaxMusicResponseSchema>> => {
  const response = await fetch(`${baseURL}/v1/music_generation`, {
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
    })
  })

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

const pollMusicGeneration = async (
  baseURL: string,
  apiKey: string,
  payload: {
    model: MinimaxMusicModel
    prompt: string
    lyrics: string
  }
): Promise<v.InferOutput<typeof MinimaxMusicResponseSchema>> => {
  return await pollUntil({
    operationName: 'minimax-music-gen',
    intervalMs: POLL_INTERVAL_MS,
    deadlineMs: POLL_TIMEOUT_MS,
    pollFn: async () => {
      const result = await requestMusicGeneration(baseURL, apiKey, payload)
      const status = readMusicStatus(result)
      l.info(`MiniMax music status: ${status ?? 'processing'}`)
      return result
    },
    isDone: (result) => {
      const status = readMusicStatus(result)
      if (isMinimaxTaskSuccess(status)) return true
      if (!isMusicInProgress(status) && result.data?.audio) return true
      return false
    },
    isFailed: (result) => {
      const status = readMusicStatus(result)
      if (!isMusicInProgress(status) && !isMinimaxTaskSuccess(status) && !result.data?.audio) {
        return { failed: true, reason: result.base_resp?.status_msg ?? 'Unknown error' }
      }
      return { failed: false }
    }
  })
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

  l.info(`MiniMax music model: ${options.model}`)

  const payload = {
    model: options.model,
    prompt,
    lyrics
  }
  const generated = await pollMusicGeneration(baseURL, apiKey, payload)
  const hexAudio = generated.data?.audio

  if (!hexAudio || hexAudio.trim().length === 0) {
    throw new Error('MiniMax music generation completed but no audio payload was returned')
  }

  const audioBytes = new Uint8Array(Buffer.from(hexAudio, 'hex'))
  if (audioBytes.byteLength === 0) {
    throw new Error('MiniMax music generation returned empty audio')
  }

  await Bun.write(musicPath, audioBytes)

  const processingTime = Date.now() - startTime
  const musicFile = Bun.file(musicPath)
  const musicDurationMs = generated.extra_info?.music_duration

  l.success(`Music saved to ${musicPath}`)

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
