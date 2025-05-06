// src/process-steps/03-run-transcription.ts

import { callWhisper } from '../transcription/whisper.ts'
import { callDeepgram } from '../transcription/deepgram.ts'
import { callAssembly } from '../transcription/assembly.ts'
import { l, err, logInitialFunctionCall } from '../utils/logging.ts'
import { execPromise } from '../utils/node-utils.ts'
import { TRANSCRIPTION_SERVICES_CONFIG } from '../utils/constants.ts'
import type { ProcessingOptions, TranscriptionResult } from '../utils/types.ts'
import ora from 'ora'

export async function runTranscription(
  options: ProcessingOptions,
  finalPath: string,
  transcriptServices?: string
) {
  const spinner = ora('Step 3 - Run Transcription').start()
  logInitialFunctionCall('runTranscription', { options, finalPath, transcriptServices })

  let finalTranscript = ''
  let finalModelId = ''
  let finalCostPerMinuteCents = 0

  try {
    switch (transcriptServices) {
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
          () => callWhisper(options, finalPath)
        )

        finalTranscript = result.transcript
        finalModelId = result.modelId
        finalCostPerMinuteCents = result.costPerMinuteCents
        break
      }

      default:
        throw new Error(`Unknown transcription service: ${transcriptServices}`)
    }

    spinner.succeed('Transcription completed successfully.')

    const transcriptionCost = await logTranscriptionCost({
      modelId: finalModelId,
      costPerMinuteCents: finalCostPerMinuteCents,
      filePath: `${finalPath}.wav`
    })

    return {
      transcript: finalTranscript,
      transcriptionCost,
      modelId: finalModelId,
      costPerMinuteCents: finalCostPerMinuteCents
    }
  } catch (error) {
    err(`Error during runTranscription: ${(error as Error).message}`)
    throw error
  }
}

export async function retryTranscriptionCall<T>(
  fn: () => Promise<T>
) {
  const maxRetries = 7
  let attempt = 0

  while (attempt < maxRetries) {
    try {
      attempt++
      const result = await fn()
      l.dim(`  Transcription call completed successfully on attempt ${attempt}.`)
      return result
    } catch (error) {
      err(`  Attempt ${attempt} failed: ${(error as Error).message}`)
      if (attempt >= maxRetries) {
        err(`  Max retries (${maxRetries}) reached. Aborting transcription.`)
        throw error
      }
      const delayMs = 1000 * 2 ** (attempt - 1)
      l.dim(`  Retrying in ${delayMs / 1000} seconds...`)
      await new Promise((resolve) => setTimeout(resolve, delayMs))
    }
  }

  throw new Error('Transcription call failed after maximum retries.')
}

export async function logTranscriptionCost(info: {
  modelId: string
  costPerMinuteCents: number
  filePath: string
}) {
  const cmd = `ffprobe -v error -show_entries format=duration -of csv=p=0 "${info.filePath}"`
  const { stdout } = await execPromise(cmd)
  const seconds = parseFloat(stdout.trim())
  if (isNaN(seconds)) {
    throw new Error(`Could not parse audio duration for file: ${info.filePath}`)
  }
  const minutes = seconds / 60
  const cost = info.costPerMinuteCents * minutes

  l.dim(
    `  - Estimated Transcription Cost for ${info.modelId}:\n` +
    `    - Audio Length: ${minutes.toFixed(2)} minutes\n` +
    `    - Cost: ¢${cost.toFixed(5)}`
  )

  return cost
}

export async function estimateTranscriptCost(
  options: ProcessingOptions,
  transcriptServices: string
) {
  const filePath = options.transcriptCost
  if (!filePath) throw new Error('No file path provided to estimate transcription cost.')

  if (!['whisper', 'deepgram', 'assembly'].includes(transcriptServices)) {
    throw new Error(`Unsupported transcription service: ${transcriptServices}`)
  }

  const config = TRANSCRIPTION_SERVICES_CONFIG[transcriptServices as 'whisper' | 'deepgram' | 'assembly']
  const optionValue = options[transcriptServices as 'whisper' | 'deepgram' | 'assembly']
  const defaultModelId = transcriptServices === 'deepgram'
    ? 'nova-2'
    : transcriptServices === 'assembly'
    ? 'best'
    : 'base'
  const modelInput = typeof optionValue === 'string' ? optionValue : defaultModelId
  const normalizedModelId = modelInput.toLowerCase()
  const model = config.models.find(m => m.modelId === normalizedModelId)

  if (!model) throw new Error(`Model not found for: ${modelInput}`)

  const cost = await logTranscriptionCost({
    modelId: model.modelId,
    costPerMinuteCents: model.costPerMinuteCents,
    filePath
  })

  return cost
}