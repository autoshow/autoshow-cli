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
  resolveEffectiveSplitSegmentDurationMinutes,
  resolveSttSplitPolicy,
  resolveTranscriptionSplitDecision
} from './stt-split-policy'
import { collectSttTargets } from './stt-targets'
import { createMistralSttPassController } from './stt-services/mistral/mistral-stt-pass-controller'
import { assertNever } from '~/utils/validate/assert-never'
import type { SplitPolicyTarget } from '~/types'

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

const formatBytes = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < (1024 * 1024)) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < (1024 * 1024 * 1024)) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`
}

const formatSeconds = (seconds: number): string =>
  Number.isInteger(seconds) ? `${seconds} seconds` : `${seconds.toFixed(1)} seconds`

const formatSegmentDurationMinutes = (minutes: number): string => {
  const roundedMinutes = Number.isInteger(minutes) ? String(minutes) : String(Number(minutes.toFixed(2)))
  return `${roundedMinutes}-minute`
}

const formatServiceLabel = (service: string): string =>
  `${service[0]!.toUpperCase()}${service.slice(1)}`

const toErrorMessage = (error: unknown): string | undefined => {
  if (error instanceof Error) {
    return error.message
  }

  if (typeof error === 'string') {
    return error
  }

  return undefined
}

const isDurationLimitedTranscriptionError = (
  target: SplitPolicyTarget,
  error: unknown
): boolean => {
  const maxDurationSeconds = resolveSttSplitPolicy(target).maxDurationSeconds
  const message = toErrorMessage(error)
  if (maxDurationSeconds === undefined || !message) {
    return false
  }

  const match = message.match(/audio duration\s+[\d.]+\s+seconds is longer than\s+([\d.]+)\s+seconds which is the maximum for this model/i)
  if (!match) {
    return false
  }

  const capFromError = Number.parseFloat(match[1] ?? '')
  return !Number.isFinite(capFromError) || Math.abs(capFromError - maxDurationSeconds) < 1
}

const resolveSplitRetryReason = (
  target: SplitPolicyTarget,
  splitRequested: boolean,
  error: unknown
): 'attachment_cap' | 'duration_cap' | undefined => {
  if (splitRequested) {
    return undefined
  }

  if (SPLIT_RETRY_ON_TOO_LARGE_ENGINES.has(target.service) && isPayloadTooLargeTranscriptionError(error)) {
    return 'attachment_cap'
  }

  if (isDurationLimitedTranscriptionError(target, error)) {
    return 'duration_cap'
  }

  return undefined
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

  const inputFilename = audioPath.split('/').pop() || 'audio'
  if (autoReason.kind === 'attachment_cap') {
    l.warn(`${formatServiceLabel(target.service)} file uploads are capped at ${formatBytes(autoReason.attachmentCapBytes)}; ${inputFilename} is ${formatBytes(autoReason.audioFileSizeBytes)}. Splitting into ${formatSegmentDurationMinutes(splitDecision.segmentDurationMinutes)} segments automatically`)
    return
  }

  l.warn(`${formatServiceLabel(target.service)} ${target.model} audio duration is capped at ${formatSeconds(autoReason.maxDurationSeconds)}; ${inputFilename} is ${formatSeconds(autoReason.audioDurationSeconds)}. Splitting into ${formatSegmentDurationMinutes(splitDecision.segmentDurationMinutes)} segments automatically`)
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
    return error.message.includes('(413)') || /payload too large|request size limit exceeded|file too large|maximum file size|max file size|file size exceeds/i.test(error.message)
  }

  if (typeof error === 'string') {
    return error.includes('(413)') || /payload too large|request size limit exceeded|file too large|maximum file size|max file size|file size exceeds/i.test(error)
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
  splitSegmentDurationMinutes?: number
): Promise<{ result: TranscriptionResult, metadata: Step2Metadata }> => {
  const effectiveSegmentDurationMinutes = splitSegmentDurationMinutes
    ?? resolveEffectiveSplitSegmentDurationMinutes(resolveSttSplitPolicy(target), DEFAULT_SPLIT_SEGMENT_DURATION_MINUTES, {
      audioFileSizeBytes: Bun.file(audioPath).size,
      audioDurationSeconds: options.audioDurationSeconds
    })
  const segmentDescriptors = await splitAudioFile(audioPath, outputDir, effectiveSegmentDurationMinutes)
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
          outputDir,
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

export const sttTarget = async (
  audioPath: string,
  outputDir: string,
  target: SttTarget,
  options: SttTargetOptions
): Promise<{ result: TranscriptionResult, metadata: Step2Metadata }> => {
  if (target.service === 'supadata' && !isSupadataSupportedSourceUrl(options.sourceUrl)) {
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
    return await runSplitTranscription(target, audioPath, outputDir, {
      ...effectiveOptions,
      asyncLifecycle: undefined
    }, splitDecision.segmentDurationMinutes)
  }

  try {
    const transcription = await dispatchStt(target, audioPath, outputDir, 0, effectiveOptions)
    await persistTranscriptionStructuredArtifact(outputDir, transcription.result, transcription.metadata)
    return transcription
  } catch (error) {
    const splitRetryReason = resolveSplitRetryReason(target, effectiveOptions.split === true, error)
    if (splitRetryReason !== undefined) {
      const splitSegmentDurationMinutes = resolveEffectiveSplitSegmentDurationMinutes(resolveSttSplitPolicy(target), DEFAULT_SPLIT_SEGMENT_DURATION_MINUTES, {
        audioFileSizeBytes: audioFileSize,
        audioDurationSeconds: effectiveOptions.audioDurationSeconds
      })
      if (splitRetryReason === 'attachment_cap') {
        l.warn(`${formatServiceLabel(target.service)} rejected the upload as too large. Retrying with ${formatSegmentDurationMinutes(splitSegmentDurationMinutes)} split transcription`)
      } else {
        l.warn(`${formatServiceLabel(target.service)} ${target.model} exceeded the model audio duration limit. Retrying with ${formatSegmentDurationMinutes(splitSegmentDurationMinutes)} split transcription`)
      }

      return await runSplitTranscription(target, audioPath, outputDir, {
        ...effectiveOptions,
        asyncLifecycle: undefined
      }, splitSegmentDurationMinutes)
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
    language: (options as ProcessingOptions & { supadataLang?: string }).supadataLang,
    happyscribeOrganizationId: (options as ProcessingOptions & { happyscribeOrganizationId?: string }).happyscribeOrganizationId,
    runMode: 'initial'
  })
}
