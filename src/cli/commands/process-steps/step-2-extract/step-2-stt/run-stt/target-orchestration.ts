import * as l from '~/utils/logger'
import type {
  ProcessingOptions,
  RuntimeOptions,
  Step2Metadata,
  SttTarget,
  SttTargetOptions,
  TranscriptionResult
} from '~/types'
import { dispatchStt, ensureSttTargetSetup } from './dispatch'
import { isSupadataSupportedSourceUrl } from '../stt-services/supadata/supadata'
import { isScrapeCreatorsSupportedSourceUrl } from '../stt-services/scrapecreators/scrapecreators'
import { writeSttResultArtifact } from '../stt-utils/stt-result-artifacts'
import {
  DEFAULT_SPLIT_SEGMENT_DURATION_MINUTES,
  resolveEffectiveSplitSegmentDurationMinutes,
  resolveSttSplitPolicy,
  resolveTranscriptionSplitDecision
} from '../stt-split-policy'
import { collectSttTargets } from '../stt-targets'
import { createMistralSttPassController } from '../stt-services/mistral/mistral-stt-pass-controller'
import { logSttSplitDecision } from '../stt-logging'
import { classifySttSplitLimitError } from './split-limits'
import { runAdaptiveSplitTranscription } from './split-execution'
import type { SplitPolicyTarget } from '~/types'

const persistTranscriptionStructuredArtifact = async (
  outputDir: string,
  result: TranscriptionResult,
  metadata: Step2Metadata
): Promise<void> => {
  await writeSttResultArtifact(outputDir, metadata, result)
}

const logAutoSplitDecision = (
  target: SplitPolicyTarget,
  audioPath: string,
  splitDecision: ReturnType<typeof resolveTranscriptionSplitDecision>
): void => {
  const autoReason = splitDecision.reasons.find((reason) => reason.kind !== 'explicit')
  if (!autoReason) {
    return
  }

  logSttSplitDecision(l, target, splitDecision, {
    trigger: 'auto',
    audioPath
  })
}

export const shouldSplitTranscriptionInput = (
  target: SplitPolicyTarget,
  audioFileSizeBytes: number,
  audioDurationSeconds: number | undefined,
  splitRequested: boolean
): boolean => {
  return resolveTranscriptionSplitDecision(target, {
    audioFileSizeBytes,
    audioDurationSeconds,
    splitRequested
  }).shouldSplit
}

export const sttTarget = async (
  audioPath: string,
  outputDir: string,
  target: SttTarget,
  options: SttTargetOptions
): Promise<{ result: TranscriptionResult, metadata: Step2Metadata }> => {
  if (target.service === 'supadata' && !isSupadataSupportedSourceUrl(options.sourceUrl)) {
    return await dispatchStt(target, audioPath, outputDir, 0, options)
  }

  if (target.service === 'scrapecreators' && !isScrapeCreatorsSupportedSourceUrl(options.sourceUrl)) {
    return await dispatchStt(target, audioPath, outputDir, 0, options)
  }

  await ensureSttTargetSetup(target)
  const effectiveOptions = target.service === 'mistral' && options.mistralPassController === undefined
    ? {
        ...options,
        mistralPassController: createMistralSttPassController()
      }
    : options

  if (target.service === 'supadata') {
    const transcription = await dispatchStt(target, audioPath, outputDir, 0, effectiveOptions)
    await persistTranscriptionStructuredArtifact(outputDir, transcription.result, transcription.metadata)
    return transcription
  }

  if (target.service === 'scrapecreators') {
    const transcription = await dispatchStt(target, audioPath, outputDir, 0, effectiveOptions)
    await persistTranscriptionStructuredArtifact(outputDir, transcription.result, transcription.metadata)
    return transcription
  }

  const audioFileSize = Bun.file(audioPath).size
  const splitDecision = resolveTranscriptionSplitDecision(target, {
    audioFileSizeBytes: audioFileSize,
    audioDurationSeconds: effectiveOptions.audioDurationSeconds,
    splitRequested: effectiveOptions.split === true
  })
  if (splitDecision.shouldSplit) {
    if (effectiveOptions.split !== true) {
      logAutoSplitDecision(target, audioPath, splitDecision)
    }
    return await runAdaptiveSplitTranscription(
      target,
      audioPath,
      outputDir,
      effectiveOptions,
      splitDecision.segmentDurationMinutes,
      audioFileSize
    )
  }

  try {
    const transcription = await dispatchStt(target, audioPath, outputDir, 0, effectiveOptions)
    await persistTranscriptionStructuredArtifact(outputDir, transcription.result, transcription.metadata)
    return transcription
  } catch (error) {
    const splitLimitClassification = classifySttSplitLimitError(target, error)
    if (splitLimitClassification !== undefined) {
      const splitSegmentDurationMinutes = resolveEffectiveSplitSegmentDurationMinutes(resolveSttSplitPolicy(target), DEFAULT_SPLIT_SEGMENT_DURATION_MINUTES, {
        audioFileSizeBytes: audioFileSize,
        audioDurationSeconds: effectiveOptions.audioDurationSeconds
      })

      return await runAdaptiveSplitTranscription(
        target,
        audioPath,
        outputDir,
        effectiveOptions,
        splitSegmentDurationMinutes,
        audioFileSize,
        splitLimitClassification
      )
    }

    throw error
  }
}

export const stt = async (
  audioPath: string,
  options: ProcessingOptions
): Promise<{ result: TranscriptionResult, metadata: Step2Metadata }> => {
  const targets = collectSttTargets({
    ...(options as unknown as RuntimeOptions),
    step2SelectionOrigins: {
      whisper: 'explicit'
    }
  })
  if (targets.length !== 1) {
    throw new Error(`stt() expects exactly one STT target, received ${targets.length}`)
  }
  const target = targets[0] as SttTarget

  return await sttTarget(audioPath, options.outputDir, target, {
    split: options.split,
    reverbVerbatimicity: options.reverbVerbatimicity,
    sttSegmentConcurrency: (options as ProcessingOptions & { sttSegmentConcurrency?: number }).sttSegmentConcurrency,
    audioDurationSeconds: (options as ProcessingOptions & { audioDurationSeconds?: number }).audioDurationSeconds,
    sourceUrl: options.url,
    language: target.service === 'scrapecreators'
      ? (options as ProcessingOptions & { scrapecreatorsLang?: string }).scrapecreatorsLang
      : (options as ProcessingOptions & { supadataLang?: string }).supadataLang,
    happyscribeOrganizationId: (options as ProcessingOptions & { happyscribeOrganizationId?: string }).happyscribeOrganizationId,
    runMode: 'initial'
  })
}
