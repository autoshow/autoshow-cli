import { callWhisper } from './whisper.ts'
import { callDeepgram } from './deepgram.ts'
import { callAssembly } from './assembly.ts'
import { callGroqWhisper } from './groq-whisper.ts'
import { callWhisperCoreml } from './whisper-coreml.ts'
import { callWhisperDiarization } from './whisper-diarization.ts'
import { logTranscriptionCost, estimateTranscriptCost } from '../../utils/cost.ts'
import { checkFFmpeg, getAudioDuration } from '../../utils/setup-helpers.ts'
import { l, err } from '@/logging'
import type { ProcessingOptions, TranscriptionResult } from '@/text/text-types'
import ora from 'ora'

async function ensureTranscriptionPrerequisites(): Promise<void> {
  const hasFFmpeg = await checkFFmpeg()
  if (!hasFFmpeg) {
    l.warn('ffmpeg not available - audio processing may fail')
  }
}

export async function runTranscription(
  options: ProcessingOptions,
  finalPath: string,
  transcriptServicesInput?: string
): Promise<TranscriptionResult> {
  const p = '[text/process-steps/02-run-transcription/run-transcription]'
  const spinner = ora('Step 2 - Run Transcription').start()
  
  await ensureTranscriptionPrerequisites()

  let serviceToUse = transcriptServicesInput
  if (!serviceToUse) {
    if (options.whisperDiarization) {
      serviceToUse = 'whisperDiarization'
    } else if (options.whisperCoreml) {
      serviceToUse = 'whisperCoreml'
    } else if (options.whisper) {
      serviceToUse = 'whisper'
    } else if (options.deepgram) {
      serviceToUse = 'deepgram'
    } else if (options.assembly) {
      serviceToUse = 'assembly'
    } else if (options.groqWhisper) {
      serviceToUse = 'groqWhisper'
    } else {
      l.warn('No transcription service specified. Defaulting to whisper.')
      serviceToUse = 'whisper'
      if (options.whisper === undefined) options.whisper = true
    }
  }
  
  const audioFilePath = `${finalPath}.wav`
  let audioDuration: number
  
  try {
    audioDuration = await getAudioDuration(audioFilePath)
  } catch (error) {
    err(`${p} Error getting audio duration: ${(error as Error).message}`)
    audioDuration = 0
  }
  
  let finalTranscript = ''
  let finalModelId = ''
  let finalCostPerMinuteCents = 0

  try {
    switch (serviceToUse) {
      case 'whisperDiarization': {
        const result = await callWhisperDiarization(options, finalPath)
        finalTranscript = result.transcript
        finalModelId = result.modelId
        finalCostPerMinuteCents = result.costPerMinuteCents
        break
      }
      case 'deepgram': {
        const result = await callDeepgram(options, finalPath)
        finalTranscript = result.transcript
        finalModelId = result.modelId
        finalCostPerMinuteCents = result.costPerMinuteCents
        break
      }
      case 'assembly': {
        const result = await callAssembly(options, finalPath)
        finalTranscript = result.transcript
        finalModelId = result.modelId
        finalCostPerMinuteCents = result.costPerMinuteCents
        break
      }
      case 'whisper': {
        const result = await callWhisper(options, finalPath, spinner)
        finalTranscript = result.transcript
        finalModelId = result.modelId
        finalCostPerMinuteCents = result.costPerMinuteCents
        break
      }
      case 'whisperCoreml': {
        const result = await callWhisperCoreml(options, finalPath, spinner)
        finalTranscript = result.transcript
        finalModelId = result.modelId
        finalCostPerMinuteCents = result.costPerMinuteCents
        break
      }
      case 'groqWhisper': {
        const result = await callGroqWhisper(options, finalPath)
        finalTranscript = result.transcript
        finalModelId = result.modelId
        finalCostPerMinuteCents = result.costPerMinuteCents
        break
      }
      default:
        spinner.fail(`Transcription failed: Unknown service resolved to '${serviceToUse}'`)
        throw new Error(`Unknown transcription service: ${serviceToUse}`)
    }

    spinner.succeed('Transcription completed successfully.')
    return {
      transcript: finalTranscript,
      modelId: finalModelId,
      costPerMinuteCents: finalCostPerMinuteCents,
      audioDuration
    }
  } catch (error) {
    spinner.fail('Transcription failed.')
    err(`${p} Error during runTranscription: ${(error as Error).message}`)
    throw error
  }
}

export { logTranscriptionCost, estimateTranscriptCost }