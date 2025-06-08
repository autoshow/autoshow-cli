// src/process-steps/05-run-llm.ts

import chalk from 'chalk'
import { l, err, logInitialFunctionCall } from '../utils/logging.ts'
import { writeFile } from '../utils/node-utils.ts'
import { callChatGPT, callClaude, callGemini } from '../llms/llm-services.ts'
import type { ChatGPTModelValue, ClaudeModelValue, GeminiModelValue } from '../llms/llm-services.ts'
import type { ProcessingOptions, ShowNoteMetadata } from '../utils/types.ts'

export const LLM_SERVICES_CONFIG = {
  skip: {
    serviceName: 'Skip LLM Processing',
    value: null,
    label: 'Skip LLM Processing',
    models: []
  },
  chatgpt: {
    serviceName: 'OpenAI ChatGPT',
    value: 'chatgpt',
    label: 'ChatGPT',
    apiKeyPropName: 'openaiApiKey',
    models: [
      { modelName: 'GPT 4o', modelId: 'gpt-4o', inputCostPer1M: 2.50, outputCostPer1M: 10.00, inputCostPer1MCents: 250, outputCostPer1MCents: 1000 },
      { modelName: 'GPT 4o MINI', modelId: 'gpt-4o-mini', inputCostPer1M: 0.15, outputCostPer1M: 0.60, inputCostPer1MCents: 15, outputCostPer1MCents: 60 },
      { modelName: 'GPT o1 MINI', modelId: 'o1-mini', inputCostPer1M: 1.10, outputCostPer1M: 4.40, inputCostPer1MCents: 110, outputCostPer1MCents: 440 }
    ]
  },
  claude: {
    serviceName: 'Anthropic Claude',
    value: 'claude',
    label: 'Claude',
    apiKeyPropName: 'anthropicApiKey',
    models: [
      { modelName: 'Claude 3.7 Sonnet', modelId: 'claude-3-7-sonnet-latest', inputCostPer1M: 3.00, outputCostPer1M: 15.00, inputCostPer1MCents: 300, outputCostPer1MCents: 1500 },
      { modelName: 'Claude 3.5 Haiku', modelId: 'claude-3-5-haiku-latest', inputCostPer1M: 0.80, outputCostPer1M: 4.00, inputCostPer1MCents: 80, outputCostPer1MCents: 400 },
    ]
  },
  gemini: {
    serviceName: 'Google Gemini',
    value: 'gemini',
    label: 'Gemini',
    apiKeyPropName: 'geminiApiKey',
    models: [
      { modelName: 'Gemini 1.5 Pro', modelId: 'gemini-1.5-pro', inputCostPer1M: 2.50, outputCostPer1M: 10.00, inputCostPer1MCents: 250, outputCostPer1MCents: 1000 },
      { modelName: 'Gemini 1.5 Flash-8B', modelId: 'gemini-1.5-flash-8b', inputCostPer1M: 0.075, outputCostPer1M: 0.30, inputCostPer1MCents: 7.5, outputCostPer1MCents: 30 },
      { modelName: 'Gemini 1.5 Flash', modelId: 'gemini-1.5-flash', inputCostPer1M: 0.15, outputCostPer1M: 0.60, inputCostPer1MCents: 15, outputCostPer1MCents: 60 },
      { modelName: 'Gemini 2.0 Flash-Lite', modelId: 'gemini-2.0-flash-lite', inputCostPer1M: 0.075, outputCostPer1M: 0.30, inputCostPer1MCents: 7.5, outputCostPer1MCents: 30 },
      { modelName: 'Gemini 2.0 Flash', modelId: 'gemini-2.0-flash', inputCostPer1M: 0.10, outputCostPer1M: 0.40, inputCostPer1MCents: 10, outputCostPer1MCents: 40 },
    ]
  }
} as const

export async function runLLM(
  options: ProcessingOptions,
  finalPath: string,
  frontMatter: string,
  prompt: string,
  transcript: string,
  metadata: ShowNoteMetadata,
  llmServices?: string,
  transcriptionServices?: string,
  transcriptionModel?: string,
  transcriptionCost?: number
) {
  l.step(`\nStep 5 - Run Language Model\n`)
  logInitialFunctionCall('runLLM', { llmServices, metadata })

  metadata.walletAddress = options['walletAddress'] || metadata.walletAddress
  metadata.mnemonic = options['mnemonic'] || metadata.mnemonic

  try {
    let showNotesResult = ''
    let llmCost = 0
    let userModel = ''

    if (llmServices) {
      l.dim(`\n  Preparing to process with '${llmServices}' Language Model...\n`)

      const config = LLM_SERVICES_CONFIG[llmServices as keyof typeof LLM_SERVICES_CONFIG]
      if (!config) {
        throw new Error(`Unknown LLM service: ${llmServices}`)
      }

      const optionValue = options[llmServices as keyof typeof options]
      const defaultModelId = config.models[0]?.modelId ?? ''
      const userModel = (typeof optionValue === 'string' && optionValue !== 'true' && optionValue.trim() !== '')
        ? optionValue
        : defaultModelId

      let showNotesData

      switch (llmServices) {
        case 'chatgpt':
          showNotesData = await retryLLMCall(
            () => callChatGPT(prompt, transcript, userModel as ChatGPTModelValue)
          )
          break

        case 'claude':
          showNotesData = await retryLLMCall(
            () => callClaude(prompt, transcript, userModel as ClaudeModelValue)
          )
          break

        case 'gemini':
          showNotesData = await retryLLMCall(
            () => callGemini(prompt, transcript, userModel as GeminiModelValue)
          )
          break

        default:
          throw new Error(`Unknown LLM service: ${llmServices}`)
      }

      const costBreakdown = logLLMCost({
        name: userModel,
        stopReason: showNotesData.usage?.stopReason ?? 'unknown',
        tokenUsage: {
          input: showNotesData.usage?.input,
          output: showNotesData.usage?.output,
          total: showNotesData.usage?.total
        }
      })

      llmCost = costBreakdown.totalCost ?? 0
      const showNotes = showNotesData.content

      const outputFilename = `${finalPath}-${llmServices}-shownotes.md`
      await writeFile(outputFilename, `${frontMatter}\n${showNotes}\n\n## Transcript\n\n${transcript}`)
      l.dim(`\n  LLM processing completed, combined front matter + LLM output + transcript written to:\n    - ${outputFilename}`)
      showNotesResult = showNotes
    } else {
      l.dim('  No LLM selected, skipping processing...')
      const noLLMFile = `${finalPath}-prompt.md`
      l.dim(`\n  Writing front matter + prompt + transcript to file:\n    - ${noLLMFile}`)
      await writeFile(noLLMFile, `${frontMatter}\n${prompt}\n## Transcript\n\n${transcript}`)
    }

    const finalCost = (transcriptionCost || 0) + llmCost
    const finalShowNote = {
      showLink: metadata.showLink ?? '',
      channel: metadata.channel ?? '',
      channelURL: metadata.channelURL ?? '',
      title: metadata.title,
      description: metadata.description ?? '',
      publishDate: metadata.publishDate,
      coverImage: metadata.coverImage ?? '',
      frontmatter: frontMatter,
      prompt,
      transcript,
      llmOutput: showNotesResult,
      walletAddress: metadata.walletAddress ?? '',
      mnemonic: metadata.mnemonic ?? '',
      llmService: llmServices ?? '',
      llmModel: userModel,
      llmCost,
      transcriptionService: transcriptionServices ?? '',
      transcriptionModel: transcriptionModel ?? '',
      transcriptionCost,
      finalCost
    }
    l.dim(JSON.stringify(finalShowNote, null, 2))
    return showNotesResult
  } catch (error) {
    err(`Error running Language Model: ${(error as Error).message}`)
    throw error
  }
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

  l.dim(`  - ${stopReason ? `${stopReason} Reason` : 'Status'}: ${stopReason}\n  - Model: ${displayName}`)

  const tokenLines: string[] = []
  if (input) tokenLines.push(`${input} input tokens`)
  if (output) tokenLines.push(`${output} output tokens`)
  if (total) tokenLines.push(`${total} total tokens`)

  if (tokenLines.length > 0) {
    l.dim(`  - Token Usage:\n    - ${tokenLines.join('\n    - ')}`)
  }

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
    costLines.push(`Input cost: ${formatCost(inputCost)}`)
  }
  if (outputCost !== undefined) {
    costLines.push(`Output cost: ${formatCost(outputCost)}`)
  }
  if (totalCost !== undefined) {
    costLines.push(`Total cost: ${chalk.bold(formatCost(totalCost))}`)
  }

  if (costLines.length > 0) {
    l.dim(`  - Cost Breakdown:\n    - ${costLines.join('\n    - ')}`)
  }

  return { inputCost, outputCost, totalCost }
}

export async function retryLLMCall<T>(
  fn: () => Promise<T>
) {
  const maxRetries = 7
  let attempt = 0

  while (attempt < maxRetries) {
    try {
      attempt++
      l.dim(`  Attempt ${attempt} - Processing LLM call...\n`)
      const result = await fn()
      l.dim(`\n  LLM call completed successfully on attempt ${attempt}.`)
      return result
    } catch (error) {
      err(`  Attempt ${attempt} failed: ${(error as Error).message}`)
      if (attempt >= maxRetries) {
        err(`  Max retries (${maxRetries}) reached. Aborting LLM processing.`)
        throw error
      }
      const delayMs = 1000 * 2 ** (attempt - 1)
      l.dim(`  Retrying in ${delayMs / 1000} seconds...`)
      await new Promise((resolve) => setTimeout(resolve, delayMs))
    }
  }
  throw new Error('LLM call failed after maximum retries.')
}