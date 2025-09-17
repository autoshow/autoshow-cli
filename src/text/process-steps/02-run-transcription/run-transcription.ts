import { callWhisper } from './whisper.ts'
import { callDeepgram } from './deepgram.ts'
import { callAssembly } from './assembly.ts'
import { callGroqWhisper } from './groq-whisper.ts'
import { callWhisperCoreml } from './whisper-coreml.ts'
import { callWhisperDiarization } from './whisper-diarization.ts'
import { logTranscriptionCost, estimateTranscriptCost, getAudioDuration } from '../../utils/cost.ts'
import { checkFFmpeg } from '../../utils/setup-helpers.ts'
import { l, err } from '@/logging'
import type { ProcessingOptions, TranscriptionResult } from '@/text/text-types'
import ora from 'ora'
import type { Ora } from 'ora'

async function ensureTranscriptionPrerequisites(): Promise<void> {
  const p = '[text/process-steps/02-run-transcription/run-transcription]'
  l.dim(`${p} Checking transcription prerequisites`)
  
  const hasFFmpeg = await checkFFmpeg()
  if (!hasFFmpeg) {
    l.warn(`${p} ffmpeg not available - audio processing may fail`)
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
      l.warn(`${p} No transcription service specified. Defaulting to whisper.`)
      serviceToUse = 'whisper'
      if (options.whisper === undefined) options.whisper = true
    }
  }

  l.dim(`${p} Using transcription service: ${serviceToUse}`)
  
  const audioFilePath = `${finalPath}.wav`
  let audioDuration: number
  
  try {
    audioDuration = await getAudioDuration(audioFilePath)
    l.dim(`${p} Audio duration: ${audioDuration} seconds`)
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
        l.dim(`${p} Starting whisper-diarization transcription`)
        const result = await retryTranscriptionCall<TranscriptionResult>(
          () => callWhisperDiarization(options, finalPath),
          spinner
        )
        finalTranscript = result.transcript
        finalModelId = result.modelId
        finalCostPerMinuteCents = result.costPerMinuteCents
        break
      }
      case 'deepgram': {
        l.dim(`${p} Starting Deepgram transcription`)
        const result = await retryTranscriptionCall<TranscriptionResult>(
          () => callDeepgram(options, finalPath),
          spinner
        )
        finalTranscript = result.transcript
        finalModelId = result.modelId
        finalCostPerMinuteCents = result.costPerMinuteCents
        break
      }
      case 'assembly': {
        l.dim(`${p} Starting AssemblyAI transcription`)
        const result = await retryTranscriptionCall<TranscriptionResult>(
          () => callAssembly(options, finalPath),
          spinner
        )
        finalTranscript = result.transcript
        finalModelId = result.modelId
        finalCostPerMinuteCents = result.costPerMinuteCents
        break
      }
      case 'whisper': {
        l.dim(`${p} Starting whisper transcription`)
        const result = await retryTranscriptionCall<TranscriptionResult>(
          () => callWhisper(options, finalPath, spinner),
          spinner
        )
        finalTranscript = result.transcript
        finalModelId = result.modelId
        finalCostPerMinuteCents = result.costPerMinuteCents
        break
      }
      case 'whisperCoreml': {
        l.dim(`${p} Starting whisper CoreML transcription`)
        const result = await retryTranscriptionCall<TranscriptionResult>(
          () => callWhisperCoreml(options, finalPath, spinner),
          spinner
        )
        finalTranscript = result.transcript
        finalModelId = result.modelId
        finalCostPerMinuteCents = result.costPerMinuteCents
        break
      }
      case 'groqWhisper': {
        l.dim(`${p} Starting Groq whisper transcription`)
        const result = await retryTranscriptionCall<TranscriptionResult>(
          () => callGroqWhisper(options, finalPath),
          spinner
        )
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
    
    if (serviceToUse === 'whisperCoreml') {
      l.warn(`${p} Attempting automatic fallback from whisperCoreml to whisper`)
      try {
        const fallbackOptions = { ...options, whisper: true }
        const fallbackResult = await retryTranscriptionCall<TranscriptionResult>(
          () => callWhisper(fallbackOptions, finalPath, ora('Step 2 - Run Transcription (fallback)').start()),
          undefined
        )
        l.success(`${p} Fallback transcription completed successfully`)
        return {
          transcript: fallbackResult.transcript,
          modelId: fallbackResult.modelId,
          costPerMinuteCents: fallbackResult.costPerMinuteCents,
          audioDuration
        }
      } catch (fallbackError) {
        err(`${p} Fallback transcription also failed: ${(fallbackError as Error).message}`)
        throw error
      }
    }
    
    throw error
  }
}

export async function retryTranscriptionCall<T>(
  fn: () => Promise<T>,
  spinner?: Ora
): Promise<T> {
  const p = '[text/process-steps/02-run-transcription/run-transcription]'
  const maxRetries = 3
  let attempt = 0

  while (attempt < maxRetries) {
    try {
      attempt++
      const result = await fn()
      return result
    } catch (error) {
      const errorMessage = (error as Error).message
      err(`${p} Attempt ${attempt} failed: ${errorMessage}`)
      
      if (errorMessage.includes('automatically setup')) {
        l.dim(`${p} Automatic setup was attempted but failed`)
      }
      
      if (errorMessage.includes('CoreML') && errorMessage.includes('missing')) {
        l.warn(`${p} CoreML environment issue detected, will not retry CoreML`)
        throw error
      }
      
      if (errorMessage.includes('whisper-diarization') && errorMessage.includes('missing')) {
        l.warn(`${p} Whisper-diarization environment issue detected, will not retry`)
        throw error
      }
      
      if (errorMessage.includes('ctc_forced_aligner') || errorMessage.includes('ModuleNotFoundError')) {
        l.warn(`${p} Missing required dependencies for whisper-diarization, will not retry`)
        throw error
      }
      
      if (errorMessage.includes('yt-dlp') && errorMessage.includes('ENOENT')) {
        l.warn(`${p} yt-dlp not found, this is a system issue`)
        throw error
      }
      
      if (attempt >= maxRetries) {
        err(`${p} Max retries (${maxRetries}) reached. Aborting transcription.`)
        throw error
      }
      
      const delayMs = 1000 * 2 ** (attempt - 1)
      l.dim(`${p} Retrying in ${delayMs / 1000} seconds...`)
      if (spinner) {
        spinner.text = `Step 2 - Run Transcription (retrying in ${delayMs / 1000}s...)`
      }
      await new Promise((resolve) => setTimeout(resolve, delayMs))
    }
  }
  throw new Error('Transcription call failed after maximum retries.')
}

export { logTranscriptionCost, estimateTranscriptCost }