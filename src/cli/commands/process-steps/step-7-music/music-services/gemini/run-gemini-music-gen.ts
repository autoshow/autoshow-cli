import { GoogleGenAI } from '@google/genai'
import type { GeminiMusicModel, Step7MusicMetadata } from '~/types'
import { logMediaGenerationStatus } from '~/cli/commands/process-steps/generation-command-utils'
import { logLocationsTable } from '~/utils/logger/human-table'
import { readEnv } from '~/utils/validate/env-utils'
import * as l from '~/utils/logger'

const GEMINI_CLIP_DURATION_SECONDS = 30
const GEMINI_PRO_DEFAULT_DURATION_SECONDS = 120

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

const resolveIntendedDurationSeconds = (
  model: GeminiMusicModel,
  durationSeconds: number | undefined
): number => {
  if (durationSeconds !== undefined && (!Number.isFinite(durationSeconds) || durationSeconds <= 0)) {
    throw new Error(`Invalid music duration: ${durationSeconds}`)
  }

  if (model === 'lyria-3-clip-preview') {
    if (durationSeconds !== undefined && durationSeconds !== GEMINI_CLIP_DURATION_SECONDS) {
      l.warn(`Gemini Lyria 3 Clip always generates ${GEMINI_CLIP_DURATION_SECONDS}s clips; ignoring --music-duration ${durationSeconds}`)
    }
    return GEMINI_CLIP_DURATION_SECONDS
  }

  return durationSeconds ?? GEMINI_PRO_DEFAULT_DURATION_SECONDS
}

const buildGeminiMusicPrompt = async (
  prompt: string,
  options: {
    model: GeminiMusicModel
    durationSeconds?: number | undefined
    lyricsFile?: string | undefined
    forceInstrumental?: boolean | undefined
  }
): Promise<{ prompt: string, lyricsSource: Step7MusicMetadata['lyricsSource'], intendedDurationSeconds: number }> => {
  const parts = [prompt.trim()]
  const intendedDurationSeconds = resolveIntendedDurationSeconds(options.model, options.durationSeconds)

  if (options.model === 'lyria-3-pro-preview' && options.durationSeconds !== undefined) {
    parts.push(`Create a song that is about ${options.durationSeconds} seconds long.`)
  }

  if (options.forceInstrumental) {
    if (options.lyricsFile) {
      l.warn('Ignoring --music-lyrics-file because --music-instrumental was provided for Gemini music generation')
    }
    parts.push('Instrumental only, no vocals.')
    return {
      prompt: parts.join('\n\n'),
      lyricsSource: 'none',
      intendedDurationSeconds
    }
  }

  if (options.lyricsFile) {
    const lyrics = await readProvidedLyrics(options.lyricsFile)
    parts.push(`Lyrics:\n${lyrics}`)
    return {
      prompt: parts.join('\n\n'),
      lyricsSource: 'provided',
      intendedDurationSeconds
    }
  }

  return {
    prompt: parts.join('\n\n'),
    lyricsSource: 'generated',
    intendedDurationSeconds
  }
}

export const runGeminiMusicGen = async (
  prompt: string,
  outputDir: string,
  options: {
    model: GeminiMusicModel
    durationSeconds?: number | undefined
    lyricsFile?: string | undefined
    forceInstrumental?: boolean | undefined
  }
): Promise<{ musicPath: string, metadata: Step7MusicMetadata }> => {
  const apiKey = readEnv('GEMINI_API_KEY')
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY environment variable is required for Gemini music generation')
  }

  const { prompt: geminiPrompt, lyricsSource, intendedDurationSeconds } = await buildGeminiMusicPrompt(prompt, options)
  const ai = new GoogleGenAI({ apiKey })
  const musicPath = `${outputDir}/generated-music.mp3`

  logMediaGenerationStatus(l, {
    mediaType: 'music',
    provider: 'gemini',
    model: options.model,
    status: 'started'
  })

  const startTime = Date.now()
  const response = await ai.models.generateContent({
    model: options.model,
    contents: geminiPrompt
  })

  const parts = response.candidates?.flatMap((candidate) => candidate.content?.parts ?? []) ?? []
  for (const part of parts) {
    const audioData = part.inlineData?.data
    const mimeType = part.inlineData?.mimeType
    if (!audioData || part.thought === true) {
      continue
    }
    if (mimeType && !mimeType.startsWith('audio/')) {
      continue
    }

    const audioBytes = Buffer.from(audioData, 'base64')
    if (audioBytes.byteLength === 0) {
      continue
    }

    await Bun.write(musicPath, audioBytes)
    const processingTime = Date.now() - startTime
    const musicFile = Bun.file(musicPath)

    logMediaGenerationStatus(l, {
      mediaType: 'music',
      provider: 'gemini',
      model: options.model,
      status: 'completed',
      processingTimeMs: processingTime,
      outputCount: 1
    })
    logLocationsTable(l, [{ artifact: 'music', path: musicPath }], { level: 'success' })

    const metadata: Step7MusicMetadata = {
      musicService: 'gemini',
      musicModel: options.model,
      processingTime,
      musicFileName: 'generated-music.mp3',
      musicFileSize: musicFile.size,
      musicDurationMs: intendedDurationSeconds * 1000,
      lyricsSource
    }

    return { musicPath, metadata }
  }

  throw new Error('Gemini music generation completed without audio inline data')
}
