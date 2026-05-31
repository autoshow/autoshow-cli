import type { TtsProvider } from '~/types'
import { normalizeTtsChunkConcurrency, splitTextIntoChunks } from './audio-utils'

export const TTS_CHUNK_CHARACTER_LIMITS = {
  kitten: undefined,
  elevenlabs: undefined,
  groq: 200,
  deepgram: 2000,
  speechify: 2000,
  openai: 4000,
  mistral: 4000,
  gemini: 4000,
  cartesia: 5000,
  hume: 5000,
  grok: 5000,
  minimax: 5000,
} as const satisfies Record<TtsProvider, number | undefined>

const resolveSyntheticChunkLengths = (
  characterCount: number,
  maxChars: number
): number[] => {
  const normalizedCharacterCount = Math.max(0, Math.floor(characterCount))
  const normalizedMaxChars = Math.max(1, Math.floor(maxChars))
  const chunks: number[] = []
  let remaining = normalizedCharacterCount

  while (remaining > normalizedMaxChars) {
    chunks.push(normalizedMaxChars)
    remaining -= normalizedMaxChars
  }

  if (remaining > 0) {
    chunks.push(remaining)
  }

  return chunks
}

const resolveTtsChunkLengths = (
  input: {
    text?: string | undefined
    characterCount: number
    maxChars: number
  }
): number[] => {
  if (typeof input.text === 'string') {
    return splitTextIntoChunks(input.text, input.maxChars).map((chunk) => chunk.length)
  }

  return resolveSyntheticChunkLengths(input.characterCount, input.maxChars)
}

const estimateWorkerPoolWallTimeMs = (
  chunkDurationsMs: readonly number[],
  concurrency: number | undefined
): number => {
  if (chunkDurationsMs.length === 0) {
    return 0
  }

  const workerCount = Math.min(
    normalizeTtsChunkConcurrency(concurrency),
    chunkDurationsMs.length
  )
  const workerTimes = Array.from({ length: workerCount }, () => 0)

  for (const duration of chunkDurationsMs) {
    let nextWorkerIndex = 0
    for (let i = 1; i < workerTimes.length; i += 1) {
      if ((workerTimes[i] ?? 0) < (workerTimes[nextWorkerIndex] ?? 0)) {
        nextWorkerIndex = i
      }
    }
    workerTimes[nextWorkerIndex] = (workerTimes[nextWorkerIndex] ?? 0) + duration
  }

  return Math.max(...workerTimes)
}

export const estimateTtsSynthesisProcessingTimeMs = (
  input: {
    provider: TtsProvider
    text?: string | undefined
    characterCount: number
    msPer1KChars: number
    setupTimeMs?: number | undefined
    chunkConcurrency?: number | undefined
  }
): number => {
  const setupTimeMs = typeof input.setupTimeMs === 'number' && Number.isFinite(input.setupTimeMs)
    ? Math.max(0, input.setupTimeMs)
    : 0
  const normalizedCharacterCount = Math.max(0, Math.floor(input.characterCount))
  const chunkLimit = TTS_CHUNK_CHARACTER_LIMITS[input.provider]

  if (chunkLimit === undefined) {
    return setupTimeMs + (normalizedCharacterCount / 1000) * input.msPer1KChars
  }

  const chunkLengths = resolveTtsChunkLengths({
    text: input.text,
    characterCount: normalizedCharacterCount,
    maxChars: chunkLimit,
  })
  const chunkDurationsMs = chunkLengths.map((length) =>
    (length / 1000) * input.msPer1KChars
  )

  return setupTimeMs + estimateWorkerPoolWallTimeMs(
    chunkDurationsMs,
    input.chunkConcurrency
  )
}
