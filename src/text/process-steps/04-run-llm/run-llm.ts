import { l, err } from '@/logging'
import { writeFile, ensureDir } from '@/node-utils'
import { callChatGPT, callClaude, callGemini } from './llm-services'
import { LLM_SERVICES_CONFIG } from './llm-models'
import { formatCost, logLLMCost } from '../../utils/cost'
import type { ProcessingOptions, ShowNoteMetadata, ChatGPTModelValue, ClaudeModelValue, GeminiModelValue } from '@/text/text-types'

export async function runLLM(
  options: ProcessingOptions,
  finalPath: string,
  frontMatter: string,
  prompt: string,
  transcript: string,
  metadata: ShowNoteMetadata,
  llmServices?: string
) {
  const outputDir = finalPath.substring(0, finalPath.lastIndexOf('/'))
  await ensureDir(outputDir)
  
  metadata.walletAddress = options['walletAddress'] || metadata.walletAddress
  metadata.mnemonic = options['mnemonic'] || metadata.mnemonic
  try {
    let showNotesResult = ''
    let userModel = ''
    if (llmServices) {
      const config = LLM_SERVICES_CONFIG[llmServices as keyof typeof LLM_SERVICES_CONFIG]
      if (!config) {
        throw new Error(`Unknown LLM service: ${llmServices}`)
      }
      const optionValue = options[llmServices as keyof typeof options]
      const defaultModelId = config.models[0]?.modelId ?? ''
      userModel = (typeof optionValue === 'string' && optionValue !== 'true' && optionValue.trim() !== '')
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
      logLLMCost({
        name: userModel,
        stopReason: showNotesData.usage?.stopReason ?? 'unknown',
        tokenUsage: {
          input: showNotesData.usage?.input,
          output: showNotesData.usage?.output,
          total: showNotesData.usage?.total
        }
      })
      const showNotes = showNotesData.content
      const outputFilename = `${finalPath}-${llmServices}-shownotes.md`
      await writeFile(outputFilename, `${frontMatter}\n${showNotes}\n\n## Transcript\n\n${transcript}`)
      l.dim(`LLM processing completed, combined front matter + LLM output + transcript written to: ${outputFilename}`)
      showNotesResult = showNotes
    } else {
      l.dim('No LLM selected, skipping processing...')
      const noLLMFile = `${finalPath}-prompt.md`
      l.dim(`Writing front matter + prompt + transcript to file: ${noLLMFile}`)
      await writeFile(noLLMFile, `${frontMatter}\n${prompt}\n## Transcript\n\n${transcript}`)
    }
    
    return showNotesResult
  } catch (error) {
    err(`Error running Language Model: ${(error as Error).message}`)
    throw error
  }
}

export async function retryLLMCall<T>(
  fn: () => Promise<T>
) {
  const maxRetries = 7
  let attempt = 0
  while (attempt < maxRetries) {
    try {
      attempt++
      const result = await fn()
      return result
    } catch (error) {
      err(`Attempt ${attempt} failed: ${(error as Error).message}`)
      if (attempt >= maxRetries) {
        err(`Max retries (${maxRetries}) reached. Aborting LLM processing.`)
        throw error
      }
      const delayMs = 1000 * 2 ** (attempt - 1)
      l.dim(`Retrying in ${delayMs / 1000} seconds...`)
      await new Promise((resolve) => setTimeout(resolve, delayMs))
    }
  }
  throw new Error('LLM call failed after maximum retries.')
}
export { formatCost, logLLMCost }