// File: src/text/process-steps/03-run-transcription.ts
import { callWhisper } from '../transcription/whisper.ts'
import { callDeepgram } from '../transcription/deepgram.ts'
import { callAssembly } from '../transcription/assembly.ts'
import { callGroqWhisper } from '../transcription/groq-whisper.ts'
import { callWhisperCoreml } from '../transcription/whisper-coreml.ts'
import { l, err, logInitialFunctionCall } from '@/logging'
import { execPromise } from '@/node-utils'
import type { ProcessingOptions, TranscriptionResult } from '@/types'
import ora from 'ora'
import type { Ora } from 'ora'

export const TRANSCRIPTION_SERVICES_CONFIG = {
  whisper: {
    serviceName: 'Whisper.cpp',
    value: 'whisper',
    label: 'Whisper.cpp',
    models: [
      { modelId: 'tiny', costPerMinuteCents: 0 },
      { modelId: 'tiny.en', costPerMinuteCents: 0 },
      { modelId: 'base', costPerMinuteCents: 0 },
      { modelId: 'base.en', costPerMinuteCents: 0 },
      { modelId: 'small', costPerMinuteCents: 0 },
      { modelId: 'small.en', costPerMinuteCents: 0 },
      { modelId: 'medium', costPerMinuteCents: 0 },
      { modelId: 'medium.en', costPerMinuteCents: 0 },
      { modelId: 'large-v1', costPerMinuteCents: 0 },
      { modelId: 'large-v2', costPerMinuteCents: 0 },
      { modelId: 'large-v3-turbo', costPerMinuteCents: 0 },
      { modelId: 'turbo', costPerMinuteCents: 0 },
    ]
  },
  whisperCoreml: {
    serviceName: 'Whisper.cpp CoreML',
    value: 'whisperCoreml',
    label: 'Whisper CoreML',
    models: [
      { modelId: 'tiny', costPerMinuteCents: 0 },
      { modelId: 'tiny.en', costPerMinuteCents: 0 },
      { modelId: 'base', costPerMinuteCents: 0 },
      { modelId: 'base.en', costPerMinuteCents: 0 },
      { modelId: 'small', costPerMinuteCents: 0 },
      { modelId: 'small.en', costPerMinuteCents: 0 },
      { modelId: 'medium', costPerMinuteCents: 0 },
      { modelId: 'medium.en', costPerMinuteCents: 0 },
      { modelId: 'large-v1', costPerMinuteCents: 0 },
      { modelId: 'large-v2', costPerMinuteCents: 0 },
      { modelId: 'large-v3-turbo', costPerMinuteCents: 0 },
      { modelId: 'turbo', costPerMinuteCents: 0 },
    ]
  },
  deepgram: {
    serviceName: 'Deepgram',
    value: 'deepgram',
    label: 'Deepgram',
    models: [
      { modelId: 'nova-3', costPerMinuteCents: 0.43 },
      { modelId: 'nova-2', costPerMinuteCents: 0.43 },
    ]
  },
  assembly: {
    serviceName: 'AssemblyAI',
    value: 'assembly',
    label: 'AssemblyAI',
    models: [
      { modelId: 'universal', costPerMinuteCents: 0.62 },
      { modelId: 'slam-1', costPerMinuteCents: 0.62 },
      { modelId: 'nano', costPerMinuteCents: 0.2 },
    ]
  },
  groqWhisper: {
    serviceName: 'Groq Whisper',
    value: 'groqWhisper',
    label: 'Groq Whisper',
    models: [
      { modelId: 'whisper-large-v3-turbo', costPerMinuteCents: 0.0667 },
      { modelId: 'distil-whisper-large-v3-en', costPerMinuteCents: 0.0333 },
      { modelId: 'whisper-large-v3', costPerMinuteCents: 0.185 },
    ]
  },
} as const

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

export async function logTranscriptionCost(info: {
  modelId: string
  costPerMinuteCents: number
  filePath: string
}): Promise<number> {
  const p = '[text/process-steps/03-run-transcription]'
  const cmd = `ffprobe -v error -show_entries format=duration -of csv=p=0 "${info.filePath}"`
  const { stdout } = await execPromise(cmd)
  const seconds = parseFloat(stdout.trim())
  if (isNaN(seconds)) {
    throw new Error(`Could not parse audio duration for file: ${info.filePath}`)
  }
  const minutes = seconds / 60
  const cost = info.costPerMinuteCents * minutes
  l.dim(
    `${p} - Estimated Transcription Cost for ${info.modelId}:\n` +
    `    - Audio Length: ${minutes.toFixed(2)} minutes\n` +
    `    - Cost: ¢${cost.toFixed(5)}`
  )
  return cost
}

export async function estimateTranscriptCost(
  options: ProcessingOptions,
  transcriptServices: string
): Promise<number> {
  const filePath = options.transcriptCost
  if (!filePath) throw new Error('No file path provided to estimate transcription cost.')
  if (!['whisper', 'whisperCoreml', 'deepgram', 'assembly', 'groqWhisper'].includes(transcriptServices)) {
    throw new Error(`Unsupported transcription service: ${transcriptServices}`)
  }
  const serviceKey = transcriptServices as 'whisper' | 'whisperCoreml' | 'deepgram' | 'assembly' | 'groqWhisper'
  const config = TRANSCRIPTION_SERVICES_CONFIG[serviceKey]
  let modelInput = typeof options[serviceKey] === 'string' ? options[serviceKey] as string : undefined
  if (options[serviceKey] === true || !modelInput) {
    modelInput = config.models[0]?.modelId
    if (serviceKey === 'deepgram' && !modelInput) modelInput = 'nova-2'
    if (serviceKey === 'assembly' && !modelInput) modelInput = 'universal'
    if ((serviceKey === 'whisper' || serviceKey === 'whisperCoreml') && !modelInput) modelInput = 'base'
    if (serviceKey === 'groqWhisper' && !modelInput) modelInput = 'whisper-large-v3-turbo'
  }
  if (!modelInput) throw new Error(`Could not determine default model for service: ${transcriptServices}`)
  const normalizedModelId = modelInput.toLowerCase()
  const model = config.models.find(m => m.modelId.toLowerCase() === normalizedModelId)
  if (!model) throw new Error(`Model not found for: ${modelInput} in service ${transcriptServices}`)
  const cost = await logTranscriptionCost({
    modelId: model.modelId,
    costPerMinuteCents: model.costPerMinuteCents,
    filePath
  })
  return cost
}