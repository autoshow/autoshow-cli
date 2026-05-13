import type {
  IndexedTranscriptionChunk,
  ProcessingOptions,
  RuntimeOptions,
  Step2Metadata,
  SttTarget,
  SttTargetOptions,
  TranscriptionResult,
  WhisperProgressWindow
} from '~/types'
import { mkdir } from 'node:fs/promises'
import { mergeStep2TimingMetadata } from './stt-timing-metadata'
import * as l from '~/utils/logger'
import { runWhisperTranscribe } from './stt-local/whisper/run-whisper'
import { runReverbTranscribe } from './stt-local/reverb/run-reverb'
import { runGroqTranscribe } from './stt-services/groq/run-whisper-groq'
import { runGrokStt } from './stt-services/grok/run-grok-stt'
import { runDeepinfraTranscribe } from './stt-services/deepinfra/run-deepinfra-stt'
import { runDeapiStt } from './stt-services/deapi/run-deapi-stt'
import { runElevenLabsTranscribe } from './stt-services/elevenlabs/run-elevenlabs-stt'
import { runDeepgramTranscribe } from './stt-services/deepgram/run-deepgram-stt'
import { runSonioxStt } from './stt-services/soniox/run-soniox-stt'
import { runSpeechmaticsStt } from './stt-services/speechmatics/run-speechmatics-stt'
import { runRevStt } from './stt-services/rev/run-rev-stt'
import { runMistralStt } from './stt-services/mistral/run-mistral-stt'
import { runAssemblyAiTranscribe } from './stt-services/assemblyai/run-assemblyai-stt'
import { runGladiaStt } from './stt-services/gladia/run-gladia-stt'
import { runHappyScribeStt } from './stt-services/happyscribe/run-happyscribe-stt'
import { isDeapiSupportedSourceUrl } from './stt-services/deapi/deapi'
import { isSupadataSupportedSourceUrl } from './stt-services/supadata/supadata'
import { runSupadataStt } from './stt-services/supadata/run-supadata-stt'
import { isScrapeCreatorsSupportedSourceUrl } from './stt-services/scrapecreators/scrapecreators'
import { runScrapeCreatorsStt } from './stt-services/scrapecreators/run-scrapecreators-stt'
import { runOpenaiStt } from './stt-services/openai-stt/run-openai-stt'
import { runGeminiStt } from './stt-services/gemini-stt/run-gemini-stt'
import { runGlmStt } from './stt-services/glm-stt/run-glm-stt'
import { runTogetherStt } from './stt-services/together/run-together-stt'
import { runGcloudStt } from './stt-services/gcloud/run-gcloud-stt'
import { runAwsStt } from './stt-services/aws/run-aws-stt'
import { splitAudioFile } from './stt-utils/audio-splitter'
import { formatTranscriptText } from './stt-utils/stt-utils'
import { mergeTranscriptionEvidence } from './stt-utils/stt-evidence'
import { writeSttResultArtifact } from './stt-utils/stt-result-artifacts'
import { ensureSttTargetSetup as ensureSttTargetSetupViaBroker } from './bootstrap'
import {
  DEFAULT_SPLIT_SEGMENT_DURATION_MINUTES,
  SPLIT_DURATION_SAFETY_SECONDS,
  resolveEffectiveSplitSegmentDurationMinutes,
  resolveSttSplitPolicy,
  resolveTranscriptionSplitDecision
} from './stt-split-policy'
import { collectSttTargets } from './stt-targets'
import { createMistralSttPassController } from './stt-services/mistral/mistral-stt-pass-controller'
import { assertNever } from '~/utils/validate/assert-never'
import type { SplitPolicyTarget } from '~/types'
import { logSttSplitDecision } from './stt-logging'

export { STT_ENGINE_CAPABILITIES, getSttEngineCapabilities, resolveDiarizationOptions } from './cli'
export {
  DEFAULT_SPLIT_SEGMENT_DURATION_MINUTES,
  GLADIA_MAX_ATTACHMENT_BYTES,
  GROQ_MAX_ATTACHMENT_BYTES,
  REV_MAX_ATTACHMENT_BYTES,
  SPEECHMATICS_MAX_ATTACHMENT_BYTES,
  resolveEffectiveSplitSegmentDurationMinutes,
  resolveSttSplitPolicy,
  resolveTranscriptionSplitDecision
} from './stt-split-policy'

const SPLIT_RETRY_ON_TOO_LARGE_ENGINES = new Set<string>([
  'gcloud',
  'aws',
  'elevenlabs',
  'deepgram',
  'deepinfra',
  'deapi',
  'speechmatics',
  'rev',
  'groq',
  'grok',
  'mistral',
  'assemblyai',
  'gladia',
  'happyscribe',
  'openai-stt',
  'glm-stt',
  'together'
])

const MAX_ADAPTIVE_SPLIT_PASSES = 4
const MIN_ADAPTIVE_SPLIT_SEGMENT_SECONDS = 60
type SplitRetryReason = 'attachment_cap' | 'duration_cap' | 'request_budget'
type SplitLimitClassification = {
  reason: SplitRetryReason
  durationCapSeconds?: number | undefined
}

const toErrorMessage = (error: unknown): string | undefined => {
  if (error instanceof Error) {
    return error.message
  }

  if (typeof error === 'string') {
    return error
  }

  return undefined
}

export const extractSttSplitDurationCapSecondsFromError = (error: unknown): number | undefined => {
  const message = toErrorMessage(error)
  if (!message) {
    return undefined
  }

  const patterns = [
    /audio duration\s+[\d.]+\s+seconds is longer than\s+([\d.]+)\s+seconds which is the maximum for this model/i,
    /audio duration\s+[\d.]+\s+seconds is longer than\s+([\d.]+)\s+seconds/i,
    /maximum(?: audio)? duration(?: is| of)?\s+([\d.]+)\s*seconds/i
  ]

  for (const pattern of patterns) {
    const match = message.match(pattern)
    if (!match) {
      continue
    }
    const capFromError = Number.parseFloat(match[1] ?? '')
    if (Number.isFinite(capFromError) && capFromError > 0) {
      return capFromError
    }
  }

  return undefined
}

const isRequestBudgetTranscriptionError = (error: unknown): boolean => {
  const message = toErrorMessage(error)
  if (!message) {
    return false
  }

  return /\binput_too_large\b|input too large|maximum context length|context length|too many input tokens|exceeds? .*token/i.test(message)
}

export const classifySttSplitLimitError = (
  target: SplitPolicyTarget,
  error: unknown
): SplitLimitClassification | undefined => {
  const durationCapSeconds = extractSttSplitDurationCapSecondsFromError(error)
  if (durationCapSeconds !== undefined) {
    return {
      reason: 'duration_cap',
      durationCapSeconds
    }
  }

  const policy = resolveSttSplitPolicy(target)
  if (policy.requestBudgetSeconds !== undefined && isRequestBudgetTranscriptionError(error)) {
    return { reason: 'request_budget' }
  }

  if (SPLIT_RETRY_ON_TOO_LARGE_ENGINES.has(target.service) && isPayloadTooLargeTranscriptionError(error)) {
    return { reason: 'attachment_cap' }
  }

  return undefined
}

const resolveSplitRetryReason = (
  target: SplitPolicyTarget,
  _splitRequested: boolean,
  error: unknown
): SplitRetryReason | undefined =>
  classifySttSplitLimitError(target, error)?.reason

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

export const isPayloadTooLargeTranscriptionError = (error: unknown): boolean => {
  if (error instanceof Error) {
    return error.message.includes('(413)') || /payload too large|request size limit exceeded|file too large|maximum file size|max file size|file size exceeds|\binput_too_large\b|input too large/i.test(error.message)
  }

  if (typeof error === 'string') {
    return error.includes('(413)') || /payload too large|request size limit exceeded|file too large|maximum file size|max file size|file size exceeds|\binput_too_large\b|input too large/i.test(error)
  }

  return false
}

export const shouldRetrySplitTranscriptionAfterError = (
  target: SplitPolicyTarget,
  splitRequested: boolean,
  error: unknown
): boolean => {
  return resolveSplitRetryReason(target, splitRequested, error) !== undefined
}

export const resolveAdaptiveSplitSegmentDurationMinutes = (
  previousSegmentDurationMinutes: number,
  error: unknown
): number | undefined => {
  const previousSegmentSeconds = Math.floor(previousSegmentDurationMinutes * 60)
  if (!Number.isFinite(previousSegmentSeconds) || previousSegmentSeconds <= MIN_ADAPTIVE_SPLIT_SEGMENT_SECONDS) {
    return undefined
  }

  const parsedDurationCapSeconds = extractSttSplitDurationCapSecondsFromError(error)
  const proposedSeconds = parsedDurationCapSeconds !== undefined
    ? Math.min(previousSegmentSeconds - 1, Math.floor(parsedDurationCapSeconds) - SPLIT_DURATION_SAFETY_SECONDS)
    : Math.floor(previousSegmentSeconds / 2)
  const nextSegmentSeconds = Math.max(MIN_ADAPTIVE_SPLIT_SEGMENT_SECONDS, proposedSeconds)

  if (nextSegmentSeconds >= previousSegmentSeconds) {
    return undefined
  }

  return Number((nextSegmentSeconds / 60).toFixed(3))
}

const persistTranscriptionStructuredArtifact = async (
  outputDir: string,
  result: TranscriptionResult,
  metadata: Step2Metadata
): Promise<void> => {
  await writeSttResultArtifact(outputDir, metadata, result)
}

export const ensureSttTargetSetup = async (
  target: Pick<SttTarget, 'service' | 'model'>
): Promise<void> =>
  await ensureSttTargetSetupViaBroker(target)

const dispatchStt = async (
  target: SttTarget,
  audioPath: string,
  outputDir: string,
  segmentOffsetMinutes: number,
  options: SttTargetOptions,
  segmentNumber?: number,
  totalSegments?: number,
  whisperProgress?: WhisperProgressWindow | undefined
): Promise<{ result: TranscriptionResult, metadata: Step2Metadata }> => {
  if (target.service === 'reverb') {
    return await runReverbTranscribe(audioPath, outputDir, {
      segmentOffsetMinutes,
      segmentNumber,
      totalSegments,
      reverbVerbatimicity: options.reverbVerbatimicity
    })
  }

  if (target.service === 'elevenlabs') {
    return await runElevenLabsTranscribe(audioPath, outputDir, {
      model: target.model,
      segmentOffsetMinutes,
      segmentNumber,
      totalSegments,
      diarizationOptions: target.diarizationOptions
    })
  }

  if (target.service === 'gcloud') {
    return await runGcloudStt(audioPath, outputDir, {
      model: target.model,
      segmentOffsetMinutes,
      segmentNumber,
      totalSegments,
      diarizationOptions: target.diarizationOptions
    })
  }

  if (target.service === 'deepgram') {
    return await runDeepgramTranscribe(audioPath, outputDir, {
      model: target.model,
      segmentOffsetMinutes,
      segmentNumber,
      totalSegments
    })
  }

  if (target.service === 'deepinfra') {
    return await runDeepinfraTranscribe(audioPath, outputDir, {
      model: target.model,
      segmentOffsetMinutes,
      segmentNumber,
      totalSegments,
      audioDurationSeconds: options.audioDurationSeconds
    })
  }

  if (target.service === 'deapi') {
    return await runDeapiStt(audioPath, outputDir, {
      model: target.model,
      sourceUrl: options.sourceUrl,
      segmentOffsetMinutes,
      segmentNumber,
      totalSegments,
      audioDurationSeconds: options.audioDurationSeconds,
      runMode: options.runMode,
      lifecycle: options.asyncLifecycle
    })
  }

  if (target.service === 'soniox') {
    return await runSonioxStt(audioPath, outputDir, {
      model: target.model,
      segmentOffsetMinutes,
      segmentNumber,
      totalSegments,
      diarizationOptions: target.diarizationOptions,
      audioDurationSeconds: options.audioDurationSeconds,
      runMode: options.runMode,
      lifecycle: options.asyncLifecycle
    })
  }

  if (target.service === 'speechmatics') {
    return await runSpeechmaticsStt(audioPath, outputDir, {
      model: target.model,
      segmentOffsetMinutes,
      segmentNumber,
      totalSegments,
      diarizationOptions: target.diarizationOptions,
      audioDurationSeconds: options.audioDurationSeconds,
      runMode: options.runMode,
      lifecycle: options.asyncLifecycle
    })
  }

  if (target.service === 'rev') {
    return await runRevStt(audioPath, outputDir, {
      model: target.model,
      segmentOffsetMinutes,
      segmentNumber,
      totalSegments,
      diarizationOptions: target.diarizationOptions,
      audioDurationSeconds: options.audioDurationSeconds,
      runMode: options.runMode,
      lifecycle: options.asyncLifecycle
    })
  }

  if (target.service === 'aws') {
    return await runAwsStt(audioPath, outputDir, {
      model: target.model,
      region: target.awsRegion,
      bucket: target.awsBucket,
      segmentOffsetMinutes,
      segmentNumber,
      totalSegments,
      diarizationOptions: target.diarizationOptions,
      audioDurationSeconds: options.audioDurationSeconds,
      runMode: options.runMode,
      lifecycle: options.asyncLifecycle
    })
  }

  if (target.service === 'groq') {
    return await runGroqTranscribe(audioPath, outputDir, {
      model: target.model,
      segmentOffsetMinutes,
      segmentNumber,
      totalSegments,
      audioDurationSeconds: options.audioDurationSeconds
    })
  }

  if (target.service === 'grok') {
    return await runGrokStt(audioPath, outputDir, {
      model: target.model,
      segmentOffsetMinutes,
      segmentNumber,
      totalSegments
    })
  }

  if (target.service === 'whisper') {
    return await runWhisperTranscribe(audioPath, outputDir, {
      model: target.model,
      segmentOffsetMinutes,
      segmentNumber,
      totalSegments,
      audioDurationSeconds: options.audioDurationSeconds,
      segmentStartSeconds: whisperProgress?.segmentStartSeconds,
      segmentDurationSeconds: whisperProgress?.segmentDurationSeconds,
      totalDurationSeconds: whisperProgress?.totalDurationSeconds,
      preserveJson: true
    })
  }

  if (target.service === 'mistral') {
    return await runMistralStt(audioPath, outputDir, {
      model: target.model,
      segmentOffsetMinutes,
      segmentNumber,
      totalSegments,
      diarizationOptions: target.diarizationOptions,
      passController: options.mistralPassController
    })
  }

  if (target.service === 'assemblyai') {
    return await runAssemblyAiTranscribe(audioPath, outputDir, {
      model: target.model,
      segmentOffsetMinutes,
      segmentNumber,
      totalSegments,
      diarizationOptions: target.diarizationOptions,
      audioDurationSeconds: options.audioDurationSeconds,
      runMode: options.runMode,
      lifecycle: options.asyncLifecycle
    })
  }

  if (target.service === 'gladia') {
    return await runGladiaStt(audioPath, outputDir, {
      model: target.model,
      segmentOffsetMinutes,
      segmentNumber,
      totalSegments,
      diarizationOptions: target.diarizationOptions,
      audioDurationSeconds: options.audioDurationSeconds,
      runMode: options.runMode,
      lifecycle: options.asyncLifecycle
    })
  }

  if (target.service === 'happyscribe') {
    return await runHappyScribeStt(audioPath, outputDir, {
      model: target.model,
      happyscribeOrganizationId: options.happyscribeOrganizationId,
      segmentOffsetMinutes,
      segmentNumber,
      totalSegments,
      audioDurationSeconds: options.audioDurationSeconds,
      runMode: options.runMode,
      lifecycle: options.asyncLifecycle
    })
  }

  if (target.service === 'supadata') {
    return await runSupadataStt(audioPath, outputDir, {
      model: target.model,
      sourceUrl: options.sourceUrl,
      language: options.language,
      segmentOffsetMinutes,
      segmentNumber,
      totalSegments,
      audioDurationSeconds: options.audioDurationSeconds,
      runMode: options.runMode,
      lifecycle: options.asyncLifecycle
    })
  }

  if (target.service === 'scrapecreators') {
    return await runScrapeCreatorsStt(audioPath, outputDir, {
      model: target.model,
      sourceUrl: options.sourceUrl,
      language: options.language,
      segmentOffsetMinutes,
      segmentNumber,
      totalSegments
    })
  }

  if (target.service === 'openai-stt') {
    return await runOpenaiStt(audioPath, outputDir, {
      model: target.model,
      segmentOffsetMinutes,
      segmentNumber,
      totalSegments,
      audioDurationSeconds: options.audioDurationSeconds
    })
  }

  if (target.service === 'gemini-stt') {
    return await runGeminiStt(audioPath, outputDir, {
      model: target.model,
      segmentOffsetMinutes,
      segmentNumber,
      totalSegments,
      audioDurationSeconds: options.audioDurationSeconds
    })
  }

  if (target.service === 'glm-stt') {
    return await runGlmStt(audioPath, outputDir, {
      model: target.model,
      segmentOffsetMinutes,
      segmentNumber,
      totalSegments,
      audioDurationSeconds: options.audioDurationSeconds
    })
  }

  if (target.service === 'together') {
    return await runTogetherStt(audioPath, outputDir, {
      model: target.model,
      segmentOffsetMinutes,
      segmentNumber,
      totalSegments,
      audioDurationSeconds: options.audioDurationSeconds
    })
  }

  if (target.service === 'youtube-captions') {
    throw new Error('youtube-captions is resolved before STT provider dispatch')
  }

  assertNever(target.service)
}

export const resolveEffectiveSegmentConcurrency = (
  target: Pick<SttTarget, 'local' | 'service'>,
  requestedConcurrency: number | undefined
): number => {
  if (target.local || target.service === 'mistral') {
    return 1
  }

  return Math.max(1, requestedConcurrency ?? 2)
}

export const mergeSplitTranscriptionChunks = (
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

const runAdaptiveSplitTranscription = async (
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

  if (target.service === 'deapi' && effectiveOptions.split !== true && isDeapiSupportedSourceUrl(effectiveOptions.sourceUrl)) {
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
