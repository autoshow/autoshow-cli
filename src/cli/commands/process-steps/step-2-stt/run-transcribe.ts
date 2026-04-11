import type { ProcessingOptions, TranscriptionResult, Step2Metadata, DiarizationOptions } from '~/types'
import * as l from '~/logger'
import { runWhisperTranscribe } from './stt-local/whisper/run-whisper'
import { runReverbTranscribe } from './stt-local/reverb/run-reverb'
import { runGroqTranscribe } from './stt-services/groq/run-whisper-groq'
import { runElevenLabsTranscribe } from './stt-services/elevenlabs/run-elevenlabs-stt'
import { runOpenAIStt } from './stt-services/openai/run-openai-stt'
import { runMistralStt } from './stt-services/mistral/run-mistral-stt'
import { runAssemblyAiTranscribe } from './stt-services/assemblyai/run-assemblyai-stt'
import { splitAudioFile } from './stt-utils/audio-splitter'
import { formatTranscriptText } from './stt-utils/transcription-utils'
import { fileExists } from '~/utils/cli-utils'
import { ensureReverbRuntimeSetup } from '~/cli/commands/process-steps/step-2-stt/stt-local/reverb/reverb'
import { ensureWhisperReady } from '~/cli/commands/process-steps/step-2-stt/stt-local/whisper/whisper'
import { ensureElevenLabsSttSetup } from '~/cli/commands/process-steps/step-2-stt/stt-services/elevenlabs/elevenlabs'
import { ensureOpenAISttSetup } from '~/cli/commands/process-steps/step-2-stt/stt-services/openai/openai'
import { ensureMistralSttSetup } from '~/cli/commands/process-steps/step-2-stt/stt-services/mistral/mistral'
import { ensureAssemblyAiSttSetup } from '~/cli/commands/process-steps/step-2-stt/stt-services/assemblyai/assemblyai'
import { reverbUvEnvDir, reverbModelPath, reverbConfigPath, whisperBinaryPath, whisperModelsDir } from '~/cli/commands/process-steps/step-0-setup/setup-orchestrator/run-complete-setup'
import { assertNever } from '~/utils/validate/assert-never'
import type { TranscribeEngine, TranscribeEngineCapabilities } from '~/types'
import { CLIUsageError } from '~/utils/error-handler'

const TRANSCRIBE_ENGINE_CAPABILITIES = {
  reverb: { supportsSpeakerCountHint: false, supportsKnownSpeakerReferences: false },
  elevenlabs: { supportsSpeakerCountHint: true, supportsKnownSpeakerReferences: false },
  groq: { supportsSpeakerCountHint: false, supportsKnownSpeakerReferences: false },
  openai: { supportsSpeakerCountHint: false, supportsKnownSpeakerReferences: true },
  mistral: { supportsSpeakerCountHint: false, supportsKnownSpeakerReferences: false },
  assemblyai: { supportsSpeakerCountHint: true, supportsKnownSpeakerReferences: false },
  whisper: { supportsSpeakerCountHint: false, supportsKnownSpeakerReferences: false }
} as const satisfies Record<TranscribeEngine, TranscribeEngineCapabilities>

const SPLIT_SEGMENT_DURATION_MINUTES = 10
export const GROQ_MAX_ATTACHMENT_BYTES = 25 * 1024 * 1024
export const OPENAI_MAX_ATTACHMENT_BYTES = 25 * 1024 * 1024

const AUTO_SPLIT_ATTACHMENT_CAP_BYTES: Partial<Record<TranscribeEngine, number>> = {
  groq: GROQ_MAX_ATTACHMENT_BYTES,
  openai: OPENAI_MAX_ATTACHMENT_BYTES
}

const SPLIT_RETRY_ON_TOO_LARGE_ENGINES = new Set<TranscribeEngine>([
  'elevenlabs',
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
  const hasGroq = typeof options.groqSttModel === 'string' && options.groqSttModel.length > 0
  const hasOpenAI = typeof options.openaiSttModel === 'string' && options.openaiSttModel.length > 0
  const hasMistral = typeof options.mistralSttModel === 'string' && options.mistralSttModel.length > 0
  const hasAssemblyAi = typeof options.assemblyaiSttModel === 'string' && options.assemblyaiSttModel.length > 0

  const engineCount = [hasReverb, hasElevenlabs, hasGroq, hasOpenAI, hasMistral, hasAssemblyAi].filter(Boolean).length
  if (engineCount > 1) {
    throw new Error('Cannot use more than one transcription engine at the same time (--reverb, --elevenlabs-stt, --groq-stt, --openai-stt, --mistral-stt, --assemblyai-stt)')
  }

  if (hasReverb) return 'reverb'
  if (hasElevenlabs) return 'elevenlabs'
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
  const diarizationOptions: DiarizationOptions = {}

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
    if (engine === 'mistral') {
      l.warn(`Ignoring --speaker-count=${speakerCount} for Mistral because speaker-count hints are unsupported; enabling diarization without a count hint`)
      return Object.keys(diarizationOptions).length > 0 ? diarizationOptions : {}
    }
    if (engine === 'openai') {
      l.warn(`Ignoring --speaker-count=${speakerCount} for OpenAI because count-only diarization hints are unsupported; use --speaker-name with matching --speaker-reference clips instead`)
      return Object.keys(diarizationOptions).length > 0 ? diarizationOptions : undefined
    }
    l.warn(`Ignoring --speaker-count=${speakerCount} because the ${engine} transcription engine does not support speaker-count hints`)
    return Object.keys(diarizationOptions).length > 0 ? diarizationOptions : undefined
  }

  diarizationOptions.speakerCount = speakerCount
  return diarizationOptions
}

const dispatchTranscribe = async (
  engine: TranscribeEngine,
  audioPath: string,
  outputDir: string,
  segmentOffsetMinutes: number,
  options: ProcessingOptions,
  diarizationOptions: DiarizationOptions | undefined,
  segmentNumber?: number,
  totalSegments?: number,
  whisperProgress?:
    | {
      segmentStartSeconds: number
      segmentDurationSeconds: number
      totalDurationSeconds: number
    }
    | undefined
): Promise<{ result: TranscriptionResult, metadata: Step2Metadata }> => {
  if (engine === 'reverb') {
    return await runReverbTranscribe(audioPath, outputDir, {
      segmentOffsetMinutes,
      segmentNumber,
      totalSegments,
      reverbVerbatimicity: options.reverbVerbatimicity
    })
  }

  if (engine === 'elevenlabs') {
    return await runElevenLabsTranscribe(audioPath, outputDir, {
      model: options.elevenlabsSttModel as string,
      segmentOffsetMinutes,
      segmentNumber,
      totalSegments,
      diarizationOptions
    })
  }

  if (engine === 'groq') {
    return await runGroqTranscribe(audioPath, outputDir, {
      model: options.groqSttModel as string,
      segmentOffsetMinutes,
      segmentNumber,
      totalSegments
    })
  }

  if (engine === 'whisper') {
    return await runWhisperTranscribe(audioPath, outputDir, {
      model: options.whisperModel,
      segmentOffsetMinutes,
      segmentNumber,
      totalSegments,
      segmentStartSeconds: whisperProgress?.segmentStartSeconds,
      segmentDurationSeconds: whisperProgress?.segmentDurationSeconds,
      totalDurationSeconds: whisperProgress?.totalDurationSeconds,
      preserveJson: true
    })
  }

  if (engine === 'openai') {
    return await runOpenAIStt(audioPath, outputDir, {
      model: options.openaiSttModel as string,
      segmentOffsetMinutes,
      segmentNumber,
      totalSegments,
      diarizationOptions
    })
  }

  if (engine === 'mistral') {
    return await runMistralStt(audioPath, outputDir, {
      model: options.mistralSttModel as string,
      segmentOffsetMinutes,
      segmentNumber,
      totalSegments,
      diarizationOptions
    })
  }

  if (engine === 'assemblyai') {
    return await runAssemblyAiTranscribe(audioPath, outputDir, {
      model: options.assemblyaiSttModel as string,
      segmentOffsetMinutes,
      segmentNumber,
      totalSegments,
      diarizationOptions
    })
  }

  assertNever(engine)
}

const runSplitTranscription = async (
  engine: TranscribeEngine,
  audioPath: string,
  options: ProcessingOptions,
  diarizationOptions: DiarizationOptions | undefined
): Promise<{ result: TranscriptionResult, metadata: Step2Metadata }> => {
  const segmentDescriptors = await splitAudioFile(audioPath, options.outputDir, SPLIT_SEGMENT_DURATION_MINUTES)
  const totalDurationSeconds = segmentDescriptors.reduce((sum, segment) => sum + segment.durationSeconds, 0)

  const segmentResults: Array<{ result: TranscriptionResult, metadata: Step2Metadata }> = []

  for (let i = 0; i < segmentDescriptors.length; i++) {
    const segmentDescriptor = segmentDescriptors[i]!
    const offsetMinutes = segmentDescriptor.startSeconds / 60

    const segmentData = await dispatchTranscribe(
      engine, segmentDescriptor.path, options.outputDir, offsetMinutes,
      options, diarizationOptions, segmentDescriptor.segmentNumber, segmentDescriptor.totalSegments, {
        segmentStartSeconds: segmentDescriptor.startSeconds,
        segmentDurationSeconds: segmentDescriptor.durationSeconds,
        totalDurationSeconds
      }
    )

    segmentResults.push(segmentData)
  }

  const combinedResult = {
    text: segmentResults.map(s => s.result.text).join(' '),
    segments: segmentResults.flatMap(s => s.result.segments)
  }

  await Bun.write(`${options.outputDir}/transcription.txt`, formatTranscriptText(combinedResult.segments))

  const totalProcessingTime = segmentResults.reduce((sum, s) => sum + s.metadata.processingTime, 0)
  const totalTokenCount = segmentResults.reduce((sum, s) => sum + s.metadata.tokenCount, 0)

  const combinedMetadata: Step2Metadata = {
    transcriptionService: segmentResults[0]!.metadata.transcriptionService,
    transcriptionModel: segmentResults[0]!.metadata.transcriptionModel,
    transcriptionModelName: segmentResults[0]!.metadata.transcriptionModelName,
    processingTime: totalProcessingTime,
    tokenCount: totalTokenCount
  }

  return { result: combinedResult, metadata: combinedMetadata }
}

export const transcribe = async (
  audioPath: string,
  options: ProcessingOptions
): Promise<{ result: TranscriptionResult, metadata: Step2Metadata }> => {

  const engine = resolveTranscribeEngine(options)
  const diarizationOptions = resolveDiarizationOptions(options, engine)

  if (engine === 'reverb') {
    await ensureReverbSetup()
  }
  if (engine === 'elevenlabs') {
    await ensureElevenLabsSttSetup()
  }
  if (engine === 'openai') {
    await ensureOpenAISttSetup()
  }
  if (engine === 'mistral') {
    await ensureMistralSttSetup()
  }
  if (engine === 'assemblyai') {
    await ensureAssemblyAiSttSetup()
  }
  if (engine === 'whisper') {
    await ensureWhisperSetup(options.whisperModel)
  }

  const audioFileSize = Bun.file(audioPath).size
  if (shouldSplitTranscriptionInput(engine, audioFileSize, options.split === true)) {
    const attachmentCapBytes = AUTO_SPLIT_ATTACHMENT_CAP_BYTES[engine]
    if (options.split !== true && attachmentCapBytes !== undefined) {
      const inputFilename = audioPath.split('/').pop() || 'audio'
      l.warn(`${engine[0]!.toUpperCase()}${engine.slice(1)} file uploads are capped at ${formatBytes(attachmentCapBytes)}; ${inputFilename} is ${formatBytes(audioFileSize)}. Splitting into ${SPLIT_SEGMENT_DURATION_MINUTES}-minute segments automatically`)
    }

    return await runSplitTranscription(engine, audioPath, options, diarizationOptions)
  }

  try {
    return await dispatchTranscribe(engine, audioPath, options.outputDir, 0, options, diarizationOptions)
  } catch (error) {
    if (shouldRetrySplitTranscriptionAfterError(engine, options.split === true, error)) {
      l.warn(`${engine[0]!.toUpperCase()}${engine.slice(1)} rejected the upload as too large. Retrying with ${SPLIT_SEGMENT_DURATION_MINUTES}-minute split transcription`)
      return await runSplitTranscription(engine, audioPath, options, diarizationOptions)
    }

    throw error
  }
}
