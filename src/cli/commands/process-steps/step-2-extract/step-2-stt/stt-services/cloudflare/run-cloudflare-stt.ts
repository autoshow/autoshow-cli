import { Buffer } from 'node:buffer'
import type {
  Step2Metadata,
  TranscriptionEvidenceSegment,
  TranscriptionEvidenceWord,
  TranscriptionResult,
  TranscriptionSegment
} from '~/types'
import { readEnv } from '~/utils/validate/env-utils'
import {
  buildSegmentsFromWords,
  buildTranscriptionOutputBase,
  countTokens,
  formatTranscriptText,
  resolveTranscriptionOutput,
  toTimestamp
} from '../../stt-utils/stt-utils'
import { logSttSegmentLifecycle } from '../../stt-logging'
import * as l from '~/utils/logger'

type CloudflareApiResponse = {
  success?: unknown
  errors?: unknown
  messages?: unknown
  result?: unknown
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const toErrorText = (value: unknown): string => {
  if (Array.isArray(value)) {
    return value.map(toErrorText).filter(Boolean).join('; ')
  }
  if (isRecord(value)) {
    const message = typeof value['message'] === 'string' ? value['message'] : JSON.stringify(value)
    const code = typeof value['code'] === 'number' || typeof value['code'] === 'string' ? ` ${value['code']}` : ''
    return `${code}${code ? ': ' : ''}${message}`
  }
  return typeof value === 'string' ? value : ''
}

const toNumber = (value: unknown): number | undefined => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value
  }
  if (typeof value === 'string') {
    const parsed = Number.parseFloat(value)
    return Number.isFinite(parsed) ? parsed : undefined
  }
  return undefined
}

const toText = (value: unknown): string | undefined => {
  if (typeof value !== 'string') {
    return undefined
  }
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : undefined
}

const parseCloudflareWords = (
  raw: unknown,
  offsetSeconds: number
): TranscriptionEvidenceWord[] => {
  if (!Array.isArray(raw)) {
    return []
  }

  const words: TranscriptionEvidenceWord[] = []
  for (const value of raw) {
    if (!isRecord(value)) {
      continue
    }

    const text = toText(value['word'] ?? value['text'])
    const start = toNumber(value['start'])
    const end = toNumber(value['end'])
    if (!text || start === undefined || end === undefined) {
      continue
    }

    words.push({
      startSeconds: start + offsetSeconds,
      endSeconds: end + offsetSeconds,
      text,
      normalized: text.toLowerCase(),
      timingSource: 'native'
    })
  }

  return words
}

const parseCloudflareSegments = (
  raw: unknown,
  offsetSeconds: number
): {
  transcriptSegments: TranscriptionSegment[]
  evidenceSegments: TranscriptionEvidenceSegment[]
  words: TranscriptionEvidenceWord[]
} => {
  if (!Array.isArray(raw)) {
    return { transcriptSegments: [], evidenceSegments: [], words: [] }
  }

  const transcriptSegments: TranscriptionSegment[] = []
  const evidenceSegments: TranscriptionEvidenceSegment[] = []
  const words: TranscriptionEvidenceWord[] = []

  for (const value of raw) {
    if (!isRecord(value)) {
      continue
    }

    const text = toText(value['text'])
    const start = toNumber(value['start'])
    const end = toNumber(value['end'])
    if (!text || start === undefined || end === undefined) {
      continue
    }

    transcriptSegments.push({
      start: toTimestamp(start + offsetSeconds),
      end: toTimestamp(end + offsetSeconds),
      text
    })
    evidenceSegments.push({
      startSeconds: start + offsetSeconds,
      endSeconds: end + offsetSeconds,
      text
    })
    words.push(...parseCloudflareWords(value['words'], offsetSeconds))
  }

  return { transcriptSegments, evidenceSegments, words }
}

const readResponsePayload = async (response: Response): Promise<CloudflareApiResponse> => {
  const raw = await response.text()
  try {
    return JSON.parse(raw) as CloudflareApiResponse
  } catch {
    return { success: false, errors: [{ message: raw }] }
  }
}

const createRequestBody = async (audioPath: string, model: string): Promise<string | Uint8Array> => {
  const bytes = new Uint8Array(await Bun.file(audioPath).arrayBuffer())
  if (model === 'whisper') {
    return bytes
  }

  const audio = Buffer.from(bytes).toString('base64')
  return JSON.stringify({ audio })
}

const createRequestHeaders = (
  apiToken: string,
  model: string
): Record<string, string> => ({
  Authorization: `Bearer ${apiToken}`,
  ...(model === 'whisper'
    ? { 'content-type': 'application/octet-stream' }
    : { 'content-type': 'application/json' })
})

const normalizeCloudflareModel = (model: string): string =>
  model.startsWith('@cf/')
    ? model
    : `@cf/openai/${model}`

export const runCloudflareStt = async (
  audioPath: string,
  outputDir: string,
  options: {
    model: string
    segmentOffsetMinutes: number
    segmentNumber?: number | undefined
    totalSegments?: number | undefined
  }
): Promise<{ result: TranscriptionResult, metadata: Step2Metadata }> => {
  const { model, segmentOffsetMinutes = 0, segmentNumber, totalSegments } = options
  const apiToken = readEnv('CLOUDFLARE_API_TOKEN')
  const accountId = readEnv('CLOUDFLARE_ACCOUNT_ID')
  if (!apiToken || !accountId) {
    throw new Error('CLOUDFLARE_API_TOKEN and CLOUDFLARE_ACCOUNT_ID are required for Cloudflare transcription')
  }

  if (segmentNumber && totalSegments) {
    logSttSegmentLifecycle(l, { provider: 'Cloudflare', action: 'started', segmentNumber, totalSegments, model })
  }

  const startTime = Date.now()
  const offsetSeconds = segmentOffsetMinutes * 60
  const outputBase = buildTranscriptionOutputBase(outputDir, segmentNumber)
  const cloudflareModel = normalizeCloudflareModel(model)
  const response = await fetch(`https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/${cloudflareModel}`, {
    method: 'POST',
    headers: createRequestHeaders(apiToken, model),
    body: await createRequestBody(audioPath, model)
  })
  const payload = await readResponsePayload(response)

  if (!response.ok || payload.success === false) {
    const errorText = toErrorText(payload.errors) || response.statusText
    throw new Error(`Cloudflare transcription failed (${response.status}): ${errorText}`)
  }

  const result = isRecord(payload.result) ? payload.result : {}
  const parsedSegments = parseCloudflareSegments(result['segments'], offsetSeconds)
  const topLevelWords = parseCloudflareWords(result['words'], offsetSeconds)
  const words = parsedSegments.words.length > 0 ? parsedSegments.words : topLevelWords
  const transcriptSegments = parsedSegments.transcriptSegments.length > 0
    ? parsedSegments.transcriptSegments
    : words.length > 0
      ? buildSegmentsFromWords(words.map((word) => ({
          start: word.startSeconds - offsetSeconds,
          end: word.endSeconds - offsetSeconds,
          text: word.text
        })), offsetSeconds)
      : []
  const text = toText(result['text'])
    ?? transcriptSegments.map((segment) => segment.text).join(' ').trim()
  const { finalSegments, finalText } = resolveTranscriptionOutput(transcriptSegments, text, offsetSeconds)

  await Bun.write(`${outputBase}.txt`, formatTranscriptText(finalSegments))

  const processingTime = Date.now() - startTime
  const metadata: Step2Metadata = {
    transcriptionService: 'cloudflare',
    transcriptionModel: model,
    processingTime,
    tokenCount: countTokens(finalText)
  }

  if (segmentNumber && totalSegments) {
    logSttSegmentLifecycle(l, { provider: 'Cloudflare', action: 'completed', segmentNumber, totalSegments, model, processingTimeMs: processingTime })
  }

  return {
    result: {
      text: finalText,
      segments: finalSegments,
      evidence: {
        ...(parsedSegments.evidenceSegments.length > 0 ? { segments: parsedSegments.evidenceSegments } : {}),
        ...(words.length > 0 ? { words } : {}),
        capabilities: {
          hasNativeWordTiming: words.length > 0,
          hasConfidence: false,
          hasSpeakerLabels: false
        },
        timingQuality: words.length > 0 ? 'native_word' : parsedSegments.evidenceSegments.length > 0 ? 'segment_interpolated' : 'coarse',
        rawResponse: payload
      }
    },
    metadata
  }
}
