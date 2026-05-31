import * as l from '~/utils/logger'
import type {
  Step2Metadata,
  TranscriptionEvidenceWord,
  TranscriptionResult,
  TranscriptionSegment
} from '~/types'
import { logSttSegmentLifecycle } from '../stt-logging'
import { buildTranscriptionWordEvidence } from '../stt-utils/stt-evidence'
import {
  buildTranscriptionOutputBase,
  countTokens,
  formatTranscriptText,
  resolveTranscriptionOutput
} from '../stt-utils/stt-utils'

type HostedSttFinalizeOptions = {
  provider: Step2Metadata['transcriptionService']
  model: string
  outputDir: string
  segmentNumber?: number | undefined
  totalSegments?: number | undefined
  offsetSeconds: number
  startTime: number
  transcribeMs: number
  requestCount: number
  retryCount: number
  rateLimitCount: number
  text: string
  segments: TranscriptionSegment[]
  evidenceWords: TranscriptionEvidenceWord[]
  rawResponse: unknown
}

const buildTimingMetadata = (
  processingTime: number,
  options: Pick<HostedSttFinalizeOptions, 'transcribeMs' | 'requestCount' | 'retryCount' | 'rateLimitCount'>
): Step2Metadata['timings'] | undefined => {
  const remoteProcessingMs = Math.max(0, processingTime - options.transcribeMs)
  if (
    options.transcribeMs === 0
    && options.requestCount === 0
    && options.retryCount === 0
    && options.rateLimitCount === 0
    && remoteProcessingMs === 0
  ) {
    return undefined
  }

  return {
    ...(options.transcribeMs > 0 ? { transcribeMs: options.transcribeMs } : {}),
    ...(remoteProcessingMs > 0 ? { remoteProcessingMs } : {}),
    ...(options.requestCount > 0 ? { requestCount: options.requestCount } : {}),
    ...(options.retryCount > 0 ? { retryCount: options.retryCount } : {}),
    ...(options.rateLimitCount > 0 ? { rateLimitCount: options.rateLimitCount } : {})
  }
}

export const finalizeHostedSttResult = async (
  options: HostedSttFinalizeOptions
): Promise<{ result: TranscriptionResult, metadata: Step2Metadata }> => {
  const { finalSegments, finalText } = resolveTranscriptionOutput(
    options.segments,
    options.text,
    options.offsetSeconds
  )
  const outputBase = buildTranscriptionOutputBase(options.outputDir, options.segmentNumber)
  await Bun.write(`${outputBase}.txt`, formatTranscriptText(finalSegments))

  const processingTime = Date.now() - options.startTime
  const timings = buildTimingMetadata(processingTime, options)
  const metadata: Step2Metadata = {
    transcriptionService: options.provider,
    transcriptionModel: options.model,
    processingTime,
    tokenCount: countTokens(finalText),
    ...(timings ? { timings } : {})
  }

  if (options.segmentNumber && options.totalSegments) {
    logSttSegmentLifecycle(l, {
      provider: options.provider,
      action: 'completed',
      segmentNumber: options.segmentNumber,
      totalSegments: options.totalSegments,
      model: options.model,
      processingTimeMs: processingTime
    })
  }

  return {
    result: {
      text: finalText,
      segments: finalSegments,
      evidence: buildTranscriptionWordEvidence({
        words: options.evidenceWords,
        segments: finalSegments,
        rawResponse: options.rawResponse
      })
    },
    metadata
  }
}
