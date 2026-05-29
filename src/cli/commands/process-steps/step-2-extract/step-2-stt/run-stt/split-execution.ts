import * as l from '~/utils/logger'
import type {
  IndexedTranscriptionChunk,
  Step2Metadata,
  SttTarget,
  SttTargetOptions,
  TranscriptionResult
} from '~/types'
import type { SplitPolicyTarget } from '~/types'
import { mkdir } from 'node:fs/promises'
import { mergeStep2TimingMetadata } from '../stt-timing-metadata'
import { splitAudioFile } from '../stt-utils/audio-splitter'
import { formatTranscriptText } from '../stt-utils/stt-utils'
import { mergeTranscriptionEvidence } from '../stt-utils/stt-evidence'
import { writeSttResultArtifact } from '../stt-utils/stt-result-artifacts'
import {
  DEFAULT_SPLIT_SEGMENT_DURATION_MINUTES,
  resolveEffectiveSplitSegmentDurationMinutes,
  resolveSttSplitPolicy,
  resolveTranscriptionSplitDecision
} from '../stt-split-policy'
import { logSttSplitDecision } from '../stt-logging'
import { dispatchStt } from './dispatch'
import {
  classifySttSplitLimitError,
  resolveAdaptiveSplitSegmentDurationMinutes,
  type SplitLimitClassification
} from './split-limits'

const MAX_ADAPTIVE_SPLIT_PASSES = 4

const persistTranscriptionStructuredArtifact = async (
  outputDir: string,
  result: TranscriptionResult,
  metadata: Step2Metadata
): Promise<void> => {
  await writeSttResultArtifact(outputDir, metadata, result)
}

const resolveEffectiveSegmentConcurrency = (
  target: Pick<SttTarget, 'local' | 'service'>,
  requestedConcurrency: number | undefined
): number => {
  if (target.local || target.service === 'mistral') {
    return 1
  }

  return Math.max(1, requestedConcurrency ?? 2)
}

const mergeSplitTranscriptionChunks = (
  chunks: IndexedTranscriptionChunk[]
): { result: TranscriptionResult, metadata: Step2Metadata } => {
  const orderedChunks = [...chunks].sort((left, right) => left.segmentIndex - right.segmentIndex)
  const segmentResults = orderedChunks.map((entry) => entry.data)

  const combinedResult = {
    text: segmentResults.map(s => s.result.text).join(' '),
    segments: segmentResults.flatMap(s => s.result.segments),
    evidence: mergeTranscriptionEvidence(segmentResults.map((segment) => segment.result.evidence))
  }

  const totalProcessingTime = segmentResults.reduce((sum, s) => sum + s.metadata.processingTime, 0)
  const totalTokenCount = segmentResults.reduce((sum, s) => sum + s.metadata.tokenCount, 0)
  const mergedTimings = mergeStep2TimingMetadata(segmentResults.map((segment) => segment.metadata.timings))
  const canMergeBilling = segmentResults.every((segment) => typeof segment.metadata.billing?.totalCost === 'number')
  const mergedBilling = canMergeBilling
    ? (() => {
        const totalCost = segmentResults.reduce((sum, segment) => sum + (segment.metadata.billing?.totalCost ?? 0), 0)
        const totalCredits = segmentResults.every((segment) => typeof segment.metadata.billing?.creditsUsed === 'number')
          ? segmentResults.reduce((sum, segment) => sum + (segment.metadata.billing?.creditsUsed ?? 0), 0)
          : undefined
        const explicitCreditRates = segmentResults
          .map((segment) => segment.metadata.billing?.creditRateCents)
          .filter((value): value is number => typeof value === 'number' && Number.isFinite(value))
        const sharedCreditRate = explicitCreditRates.length === segmentResults.length
          && explicitCreditRates.every((value) => Math.abs(value - explicitCreditRates[0]!) < 1e-9)
          ? explicitCreditRates[0]
          : undefined

        return {
          totalCost,
          ...(typeof totalCredits === 'number' ? { creditsUsed: totalCredits } : {}),
          ...(typeof sharedCreditRate === 'number'
            ? { creditRateCents: sharedCreditRate }
            : typeof totalCredits === 'number' && totalCredits > 0
              ? { creditRateCents: totalCost / totalCredits }
              : {}),
          source: segmentResults.every((segment) => segment.metadata.billing?.source === 'provider_quote')
            ? 'provider_quote' as const
            : 'registry_fallback' as const,
          mode: 'segment_sum' as const
        }
      })()
    : undefined

  return {
    result: combinedResult,
    metadata: {
      transcriptionService: segmentResults[0]!.metadata.transcriptionService,
      transcriptionModel: segmentResults[0]!.metadata.transcriptionModel,
      processingTime: totalProcessingTime,
      tokenCount: totalTokenCount,
      ...(mergedTimings ? { timings: mergedTimings } : {}),
      ...(mergedBilling ? { billing: mergedBilling } : {})
    }
  }
}

const runSplitTranscription = async (
  target: SttTarget,
  audioPath: string,
  outputDir: string,
  options: SttTargetOptions,
  splitSegmentDurationMinutes?: number,
  workingOutputDir?: string
): Promise<{ result: TranscriptionResult, metadata: Step2Metadata }> => {
  const segmentOutputDir = workingOutputDir ?? outputDir
  if (workingOutputDir !== undefined) {
    await mkdir(workingOutputDir, { recursive: true })
  }

  const effectiveSegmentDurationMinutes = splitSegmentDurationMinutes
    ?? resolveEffectiveSplitSegmentDurationMinutes(resolveSttSplitPolicy(target), DEFAULT_SPLIT_SEGMENT_DURATION_MINUTES, {
      audioFileSizeBytes: Bun.file(audioPath).size,
      audioDurationSeconds: options.audioDurationSeconds
    })
  const segmentDescriptors = await splitAudioFile(audioPath, segmentOutputDir, effectiveSegmentDurationMinutes)
  const totalDurationSeconds = segmentDescriptors.reduce((sum, segment) => sum + segment.durationSeconds, 0)
  const segmentConcurrency = resolveEffectiveSegmentConcurrency(target, options.sttSegmentConcurrency)
  const results: IndexedTranscriptionChunk[] = []
  let nextIndex = 0
  let failure: unknown

  const runWorker = async (): Promise<void> => {
    while (failure === undefined) {
      const currentIndex = nextIndex
      nextIndex += 1
      if (currentIndex >= segmentDescriptors.length) {
        return
      }

      const segmentDescriptor = segmentDescriptors[currentIndex]!
      const offsetMinutes = segmentDescriptor.startSeconds / 60

      try {
        const data = await dispatchStt(
          target,
          segmentDescriptor.path,
          segmentOutputDir,
          offsetMinutes,
          {
            ...options,
            audioDurationSeconds: segmentDescriptor.durationSeconds
          },
          segmentDescriptor.segmentNumber,
          segmentDescriptor.totalSegments,
          {
            segmentStartSeconds: segmentDescriptor.startSeconds,
            segmentDurationSeconds: segmentDescriptor.durationSeconds,
            totalDurationSeconds
          }
        )
        results.push({ segmentIndex: currentIndex, data })
      } catch (error) {
        failure = error
        return
      }
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(segmentConcurrency, segmentDescriptors.length) }, async () => {
      await runWorker()
    })
  )

  if (failure !== undefined) {
    throw failure
  }

  const combined = mergeSplitTranscriptionChunks(results)
  await Bun.write(`${outputDir}/transcription.txt`, formatTranscriptText(combined.result.segments))
  await persistTranscriptionStructuredArtifact(outputDir, combined.result, combined.metadata)
  return combined
}

const buildSplitRetryDecision = (
  target: SplitPolicyTarget,
  classification: SplitLimitClassification,
  segmentDurationMinutes: number,
  audioFileSizeBytes: number,
  audioDurationSeconds: number | undefined
): Pick<ReturnType<typeof resolveTranscriptionSplitDecision>, 'reasons' | 'segmentDurationMinutes'> => {
  const policy = resolveSttSplitPolicy(target)
  const reasons = classification.reason === 'attachment_cap' && policy.attachmentCapBytes !== undefined
    ? [{
        kind: 'attachment_cap' as const,
        attachmentCapBytes: policy.attachmentCapBytes,
        audioFileSizeBytes
      }]
    : classification.reason === 'duration_cap' && classification.durationCapSeconds !== undefined && audioDurationSeconds !== undefined
      ? [{
          kind: 'duration_cap' as const,
          maxDurationSeconds: classification.durationCapSeconds,
          audioDurationSeconds
        }]
      : classification.reason === 'request_budget' && policy.requestBudgetSeconds !== undefined && audioDurationSeconds !== undefined
        ? [{
            kind: 'request_budget' as const,
            requestBudgetSeconds: policy.requestBudgetSeconds,
            audioDurationSeconds
          }]
        : []

  return {
    reasons,
    segmentDurationMinutes
  }
}

const logAdaptiveSplitRetryDecision = (
  target: SplitPolicyTarget,
  audioPath: string,
  classification: SplitLimitClassification,
  segmentDurationMinutes: number,
  audioFileSizeBytes: number,
  audioDurationSeconds: number | undefined
): void => {
  logSttSplitDecision(l, target, buildSplitRetryDecision(
    target,
    classification,
    segmentDurationMinutes,
    audioFileSizeBytes,
    audioDurationSeconds
  ), {
    trigger: 'retry',
    retryReason: classification.reason,
    audioPath,
    audioFileSizeBytes,
    audioDurationSeconds
  })
}

export const runAdaptiveSplitTranscription = async (
  target: SttTarget,
  audioPath: string,
  outputDir: string,
  options: SttTargetOptions,
  initialSegmentDurationMinutes: number,
  audioFileSizeBytes: number,
  initialRetryClassification?: SplitLimitClassification | undefined
): Promise<{ result: TranscriptionResult, metadata: Step2Metadata }> => {
  let segmentDurationMinutes = initialSegmentDurationMinutes
  if (initialRetryClassification !== undefined) {
    logAdaptiveSplitRetryDecision(
      target,
      audioPath,
      initialRetryClassification,
      segmentDurationMinutes,
      audioFileSizeBytes,
      options.audioDurationSeconds
    )
  }

  for (let pass = 1; pass <= MAX_ADAPTIVE_SPLIT_PASSES; pass += 1) {
    const workingOutputDir = `${outputDir}/split-attempts/pass_${String(pass).padStart(3, '0')}`

    try {
      return await runSplitTranscription(target, audioPath, outputDir, {
        ...options,
        asyncLifecycle: undefined
      }, segmentDurationMinutes, workingOutputDir)
    } catch (error) {
      const classification = classifySttSplitLimitError(target, error)
      const nextSegmentDurationMinutes = classification !== undefined
        ? resolveAdaptiveSplitSegmentDurationMinutes(segmentDurationMinutes, error)
        : undefined

      if (
        classification === undefined
        || nextSegmentDurationMinutes === undefined
        || pass >= MAX_ADAPTIVE_SPLIT_PASSES
      ) {
        throw error
      }

      segmentDurationMinutes = nextSegmentDurationMinutes
      logAdaptiveSplitRetryDecision(
        target,
        audioPath,
        classification,
        segmentDurationMinutes,
        audioFileSizeBytes,
        options.audioDurationSeconds
      )
    }
  }

  throw new Error('Adaptive split transcription ended without a result')
}
