import { callWhisper } from '../transcription/whisper.ts'
import { callDeepgram } from '../transcription/deepgram.ts'
import { callAssembly } from '../transcription/assembly.ts'
import { callGroqWhisper } from '../transcription/groq-whisper.ts'
import { callWhisperCoreml } from '../transcription/whisper-coreml.ts'
import { logTranscriptionCost, estimateTranscriptCost } from '../utils/cost.ts'
import { l, err, logInitialFunctionCall } from '@/logging'
import type { ProcessingOptions, TranscriptionResult } from '@/types'
import ora from 'ora'
import type { Ora } from 'ora'

export async function runTranscription(
  options: ProcessingOptions,
  finalPath: string,
  transcriptServicesInput?: string
): Promise<TranscriptionResult> {
  const p = '[text/process-steps/03-run-transcription]'
  const spinner = ora('Step 3 - Run Transcription').start()
  logInitialFunctionCall('runTranscription', { options, finalPath, transcriptServicesInput })
  let serviceToUse = transcriptServicesInput
  if (!serviceToUse) {
    if (options.whisperCoreml) {
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
  l.dim(`${p} Transcription service to use: ${serviceToUse}`)
  let finalTranscript = ''
  let finalModelId = ''
  let finalCostPerMinuteCents = 0
  try {
    switch (serviceToUse) {
      case 'deepgram': {
        const result = await retryTranscriptionCall<TranscriptionResult>(
          () => callDeepgram(options, finalPath)
        )
        finalTranscript = result.transcript
        finalModelId = result.modelId
        finalCostPerMinuteCents = result.costPerMinuteCents
        break
      }
      case 'assembly': {
        const result = await retryTranscriptionCall<TranscriptionResult>(
          () => callAssembly(options, finalPath)
        )
        finalTranscript = result.transcript
        finalModelId = result.modelId
        finalCostPerMinuteCents = result.costPerMinuteCents
        break
      }
      case 'whisper': {
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
        const result = await retryTranscriptionCall<TranscriptionResult>(
          () => callGroqWhisper(options, finalPath)
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
      costPerMinuteCents: finalCostPerMinuteCents
    }
  } catch (error) {
    spinner.fail('Transcription failed.')
    err(`${p} Error during runTranscription: ${(error as Error).message}`)
    throw error
  }
}

export async function retryTranscriptionCall<T>(
  fn: () => Promise<T>,
  spinner?: Ora
): Promise<T> {
  const p = '[text/process-steps/03-run-transcription]'
  const maxRetries = 7
  let attempt = 0
  while (attempt < maxRetries) {
    try {
      attempt++
      const result = await fn()
      l.dim(`${p} Transcription call completed successfully on attempt ${attempt}.`)
      return result
    } catch (error) {
      err(`${p} Attempt ${attempt} failed: ${(error as Error).message}`)
      if (attempt >= maxRetries) {
        err(`${p} Max retries (${maxRetries}) reached. Aborting transcription.`)
        throw error
      }
      const delayMs = 1000 * 2 ** (attempt - 1)
      l.dim(`${p} Retrying in ${delayMs / 1000} seconds...`)
      if (spinner) {
        spinner.text = `Step 3 - Run Transcription (retrying in ${delayMs / 1000}s...)`
      }
      await new Promise((resolve) => setTimeout(resolve, delayMs))
    }
  }
  throw new Error('Transcription call failed after maximum retries.')
}

export { logTranscriptionCost, estimateTranscriptCost }