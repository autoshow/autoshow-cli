import type {
  SupadataChunk,
  SupadataTranscriptPayload,
  TranscriptionResult,
  TranscriptionSegment
} from '~/types'
import {
  resolveTranscriptionOutput,
  toTimestamp
} from '~/cli/commands/process-steps/step-2-extract/step-2-stt/stt-utils/stt-utils'

const buildSegmentsFromChunks = (
  chunks: readonly SupadataChunk[],
  offsetSeconds: number
): TranscriptionSegment[] =>
  chunks.map((chunk) => ({
    start: toTimestamp((chunk.offset / 1_000) + offsetSeconds),
    end: toTimestamp(((chunk.offset + chunk.duration) / 1_000) + offsetSeconds),
    text: chunk.text
  }))

const buildEvidenceSegments = (
  chunks: readonly SupadataChunk[],
  offsetSeconds: number
): NonNullable<TranscriptionResult['evidence']>['segments'] =>
  chunks.map((chunk) => ({
    startSeconds: Math.max(0, offsetSeconds + (chunk.offset / 1_000)),
    endSeconds: Math.max(0, offsetSeconds + ((chunk.offset + chunk.duration) / 1_000)),
    text: chunk.text
  }))

export const normalizeSupadataTranscript = (
  payload: SupadataTranscriptPayload,
  offsetSeconds: number
): TranscriptionResult => {
  const chunks = Array.isArray(payload.content) ? payload.content : []
  const text = typeof payload.content === 'string'
    ? payload.content.trim()
    : chunks.map((chunk) => chunk.text.trim()).filter((chunkText) => chunkText.length > 0).join(' ').trim()
  const { finalSegments, finalText } = resolveTranscriptionOutput(
    buildSegmentsFromChunks(chunks, offsetSeconds),
    text,
    offsetSeconds
  )

  return {
    text: finalText,
    segments: finalSegments,
    evidence: {
      ...(chunks.length > 0 ? { segments: buildEvidenceSegments(chunks, offsetSeconds) } : {}),
      capabilities: {
        hasNativeWordTiming: false,
        hasConfidence: false,
        hasSpeakerLabels: false
      },
      timingQuality: 'coarse',
      rawResponse: payload
    }
  }
}
