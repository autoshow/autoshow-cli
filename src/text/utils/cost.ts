import chalk from 'chalk'
import { l } from '@/logging'
import { execPromise } from '@/node-utils'
import { TRANSCRIPTION_SERVICES_CONFIG } from '../process-steps/02-run-transcription/transcription-models'
import { LLM_SERVICES_CONFIG } from '../process-steps/04-run-llm/llm-models'
import type { ProcessingOptions } from '@/text/text-types'

export async function getAudioDuration(filePath: string): Promise<number> {
  const cmd = `ffprobe -v error -show_entries format=duration -of csv=p=0 "${filePath}"`
  const { stdout } = await execPromise(cmd)
  const seconds = parseFloat(stdout.trim())
  if (isNaN(seconds)) {
    throw new Error(`Could not parse audio duration for file: ${filePath}`)
  }
  return seconds
}

export async function logTranscriptionCost(info: {
  modelId: string
  costPerMinuteCents: number
  filePath: string
}): Promise<number> {
  const seconds = await getAudioDuration(info.filePath)
  const minutes = seconds / 60
  const cost = info.costPerMinuteCents * minutes
  l.dim(
    `Transcription Cost - Model: ${info.modelId}, Duration: ${minutes.toFixed(2)} min, Cost: ¢${cost.toFixed(5)}`
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

export function formatCost(cost: number | undefined): string {
  if (cost === undefined) return 'N/A'
  if (cost === 0) return '0¢'
  const costInCents = cost * 100
  if (costInCents < 1) {
    return `¢${costInCents.toFixed(4)}`
  }
  if (cost < 1) {
    return `¢${costInCents.toFixed(2)}`
  }
  return `$${cost.toFixed(2)}`
}

export function logLLMCost(info: {
  name: string
  stopReason: string
  tokenUsage: {
    input: number | undefined
    output: number | undefined
    total: number | undefined
  }
}): {
  inputCost?: number
  outputCost?: number
  totalCost?: number
} {
  const { name, stopReason, tokenUsage } = info
  const { input, output, total } = tokenUsage
  
  let modelConfig: {
    modelId: string
    modelName: string
    inputCostPer1M?: number
    outputCostPer1M?: number
    inputCostPer1MCents?: number
    outputCostPer1MCents?: number
  } | undefined
  
  for (const service of Object.values(LLM_SERVICES_CONFIG)) {
    for (const model of service.models) {
      if (
        model.modelId === name ||
        model.modelId.toLowerCase() === name.toLowerCase()
      ) {
        modelConfig = model
        break
      }
    }
    if (modelConfig) break
  }
  
  const {
    modelName,
    inputCostPer1M,
    outputCostPer1M,
    inputCostPer1MCents,
    outputCostPer1MCents
  } = modelConfig ?? {}
  
  const displayName = modelName ?? name
  
  const tokenLines: string[] = []
  if (input) tokenLines.push(`${input} input tokens`)
  if (output) tokenLines.push(`${output} output tokens`)
  if (total) tokenLines.push(`${total} total tokens`)
  
  let inputCost: number | undefined
  let outputCost: number | undefined
  let totalCost: number | undefined
  
  if (!modelConfig) {
    console.warn(`Warning: Could not find cost configuration for model: ${modelName}`)
  } else {
    const inCost = (typeof inputCostPer1MCents === 'number')
      ? inputCostPer1MCents / 100
      : (inputCostPer1M || 0)
    const outCost = (typeof outputCostPer1MCents === 'number')
      ? outputCostPer1MCents / 100
      : (outputCostPer1M || 0)
    
    if (inCost < 0.0000001 && outCost < 0.0000001) {
      inputCost = 0
      outputCost = 0
      totalCost = 0
    } else {
      if (input) {
        const rawInputCost = (input / 1_000_000) * inCost
        inputCost = Math.abs(rawInputCost) < 0.00001 ? 0 : rawInputCost
      }
      if (output) {
        const rawOutputCost = (output / 1_000_000) * outCost
        outputCost = Math.abs(rawOutputCost) < 0.00001 ? 0 : rawOutputCost
      }
      if (inputCost !== undefined && outputCost !== undefined) {
        totalCost = inputCost + outputCost
      }
    }
  }
  
  const costLines: string[] = []
  if (inputCost !== undefined) {
    costLines.push(`Input: ${formatCost(inputCost)}`)
  }
  if (outputCost !== undefined) {
    costLines.push(`Output: ${formatCost(outputCost)}`)
  }
  if (totalCost !== undefined) {
    costLines.push(`Total: ${chalk.bold(formatCost(totalCost))}`)
  }
  
  l.dim(`LLM Cost - Model: ${displayName}, Status: ${stopReason}, Tokens: [${tokenLines.join(', ')}], Cost: [${costLines.join(', ')}]`)
  
  return { inputCost, outputCost, totalCost }
}