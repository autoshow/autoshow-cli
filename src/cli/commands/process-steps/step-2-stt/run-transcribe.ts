import type { ProcessingOptions, TranscriptionResult, Step2Metadata, Step2TimingMetadata, DiarizationOptions } from '~/types'
import * as l from '~/logger'
import { runWhisperTranscribe } from './stt-local/whisper/run-whisper'
import { runReverbTranscribe } from './stt-local/reverb/run-reverb'
import { runGroqTranscribe } from './stt-services/groq/run-whisper-groq'
import { runElevenLabsTranscribe } from './stt-services/elevenlabs/run-elevenlabs-stt'
import { runDeepgramTranscribe } from './stt-services/deepgram/run-deepgram-stt'
import { runSonioxStt } from './stt-services/soniox/run-soniox-stt'
import { runSpeechmaticsStt } from './stt-services/speechmatics/run-speechmatics-stt'
import { runOpenAIStt } from './stt-services/openai/run-openai-stt'
import { runMistralStt } from './stt-services/mistral/run-mistral-stt'
import { runAssemblyAiTranscribe } from './stt-services/assemblyai/run-assemblyai-stt'
import { splitAudioFile } from './stt-utils/audio-splitter'
import { formatTranscriptText } from './stt-utils/transcription-utils'
import { fileExists } from '~/utils/cli-utils'
import { ensureReverbRuntimeSetup } from '~/cli/commands/process-steps/step-2-stt/stt-local/reverb/reverb'
import { ensureWhisperReady } from '~/cli/commands/process-steps/step-2-stt/stt-local/whisper/whisper'
import { ensureElevenLabsSttSetup } from '~/cli/commands/process-steps/step-2-stt/stt-services/elevenlabs/elevenlabs'
import { ensureDeepgramSttSetup } from '~/cli/commands/process-steps/step-2-stt/stt-services/deepgram/deepgram'
import { ensureSonioxSttSetup } from '~/cli/commands/process-steps/step-2-stt/stt-services/soniox/soniox'
import { ensureSpeechmaticsSttSetup } from '~/cli/commands/process-steps/step-2-stt/stt-services/speechmatics/speechmatics'
import { ensureOpenAISttSetup } from '~/cli/commands/process-steps/step-2-stt/stt-services/openai/openai'
import { ensureMistralSttSetup } from '~/cli/commands/process-steps/step-2-stt/stt-services/mistral/mistral'
import { ensureAssemblyAiSttSetup } from '~/cli/commands/process-steps/step-2-stt/stt-services/assemblyai/assemblyai'
import { reverbUvEnvDir, reverbModelPath, reverbConfigPath, whisperBinaryPath, whisperModelsDir } from '~/cli/commands/process-steps/step-0-setup/setup-orchestrator/run-complete-setup'
import { assertNever } from '~/utils/validate/assert-never'
import type { TranscribeEngine, TranscribeEngineCapabilities } from '~/types'
import { CLIUsageError } from '~/utils/error-handler'
import type { SttTarget } from './stt-targets'
import type { AsyncSttLifecycleHooks } from './stt-utils/async-stt-job-runner'

export const TRANSCRIBE_ENGINE_CAPABILITIES = {
  reverb: { diarizationByDefault: true, supportsSpeakerCountHint: false, supportsKnownSpeakerReferences: false },
  elevenlabs: { diarizationByDefault: true, supportsSpeakerCountHint: true, supportsKnownSpeakerReferences: false },
  deepgram: { diarizationByDefault: true, supportsSpeakerCountHint: false, supportsKnownSpeakerReferences: false },
  soniox: { diarizationByDefault: true, supportsSpeakerCountHint: false, supportsKnownSpeakerReferences: false },
  speechmatics: { diarizationByDefault: true, supportsSpeakerCountHint: false, supportsKnownSpeakerReferences: false },
  groq: { diarizationByDefault: false, supportsSpeakerCountHint: false, supportsKnownSpeakerReferences: false },
  openai: { diarizationByDefault: true, supportsSpeakerCountHint: false, supportsKnownSpeakerReferences: true },
  mistral: { diarizationByDefault: true, supportsSpeakerCountHint: false, supportsKnownSpeakerReferences: false },
  assemblyai: { diarizationByDefault: true, supportsSpeakerCountHint: true, supportsKnownSpeakerReferences: false },
  whisper: { diarizationByDefault: false, supportsSpeakerCountHint: false, supportsKnownSpeakerReferences: false }
} as const satisfies Record<TranscribeEngine, TranscribeEngineCapabilities>

const SPLIT_SEGMENT_DURATION_MINUTES = 10
export const GROQ_MAX_ATTACHMENT_BYTES = 25 * 1024 * 1024
export const OPENAI_MAX_ATTACHMENT_BYTES = 25 * 1024 * 1024
export const SPEECHMATICS_MAX_ATTACHMENT_BYTES = 1 * 1024 * 1024 * 1024

const AUTO_SPLIT_ATTACHMENT_CAP_BYTES: Partial<Record<TranscribeEngine, number>> = {
  groq: GROQ_MAX_ATTACHMENT_BYTES,
  openai: OPENAI_MAX_ATTACHMENT_BYTES,
  speechmatics: SPEECHMATICS_MAX_ATTACHMENT_BYTES
}

const SPLIT_RETRY_ON_TOO_LARGE_ENGINES = new Set<TranscribeEngine>([
  'elevenlabs',
  'deepgram',
  'speechmatics',
  'groq',
  'openai',
  'mistral',
  'assemblyai'
])

const formatBytes = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < (1024 * 1024)) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < (1024 * 1024 * 1024)) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`
}

export const shouldSplitTranscriptionInput = (
  engine: TranscribeEngine,
  audioFileSizeBytes: number,
  splitRequested: boolean
): boolean => {
  if (splitRequested) {
    return true
  }

  const attachmentCapBytes = AUTO_SPLIT_ATTACHMENT_CAP_BYTES[engine]
  return attachmentCapBytes !== undefined && audioFileSizeBytes > attachmentCapBytes
}

export const isPayloadTooLargeTranscriptionError = (error: unknown): boolean => {
  if (error instanceof Error) {
    return error.message.includes('(413)') || /payload too large|request size limit exceeded/i.test(error.message)
  }

  if (typeof error === 'string') {
    return error.includes('(413)') || /payload too large|request size limit exceeded/i.test(error)
  }

  return false
}

export const shouldRetrySplitTranscriptionAfterError = (
  engine: TranscribeEngine,
  splitRequested: boolean,
  error: unknown
): boolean => {
  if (splitRequested) {
    return false
  }

  return SPLIT_RETRY_ON_TOO_LARGE_ENGINES.has(engine) && isPayloadTooLargeTranscriptionError(error)
}

const resolveTranscribeEngine = (options: ProcessingOptions): TranscribeEngine => {
  const hasReverb = options.useReverb === true
  const hasElevenlabs = typeof options.elevenlabsSttModel === 'string' && options.elevenlabsSttModel.length > 0
  const hasDeepgram = typeof options.deepgramSttModel === 'string' && options.deepgramSttModel.length > 0
  const hasSoniox = typeof options.sonioxSttModel === 'string' && options.sonioxSttModel.length > 0
  const hasSpeechmatics = typeof options.speechmaticsSttModel === 'string' && options.speechmaticsSttModel.length > 0
  const hasGroq = typeof options.groqSttModel === 'string' && options.groqSttModel.length > 0
  const hasOpenAI = typeof options.openaiSttModel === 'string' && options.openaiSttModel.length > 0
  const hasMistral = typeof options.mistralSttModel === 'string' && options.mistralSttModel.length > 0
  const hasAssemblyAi = typeof options.assemblyaiSttModel === 'string' && options.assemblyaiSttModel.length > 0

  const engineCount = [hasReverb, hasElevenlabs, hasDeepgram, hasSoniox, hasSpeechmatics, hasGroq, hasOpenAI, hasMistral, hasAssemblyAi].filter(Boolean).length
  if (engineCount > 1) {
    throw new Error('Cannot use more than one transcription engine at the same time (--reverb, --elevenlabs-stt, --deepgram-stt, --soniox-stt, --speechmatics-stt, --groq-stt, --openai-stt, --mistral-stt, --assemblyai-stt)')
  }

  if (hasReverb) return 'reverb'
  if (hasElevenlabs) return 'elevenlabs'
  if (hasDeepgram) return 'deepgram'
  if (hasSoniox) return 'soniox'
  if (hasSpeechmatics) return 'speechmatics'
  if (hasGroq) return 'groq'
  if (hasOpenAI) return 'openai'
  if (hasMistral) return 'mistral'
  if (hasAssemblyAi) return 'assemblyai'
  return 'whisper'
}

const checkReverbSetup = async (): Promise<boolean> => {
  const envExists = await fileExists(`${reverbUvEnvDir}/bin/python`)
  const modelExists = await fileExists(reverbModelPath)
  const configExists = await fileExists(reverbConfigPath)
  return envExists && modelExists && configExists
}

const ensureReverbSetup = async (): Promise<void> => {
  const isSetup = await checkReverbSetup()
  if (!isSetup) {
    await ensureReverbRuntimeSetup()
  }
}

const checkWhisperSetup = async (model: string): Promise<boolean> => {
  const binaryExists = await fileExists(whisperBinaryPath)
  const modelExists = await fileExists(`${whisperModelsDir}/ggml-${model}.bin`)
  return binaryExists && modelExists
}

const ensureWhisperSetup = async (model: string): Promise<void> => {
  const isSetup = await checkWhisperSetup(model)
  if (!isSetup) {
    await ensureWhisperReady(model)
  }
}

type DiarizationFlagOptions = Pick<
  ProcessingOptions,
  'diarizationSpeakerCount' | 'diarizationSpeakerNames' | 'diarizationSpeakerReferences'
>

export const getTranscribeEngineCapabilities = (
  engine: TranscribeEngine
): TranscribeEngineCapabilities => TRANSCRIBE_ENGINE_CAPABILITIES[engine]

export const resolveDiarizationOptions = (
  options: DiarizationFlagOptions,
  engine: TranscribeEngine
): DiarizationOptions | undefined => {
  const speakerCount = options.diarizationSpeakerCount
  const speakerNames = options.diarizationSpeakerNames
  const speakerReferences = options.diarizationSpeakerReferences
  const hasKnownSpeakerNames = speakerNames !== undefined && speakerNames.length > 0
  const hasKnownSpeakerReferences = speakerReferences !== undefined && speakerReferences.length > 0

  if (hasKnownSpeakerNames !== hasKnownSpeakerReferences) {
    throw CLIUsageError('OpenAI diarization requires matching --speaker-name and --speaker-reference values.')
  }

  if (speakerNames && speakerReferences) {
    if (speakerNames.length !== speakerReferences.length) {
      throw CLIUsageError(`OpenAI diarization requires the same number of --speaker-name and --speaker-reference values (received ${speakerNames.length} names and ${speakerReferences.length} references).`)
    }

    if (speakerNames.length > 4) {
      throw CLIUsageError(`OpenAI diarization supports at most 4 known speakers (received ${speakerNames.length}).`)
    }
  }

  const capabilities = TRANSCRIBE_ENGINE_CAPABILITIES[engine]
  const diarizationOptions: DiarizationOptions = capabilities.diarizationByDefault
    ? { enabled: true }
    : {}

  if (speakerNames && speakerReferences) {
    if (!capabilities.supportsKnownSpeakerReferences) {
      throw CLIUsageError(`--speaker-name and --speaker-reference are only supported with OpenAI diarization right now; received ${engine}.`)
    }

    diarizationOptions.knownSpeakerNames = speakerNames
    diarizationOptions.knownSpeakerReferencePaths = speakerReferences
  }

  if (speakerCount === undefined) {
    return Object.keys(diarizationOptions).length > 0 ? diarizationOptions : undefined
  }

  if (!capabilities.supportsSpeakerCountHint) {
    return Object.keys(diarizationOptions).length > 0 ? diarizationOptions : undefined
  }

  diarizationOptions.speakerCount = speakerCount
  return diarizationOptions
}

type WhisperProgressWindow = {
  segmentStartSeconds: number
  segmentDurationSeconds: number
  totalDurationSeconds: number
}

type TranscribeTargetOptions = {
  split?: boolean | undefined
  reverbVerbatimicity?: number | undefined
  sttSegmentConcurrency?: number | undefined
  audioDurationSeconds?: number | undefined
  runMode?: 'initial' | 'backfill' | undefined
  asyncLifecycle?: AsyncSttLifecycleHooks | undefined
}

type IndexedTranscriptionChunk = {
  segmentIndex: number
  data: { result: TranscriptionResult, metadata: Step2Metadata }
}

const STT_TIMING_KEYS = [
  'queueWaitMs',
  'transcribeMs',
  'uploadMs',
  'createMs',
  'pollMs',
  'pollSleepMs',
  'transcriptMs',
  'remoteProcessingMs',
  'cleanupMs',
  'requestCount',
  'retryCount',
  'rateLimitCount'
] as const satisfies readonly (keyof Step2TimingMetadata)[]

const mergeStep2Timings = (
  values: Array<Step2TimingMetadata | undefined>
): Step2TimingMetadata | undefined => {
  const merged: Step2TimingMetadata = {}

  for (const key of STT_TIMING_KEYS) {
    const total = values.reduce((sum, value) => sum + (value?.[key] ?? 0), 0)
    if (total > 0) {
      merged[key] = total
    }
  }

  return Object.keys(merged).length > 0 ? merged : undefined
}

export const ensureTranscribeTargetSetup = async (
  target: Pick<SttTarget, 'service' | 'model'>
): Promise<void> => {
  if (target.service === 'reverb') {
    await ensureReverbSetup()
    return
  }
  if (target.service === 'elevenlabs') {
    await ensureElevenLabsSttSetup()
    return
  }
  if (target.service === 'deepgram') {
    await ensureDeepgramSttSetup()
    return
  }
  if (target.service === 'soniox') {
    await ensureSonioxSttSetup()
    return
  }
  if (target.service === 'speechmatics') {
    await ensureSpeechmaticsSttSetup()
    return
  }
  if (target.service === 'openai') {
    await ensureOpenAISttSetup()
    return
  }
  if (target.service === 'mistral') {
    await ensureMistralSttSetup()
    return
  }
  if (target.service === 'assemblyai') {
    await ensureAssemblyAiSttSetup()
    return
  }
  if (target.service === 'whisper') {
    await ensureWhisperSetup(target.model)
  }
}

const dispatchTranscribe = async (
  target: SttTarget,
  audioPath: string,
  outputDir: string,
  segmentOffsetMinutes: number,
  options: TranscribeTargetOptions,
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

  if (target.service === 'deepgram') {
    return await runDeepgramTranscribe(audioPath, outputDir, {
      model: target.model,
      segmentOffsetMinutes,
      segmentNumber,
      totalSegments
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

  if (target.service === 'groq') {
    return await runGroqTranscribe(audioPath, outputDir, {
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
      segmentStartSeconds: whisperProgress?.segmentStartSeconds,
      segmentDurationSeconds: whisperProgress?.segmentDurationSeconds,
      totalDurationSeconds: whisperProgress?.totalDurationSeconds,
      preserveJson: true
    })
  }

  if (target.service === 'openai') {
    return await runOpenAIStt(audioPath, outputDir, {
      model: target.model,
      segmentOffsetMinutes,
      segmentNumber,
      totalSegments,
      diarizationOptions: target.diarizationOptions
    })
  }

  if (target.service === 'mistral') {
    return await runMistralStt(audioPath, outputDir, {
      model: target.model,
      segmentOffsetMinutes,
      segmentNumber,
      totalSegments,
      diarizationOptions: target.diarizationOptions
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

  assertNever(target.service)
}

export const resolveEffectiveSegmentConcurrency = (
  target: Pick<SttTarget, 'local'>,
  requestedConcurrency: number | undefined
): number => target.local ? 1 : Math.max(1, requestedConcurrency ?? 2)

export const mergeSplitTranscriptionChunks = (
  chunks: IndexedTranscriptionChunk[]
): { result: TranscriptionResult, metadata: Step2Metadata } => {
  const orderedChunks = [...chunks].sort((left, right) => left.segmentIndex - right.segmentIndex)
  const segmentResults = orderedChunks.map((entry) => entry.data)

  const combinedResult = {
    text: segmentResults.map(s => s.result.text).join(' '),
    segments: segmentResults.flatMap(s => s.result.segments)
  }

  const totalProcessingTime = segmentResults.reduce((sum, s) => sum + s.metadata.processingTime, 0)
  const totalTokenCount = segmentResults.reduce((sum, s) => sum + s.metadata.tokenCount, 0)
  const mergedTimings = mergeStep2Timings(segmentResults.map((segment) => segment.metadata.timings))

  return {
    result: combinedResult,
    metadata: {
      transcriptionService: segmentResults[0]!.metadata.transcriptionService,
      transcriptionModel: segmentResults[0]!.metadata.transcriptionModel,
      transcriptionModelName: segmentResults[0]!.metadata.transcriptionModelName,
      processingTime: totalProcessingTime,
      tokenCount: totalTokenCount,
      ...(mergedTimings ? { timings: mergedTimings } : {})
    }
  }
}

const runSplitTranscription = async (
  target: SttTarget,
  audioPath: string,
  outputDir: string,
  options: TranscribeTargetOptions
): Promise<{ result: TranscriptionResult, metadata: Step2Metadata }> => {
  const segmentDescriptors = await splitAudioFile(audioPath, outputDir, SPLIT_SEGMENT_DURATION_MINUTES)
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
        const data = await dispatchTranscribe(
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
  return combined
}

export const transcribeTarget = async (
  audioPath: string,
  outputDir: string,
  target: SttTarget,
  options: TranscribeTargetOptions
): Promise<{ result: TranscriptionResult, metadata: Step2Metadata }> => {
  await ensureTranscribeTargetSetup(target)

  const audioFileSize = Bun.file(audioPath).size
  if (shouldSplitTranscriptionInput(target.service, audioFileSize, options.split === true)) {
    const attachmentCapBytes = AUTO_SPLIT_ATTACHMENT_CAP_BYTES[target.service]
    if (options.split !== true && attachmentCapBytes !== undefined) {
      const inputFilename = audioPath.split('/').pop() || 'audio'
      l.warn(`${target.service[0]!.toUpperCase()}${target.service.slice(1)} file uploads are capped at ${formatBytes(attachmentCapBytes)}; ${inputFilename} is ${formatBytes(audioFileSize)}. Splitting into ${SPLIT_SEGMENT_DURATION_MINUTES}-minute segments automatically`)
    }

    return await runSplitTranscription(target, audioPath, outputDir, {
      ...options,
      asyncLifecycle: undefined
    })
  }

  try {
    return await dispatchTranscribe(target, audioPath, outputDir, 0, options)
  } catch (error) {
    if (shouldRetrySplitTranscriptionAfterError(target.service, options.split === true, error)) {
      l.warn(`${target.service[0]!.toUpperCase()}${target.service.slice(1)} rejected the upload as too large. Retrying with ${SPLIT_SEGMENT_DURATION_MINUTES}-minute split transcription`)
      return await runSplitTranscription(target, audioPath, outputDir, {
        ...options,
        asyncLifecycle: undefined
      })
    }

    throw error
  }
}

export const transcribe = async (
  audioPath: string,
  options: ProcessingOptions
): Promise<{ result: TranscriptionResult, metadata: Step2Metadata }> => {
  const engine = resolveTranscribeEngine(options)
  const diarizationOptions = resolveDiarizationOptions(options, engine)
  const model = (() => {
    if (engine === 'reverb') return 'reverb'
    if (engine === 'whisper') return options.whisperModel
    if (engine === 'elevenlabs') return options.elevenlabsSttModel as string
    if (engine === 'deepgram') return options.deepgramSttModel as string
    if (engine === 'soniox') return options.sonioxSttModel as string
    if (engine === 'speechmatics') return options.speechmaticsSttModel as string
    if (engine === 'groq') return options.groqSttModel as string
    if (engine === 'openai') return options.openaiSttModel as string
    if (engine === 'mistral') return options.mistralSttModel as string
    return options.assemblyaiSttModel as string
  })()
  const target: SttTarget = {
    service: engine,
    model,
    local: engine === 'reverb' || engine === 'whisper',
    diarizationOptions
  }

  return await transcribeTarget(audioPath, options.outputDir, target, {
    split: options.split,
    reverbVerbatimicity: options.reverbVerbatimicity,
    sttSegmentConcurrency: (options as ProcessingOptions & { sttSegmentConcurrency?: number }).sttSegmentConcurrency,
    runMode: 'initial'
  })
}
