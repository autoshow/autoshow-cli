import type {
  IndexedTranscriptionChunk,
  ProcessingOptions,
  Step2Metadata,
  SttTarget,
  SttTargetOptions,
  TranscribeEngine,
  TranscriptionResult,
  WhisperProgressWindow
} from '~/types'
import { mergeStep2TimingMetadata } from './stt-timing-metadata'
import * as l from '~/logger'
import { runWhisperTranscribe } from './stt-local/whisper/run-whisper'
import { runReverbTranscribe } from './stt-local/reverb/run-reverb'
import { runGroqTranscribe } from './stt-services/groq/run-whisper-groq'
import { runElevenLabsTranscribe } from './stt-services/elevenlabs/run-elevenlabs-stt'
import { runDeepgramTranscribe } from './stt-services/deepgram/run-deepgram-stt'
import { runSonioxStt } from './stt-services/soniox/run-soniox-stt'
import { runSpeechmaticsStt } from './stt-services/speechmatics/run-speechmatics-stt'
import { runRevStt } from './stt-services/rev/run-rev-stt'
import { runOpenAIStt } from './stt-services/openai/run-openai-stt'
import { runMistralStt } from './stt-services/mistral/run-mistral-stt'
import { runAssemblyAiTranscribe } from './stt-services/assemblyai/run-assemblyai-stt'
import { runGladiaStt } from './stt-services/gladia/run-gladia-stt'
import { splitAudioFile } from './stt-utils/audio-splitter'
import { formatTranscriptText } from './stt-utils/stt-utils'
import { buildPersistedTranscriptionEvidence, mergeTranscriptionEvidence, serializeEvidenceRawResponse } from './stt-utils/stt-evidence'
import { resolveDiarizationOptions } from './cli'
import { ensureSttTargetSetup as ensureSttTargetSetupViaBroker } from './bootstrap'
import { assertNever } from '~/utils/validate/assert-never'
export { STT_ENGINE_CAPABILITIES, getSttEngineCapabilities, resolveDiarizationOptions } from './cli'

const SPLIT_SEGMENT_DURATION_MINUTES = 10
export const GROQ_MAX_ATTACHMENT_BYTES = 25 * 1024 * 1024
export const OPENAI_MAX_ATTACHMENT_BYTES = 25 * 1024 * 1024
export const SPEECHMATICS_MAX_ATTACHMENT_BYTES = 1 * 1024 * 1024 * 1024
export const REV_MAX_ATTACHMENT_BYTES = 2 * 1024 * 1024 * 1024
export const GLADIA_MAX_ATTACHMENT_BYTES = 1000 * 1024 * 1024

const AUTO_SPLIT_ATTACHMENT_CAP_BYTES: Partial<Record<TranscribeEngine, number>> = {
  groq: GROQ_MAX_ATTACHMENT_BYTES,
  openai: OPENAI_MAX_ATTACHMENT_BYTES,
  speechmatics: SPEECHMATICS_MAX_ATTACHMENT_BYTES,
  rev: REV_MAX_ATTACHMENT_BYTES,
  gladia: GLADIA_MAX_ATTACHMENT_BYTES
}

const SPLIT_RETRY_ON_TOO_LARGE_ENGINES = new Set<TranscribeEngine>([
  'elevenlabs',
  'deepgram',
  'speechmatics',
  'rev',
  'groq',
  'openai',
  'mistral',
  'assemblyai',
  'gladia'
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

const resolveSttEngine = (options: ProcessingOptions): TranscribeEngine => {
  const hasReverb = options.useReverb === true
  const hasElevenlabs = typeof options.elevenlabsSttModel === 'string' && options.elevenlabsSttModel.length > 0
  const hasDeepgram = typeof options.deepgramSttModel === 'string' && options.deepgramSttModel.length > 0
  const hasSoniox = typeof options.sonioxSttModel === 'string' && options.sonioxSttModel.length > 0
  const hasSpeechmatics = typeof options.speechmaticsSttModel === 'string' && options.speechmaticsSttModel.length > 0
  const hasRev = typeof options.revSttModel === 'string' && options.revSttModel.length > 0
  const hasGroq = typeof options.groqSttModel === 'string' && options.groqSttModel.length > 0
  const hasOpenAI = typeof options.openaiSttModel === 'string' && options.openaiSttModel.length > 0
  const hasMistral = typeof options.mistralSttModel === 'string' && options.mistralSttModel.length > 0
  const hasAssemblyAi = typeof options.assemblyaiSttModel === 'string' && options.assemblyaiSttModel.length > 0
  const hasGladia = typeof options.gladiaSttModel === 'string' && options.gladiaSttModel.length > 0

  const engineCount = [hasReverb, hasElevenlabs, hasDeepgram, hasSoniox, hasSpeechmatics, hasRev, hasGroq, hasOpenAI, hasMistral, hasAssemblyAi, hasGladia].filter(Boolean).length
  if (engineCount > 1) {
    throw new Error('Cannot use more than one transcription engine at the same time (--reverb, --elevenlabs-stt, --deepgram-stt, --soniox-stt, --speechmatics-stt, --rev-stt, --groq-stt, --openai-stt, --mistral-stt, --assemblyai-stt, --gladia-stt)')
  }

  if (hasReverb) return 'reverb'
  if (hasElevenlabs) return 'elevenlabs'
  if (hasDeepgram) return 'deepgram'
  if (hasSoniox) return 'soniox'
  if (hasSpeechmatics) return 'speechmatics'
  if (hasRev) return 'rev'
  if (hasGroq) return 'groq'
  if (hasOpenAI) return 'openai'
  if (hasMistral) return 'mistral'
  if (hasAssemblyAi) return 'assemblyai'
  if (hasGladia) return 'gladia'
  return 'whisper'
}

const persistTranscriptionEvidenceArtifacts = async (
  outputDir: string,
  result: TranscriptionResult,
  metadata: Pick<Step2Metadata, 'transcriptionService' | 'transcriptionModel'>
): Promise<void> => {
  const evidence = buildPersistedTranscriptionEvidence(result, metadata)
  await Bun.write(`${outputDir}/transcription.evidence.json`, `${JSON.stringify(evidence, null, 2)}\n`)

  const rawResponse = serializeEvidenceRawResponse(result)
  if (rawResponse !== null) {
    await Bun.write(`${outputDir}/transcription.raw.json`, rawResponse)
  }
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
    segments: segmentResults.flatMap(s => s.result.segments),
    evidence: mergeTranscriptionEvidence(segmentResults.map((segment) => segment.result.evidence))
  }

  const totalProcessingTime = segmentResults.reduce((sum, s) => sum + s.metadata.processingTime, 0)
  const totalTokenCount = segmentResults.reduce((sum, s) => sum + s.metadata.tokenCount, 0)
  const mergedTimings = mergeStep2TimingMetadata(segmentResults.map((segment) => segment.metadata.timings))

  return {
    result: combinedResult,
    metadata: {
      transcriptionService: segmentResults[0]!.metadata.transcriptionService,
      transcriptionModel: segmentResults[0]!.metadata.transcriptionModel,
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
  options: SttTargetOptions
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
  await persistTranscriptionEvidenceArtifacts(outputDir, combined.result, combined.metadata)
  return combined
}

export const sttTarget = async (
  audioPath: string,
  outputDir: string,
  target: SttTarget,
  options: SttTargetOptions
): Promise<{ result: TranscriptionResult, metadata: Step2Metadata }> => {
  await ensureSttTargetSetup(target)

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
    const transcription = await dispatchStt(target, audioPath, outputDir, 0, options)
    await persistTranscriptionEvidenceArtifacts(outputDir, transcription.result, transcription.metadata)
    return transcription
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

export const stt = async (
  audioPath: string,
  options: ProcessingOptions
): Promise<{ result: TranscriptionResult, metadata: Step2Metadata }> => {
  const engine = resolveSttEngine(options)
  const diarizationOptions = resolveDiarizationOptions(options, engine)
  const model = (() => {
    if (engine === 'reverb') return 'reverb'
    if (engine === 'whisper') return options.whisperModel
    if (engine === 'elevenlabs') return options.elevenlabsSttModel as string
    if (engine === 'deepgram') return options.deepgramSttModel as string
    if (engine === 'soniox') return options.sonioxSttModel as string
    if (engine === 'speechmatics') return options.speechmaticsSttModel as string
    if (engine === 'rev') return options.revSttModel as string
    if (engine === 'groq') return options.groqSttModel as string
    if (engine === 'openai') return options.openaiSttModel as string
    if (engine === 'mistral') return options.mistralSttModel as string
    if (engine === 'assemblyai') return options.assemblyaiSttModel as string
    return options.gladiaSttModel as string
  })()
  const target: SttTarget = {
    service: engine,
    model,
    local: engine === 'reverb' || engine === 'whisper',
    diarizationOptions
  }

  return await sttTarget(audioPath, options.outputDir, target, {
    split: options.split,
    reverbVerbatimicity: options.reverbVerbatimicity,
    sttSegmentConcurrency: (options as ProcessingOptions & { sttSegmentConcurrency?: number }).sttSegmentConcurrency,
    runMode: 'initial'
  })
}
