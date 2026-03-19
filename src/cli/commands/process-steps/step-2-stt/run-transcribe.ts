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

const TRANSCRIBE_ENGINE_CAPABILITIES = {
  reverb: { supportsSpeakerCountHint: false },
  elevenlabs: { supportsSpeakerCountHint: true },
  groq: { supportsSpeakerCountHint: false },
  openai: { supportsSpeakerCountHint: true },
  mistral: { supportsSpeakerCountHint: false },
  assemblyai: { supportsSpeakerCountHint: true },
  whisper: { supportsSpeakerCountHint: false }
} as const satisfies Record<TranscribeEngine, TranscribeEngineCapabilities>

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

const resolveDiarizationOptions = (
  options: ProcessingOptions,
  engine: TranscribeEngine
): DiarizationOptions | undefined => {
  const speakerCount = options.diarizationSpeakerCount
  if (speakerCount === undefined) {
    return undefined
  }

  const capabilities = TRANSCRIBE_ENGINE_CAPABILITIES[engine]
  if (!capabilities.supportsSpeakerCountHint) {
    if (engine === 'mistral') {
      l.warn(`Ignoring --speaker-count=${speakerCount} for Mistral because speaker-count hints are unsupported; enabling diarization without a count hint`)
      return {}
    }
    l.warn(`Ignoring --speaker-count=${speakerCount} because the ${engine} transcription engine does not support speaker-count hints`)
    return undefined
  }

  return { speakerCount }
}

const dispatchTranscribe = async (
  engine: TranscribeEngine,
  audioPath: string,
  outputDir: string,
  segmentOffsetMinutes: number,
  options: ProcessingOptions,
  diarizationOptions: DiarizationOptions | undefined,
  segmentNumber?: number,
  totalSegments?: number
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

  if (options.split) {
    const segmentPaths = await splitAudioFile(audioPath, options.outputDir, 10)

    const segmentResults: Array<{ result: TranscriptionResult, metadata: Step2Metadata }> = []

    for (let i = 0; i < segmentPaths.length; i++) {
      const segmentPath = segmentPaths[i]!
      const segmentNumber = i + 1
      const offsetMinutes = i * 10

      const segmentData = await dispatchTranscribe(
        engine, segmentPath, options.outputDir, offsetMinutes,
        options, diarizationOptions, segmentNumber, segmentPaths.length
      )

      segmentResults.push(segmentData)
    }

    const combinedResult = {
      text: segmentResults.map(s => s.result.text).join(' '),
      segments: segmentResults.flatMap(s => s.result.segments)
    }

    const finalTranscriptPath = `${options.outputDir}/transcription.txt`
    const formattedTranscript = combinedResult.segments
      .map(seg => {
        const speakerPrefix = seg.speaker ? `[${seg.speaker}] ` : ''
        return `[${seg.start}] ${speakerPrefix}${seg.text}`
      })
      .join('\n')

    await Bun.write(finalTranscriptPath, formattedTranscript)

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

  return await dispatchTranscribe(engine, audioPath, options.outputDir, 0, options, diarizationOptions)
}
