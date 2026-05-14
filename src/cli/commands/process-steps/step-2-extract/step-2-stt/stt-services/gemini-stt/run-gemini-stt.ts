import { basename, extname } from 'node:path'
import * as l from '~/utils/logger'
import type { Step2Metadata, TranscriptionResult, TranscriptionSegment } from '~/types'
import { classifyGeminiRetry } from '~/cli/commands/process-steps/step-3-write/write-services/gemini/gemini-utils'
import { withRetry } from '~/utils/retries'
import { readEnv } from '~/utils/validate/env-utils'
import {
  geminiDeleteFile,
  geminiFileDataPart,
  geminiGenerateContent,
  geminiGetFile,
  geminiUploadFile,
  geminiUserContent,
  getGeminiFileState,
  type GeminiContent
} from '~/utils/gemini/gemini-rest'
import {
  buildTranscriptionOutputBase,
  countTokens,
  formatTranscriptText,
  resolveTranscriptionOutput,
  toTimestamp
} from '../../stt-utils/stt-utils'
import { detectCompressedTimingCoverage } from '../../stt-utils/stt-timing-quality'

const GEMINI_INLINE_AUDIO_BYTES = 14 * 1024 * 1024
const GEMINI_FILE_UPLOAD_BYTES = 2 * 1024 * 1024 * 1024

const GEMINI_STT_JSON_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['text', 'segments'],
  properties: {
    text: { type: 'string' },
    segments: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['start', 'end', 'text'],
        properties: {
          start: { type: 'number' },
          end: { type: 'number' },
          text: { type: 'string' }
        }
      }
    }
  }
} as const

type GeminiSttPayload = {
  text?: unknown
  segments?: unknown
}

const buildSttPrompt = (audioDurationSeconds?: number | undefined): string => [
  'Transcribe the provided audio exactly.',
  'Return only JSON with this shape: {"text": string, "segments": [{"start": number, "end": number, "text": string}]}.',
  'Use seconds from the start of this audio for start and end.',
  ...(typeof audioDurationSeconds === 'number' && Number.isFinite(audioDurationSeconds)
    ? [`The audio duration is ${audioDurationSeconds.toFixed(3)} seconds; keep all segment times within that range.`]
    : []),
  'Do not summarize, translate, explain, or add speaker labels.'
].join(' ')

const getAudioMimeType = (filePath: string): string => {
  switch (extname(filePath).toLowerCase()) {
    case '.mp3':
      return 'audio/mpeg'
    case '.wav':
      return 'audio/wav'
    case '.m4a':
      return 'audio/mp4'
    case '.mp4':
      return 'video/mp4'
    case '.aac':
      return 'audio/aac'
    case '.flac':
      return 'audio/flac'
    case '.ogg':
    case '.oga':
      return 'audio/ogg'
    case '.webm':
      return 'audio/webm'
    default:
      return 'application/octet-stream'
  }
}

const buildInlineContents = async (
  filePath: string,
  mimeType: string,
  prompt: string
): Promise<GeminiContent> => {
  const bytes = await Bun.file(filePath).arrayBuffer()
  return geminiUserContent([
    { text: prompt },
    {
      inlineData: {
        mimeType,
        data: Buffer.from(bytes).toString('base64')
      }
    }
  ])
}

const waitForGeminiFile = async (
  apiKey: string,
  fileName: string
): Promise<void> => {
  const deadline = Date.now() + 120_000
  while (Date.now() < deadline) {
    const file = await geminiGetFile(apiKey, fileName)
    const state = getGeminiFileState(file)
    if (state === undefined || state === 'ACTIVE') {
      return
    }
    if (state === 'FAILED') {
      throw new Error(`Gemini Files API upload failed for ${fileName}`)
    }
    await Bun.sleep(1000)
  }
  throw new Error(`Gemini Files API upload did not become active for ${fileName}`)
}

const normalizeGeminiSegments = (
  value: unknown,
  offsetSeconds: number
): TranscriptionSegment[] => {
  if (!Array.isArray(value)) {
    return []
  }

  const segments: TranscriptionSegment[] = []
  for (const entry of value) {
    if (typeof entry !== 'object' || entry === null) {
      continue
    }
    const raw = entry as { start?: unknown, end?: unknown, text?: unknown }
    if (typeof raw.start !== 'number' || typeof raw.end !== 'number' || typeof raw.text !== 'string') {
      continue
    }
    const text = raw.text.trim()
    if (text.length === 0) {
      continue
    }
    segments.push({
      start: toTimestamp(raw.start + offsetSeconds),
      end: toTimestamp(raw.end + offsetSeconds),
      text
    })
  }
  return segments
}

const parseGeminiJson = (
  rawText: string,
  offsetSeconds: number
): { segments: TranscriptionSegment[], text: string } | undefined => {
  const trimmed = rawText.trim()
  const jsonText = trimmed.startsWith('```')
    ? trimmed.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim()
    : trimmed
  let payload: GeminiSttPayload
  try {
    payload = JSON.parse(jsonText) as GeminiSttPayload
  } catch {
    return undefined
  }
  const text = typeof payload.text === 'string' ? payload.text.trim() : ''
  const segments = normalizeGeminiSegments(payload.segments, offsetSeconds)
  if (text.length === 0 && segments.length === 0) {
    return undefined
  }
  return { segments, text }
}

export const runGeminiStt = async (
  audioPath: string,
  outputDir: string,
  options: {
    model: string
    segmentOffsetMinutes: number
    segmentNumber?: number | undefined
    totalSegments?: number | undefined
    audioDurationSeconds?: number | undefined
  }
): Promise<{ result: TranscriptionResult, metadata: Step2Metadata }> => {
  const { model, segmentOffsetMinutes = 0, segmentNumber, totalSegments, audioDurationSeconds } = options
  const apiKey = readEnv('GEMINI_API_KEY')
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY environment variable is required for Gemini transcription')
  }

  if (segmentNumber && totalSegments) {
    l.write('info', `Gemini STT segment ${segmentNumber}/${totalSegments} started (${model})`)
  }

  const startTime = Date.now()
  const offsetSeconds = segmentOffsetMinutes * 60
  const outputBase = buildTranscriptionOutputBase(outputDir, segmentNumber)
  const prompt = buildSttPrompt(audioDurationSeconds)
  const mimeType = getAudioMimeType(audioPath)
  const fileSizeBytes = Bun.file(audioPath).size
  if (fileSizeBytes > GEMINI_FILE_UPLOAD_BYTES) {
    throw new Error(`Gemini STT input exceeds the 2 GB file upload limit for ${basename(audioPath)}.`)
  }

  const response = await withRetry(
    {
      retryClass: 'runtime_http_create_conservative',
      operationName: 'gemini-stt',
      policy: { maxAttempts: 3 }
    },
    async () => {
      let uploadedFileName: string | undefined
      try {
        const contents = fileSizeBytes > GEMINI_INLINE_AUDIO_BYTES
          ? await (async () => {
              const uploadedFile = await geminiUploadFile(apiKey, audioPath, {
                mimeType,
                displayName: basename(audioPath)
              })
              uploadedFileName = uploadedFile.name ?? undefined
              if (uploadedFileName) {
                await waitForGeminiFile(apiKey, uploadedFileName)
              }
              const fileMimeType = uploadedFile.mimeType ?? mimeType
              if (typeof uploadedFile.uri !== 'string' || uploadedFile.uri.length === 0) {
                throw new Error('Gemini Files API upload did not return a file URI.')
              }
              return geminiUserContent([
                { text: prompt },
                geminiFileDataPart(uploadedFile.uri, fileMimeType)
              ])
            })()
          : await buildInlineContents(audioPath, mimeType, prompt)

        return await geminiGenerateContent(apiKey, {
          model,
          contents,
          generationConfig: {
            responseMimeType: 'application/json',
            responseJsonSchema: GEMINI_STT_JSON_SCHEMA
          }
        })
      } finally {
        if (uploadedFileName) {
          try {
            await geminiDeleteFile(apiKey, uploadedFileName)
          } catch (error) {
            l.warn(`Failed to delete Gemini STT upload ${uploadedFileName}: ${error instanceof Error ? error.message : String(error)}`)
          }
        }
      }
    },
    classifyGeminiRetry
  )

  const rawText = response.text?.trim() ?? ''
  const parsed = rawText.length > 0 ? parseGeminiJson(rawText, offsetSeconds) : undefined
  const knownEndSeconds = typeof audioDurationSeconds === 'number' && Number.isFinite(audioDurationSeconds)
    ? offsetSeconds + audioDurationSeconds
    : undefined
  const compressedTiming = parsed
    ? detectCompressedTimingCoverage(parsed.segments, {
        knownStartSeconds: offsetSeconds,
        knownEndSeconds
      })
    : undefined
  const timingIsCompressed = compressedTiming?.compressed === true
  const parsedText = parsed
    ? (parsed.text.length > 0 ? parsed.text : parsed.segments.map((segment) => segment.text).join(' ').trim())
    : ''
  const { finalSegments, finalText } = parsed && !timingIsCompressed
    ? resolveTranscriptionOutput(parsed.segments, parsed.text, offsetSeconds)
    : resolveTranscriptionOutput([], parsedText.length > 0 ? parsedText : rawText, offsetSeconds)

  await Bun.write(`${outputBase}.txt`, formatTranscriptText(finalSegments))

  const processingTime = Date.now() - startTime
  if (segmentNumber && totalSegments) {
    l.write('info', `Gemini STT segment ${segmentNumber}/${totalSegments} completed in ${processingTime}ms (${model})`)
  }

  const usage = response.usageMetadata
  return {
    result: {
      text: finalText,
      segments: finalSegments,
      evidence: {
        capabilities: {
          hasNativeWordTiming: false,
          hasConfidence: false,
          hasSpeakerLabels: false
        },
        timingQuality: parsed && parsed.segments.length > 0 && !timingIsCompressed ? 'segment_interpolated' : 'coarse',
        rawResponse: response
      }
    },
    metadata: {
      transcriptionService: 'gemini-stt',
      transcriptionModel: model,
      processingTime,
      tokenCount: countTokens(finalText),
      ...(typeof usage?.promptTokenCount === 'number' || typeof usage?.candidatesTokenCount === 'number'
        ? {
            timings: {
              requestCount: 1
            }
          }
        : {})
    }
  }
}
