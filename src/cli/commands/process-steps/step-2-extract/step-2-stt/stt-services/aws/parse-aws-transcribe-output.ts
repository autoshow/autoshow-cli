import * as v from 'valibot'
import type { TranscriptionResult } from '~/types'
import {
  buildSegmentsFromWords,
  resolveTranscriptionOutput
} from '~/cli/commands/process-steps/step-2-extract/step-2-stt/stt-utils/stt-utils'
import { validateData } from '~/utils/validate/validation'
import type { AwsTranscribeOutput } from '../../stt-types'

const AwsTranscriptAlternativeSchema = v.object({
  content: v.string(),
  confidence: v.optional(v.union([v.string(), v.number()]), undefined)
})

const AwsTranscriptItemSchema = v.object({
  start_time: v.optional(v.string(), undefined),
  end_time: v.optional(v.string(), undefined),
  alternatives: v.array(AwsTranscriptAlternativeSchema),
  type: v.picklist(['pronunciation', 'punctuation'])
})

const AwsSpeakerLabelItemSchema = v.object({
  start_time: v.string(),
  speaker_label: v.string()
})

const AwsSpeakerLabelSegmentSchema = v.object({
  start_time: v.string(),
  end_time: v.string(),
  speaker_label: v.string(),
  items: v.optional(v.array(AwsSpeakerLabelItemSchema), undefined)
})

const AwsSpeakerLabelsSchema = v.object({
  speakers: v.optional(v.number(), undefined),
  segments: v.array(AwsSpeakerLabelSegmentSchema)
})

export const AwsTranscribeOutputSchema = v.object({
  results: v.object({
    transcripts: v.array(v.object({
      transcript: v.string()
    })),
    items: v.array(AwsTranscriptItemSchema),
    speaker_labels: v.optional(AwsSpeakerLabelsSchema, undefined)
  })
})

const normalizeTimeKey = (value: string): string => {
  const parsed = Number.parseFloat(value)
  return Number.isFinite(parsed) ? parsed.toFixed(3) : value
}

const parseOptionalNumber = (value: string | number | undefined): number | undefined => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value
  }

  if (typeof value === 'string') {
    const parsed = Number.parseFloat(value)
    return Number.isFinite(parsed) ? parsed : undefined
  }

  return undefined
}

const buildSpeakerLookup = (
  payload: AwsTranscribeOutput
): Map<string, string> => {
  const speakers = new Map<string, string>()

  for (const segment of payload.results.speaker_labels?.segments ?? []) {
    const segmentSpeaker = segment.speaker_label
    for (const item of segment.items ?? []) {
      speakers.set(normalizeTimeKey(item.start_time), item.speaker_label)
    }
    speakers.set(normalizeTimeKey(segment.start_time), segmentSpeaker)
  }

  return speakers
}

export const parseAwsTranscribeOutput = (
  payload: unknown,
  options: {
    offsetSeconds?: number | undefined
  } = {}
): TranscriptionResult => {
  const parsed = validateData(AwsTranscribeOutputSchema, payload, 'AWS Transcribe transcript output')
  const offsetSeconds = options.offsetSeconds ?? 0
  const speakerLookup = buildSpeakerLookup(parsed)
  const words: NonNullable<TranscriptionResult['evidence']>['words'] = []

  for (const item of parsed.results.items) {
    const primaryAlternative = item.alternatives[0]
    if (!primaryAlternative) {
      continue
    }

    const content = primaryAlternative.content.trim()
    if (content.length === 0) {
      continue
    }

    if (item.type === 'punctuation') {
      const previousWord = words[words.length - 1]
      if (!previousWord) {
        continue
      }

      previousWord.text = `${previousWord.text}${content}`
      previousWord.normalized = previousWord.text.toLowerCase()
      continue
    }

    const startSeconds = parseOptionalNumber(item.start_time)
    const endSeconds = parseOptionalNumber(item.end_time)
    if (startSeconds === undefined || endSeconds === undefined) {
      continue
    }

    const speaker = item.start_time
      ? speakerLookup.get(normalizeTimeKey(item.start_time))
      : undefined
    const confidence = parseOptionalNumber(primaryAlternative.confidence)

    words.push({
      startSeconds: startSeconds + offsetSeconds,
      endSeconds: endSeconds + offsetSeconds,
      text: content,
      normalized: content.toLowerCase(),
      ...(speaker ? { speaker } : {}),
      ...(confidence !== undefined ? { confidence } : {}),
      timingSource: 'native'
    })
  }

  const transcriptText = parsed.results.transcripts[0]?.transcript.trim() ?? ''
  const segments = buildSegmentsFromWords(
    words.map((word) => ({
      start: word.startSeconds,
      end: word.endSeconds,
      text: word.text,
      ...(word.speaker ? { speaker: word.speaker } : {})
    })),
    0
  )
  const { finalSegments, finalText } = resolveTranscriptionOutput(segments, transcriptText, offsetSeconds)

  return {
    text: finalText,
    segments: finalSegments,
    evidence: {
      ...(words.length > 0 ? { words } : {}),
      capabilities: {
        hasNativeWordTiming: words.length > 0,
        hasConfidence: words.some((word) => typeof word.confidence === 'number'),
        hasSpeakerLabels: words.some((word) => word.speaker !== undefined) || finalSegments.some((segment) => segment.speaker !== undefined)
      },
      timingQuality: words.length > 0 ? 'native_word' : 'coarse',
      rawResponse: parsed
    }
  }
}
