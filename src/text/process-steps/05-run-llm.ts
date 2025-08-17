import { l, err, logInitialFunctionCall } from '@/logging'
import { writeFile } from '@/node-utils'
import { callChatGPT, callClaude, callGemini } from '../llms/llm-services.ts'
import { LLM_SERVICES_CONFIG } from '../llms/llm-models.ts'
import { formatCost, logLLMCost } from '../utils/cost.ts'
import { uploadAllOutputFiles } from '../utils/s3-upload.ts'
import type { ChatGPTModelValue, ClaudeModelValue, GeminiModelValue } from '../llms/llm-services.ts'
import type { ProcessingOptions, ShowNoteMetadata } from '@/types'
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
  transcriptionCost?: number,
  audioDuration?: number
) {
  const p = '[text/process-steps/05-run-llm]'
  l.step(`\nStep 5 - Run Language Model\n`)
  logInitialFunctionCall('runLLM', { llmServices, metadata })
  metadata.walletAddress = options['walletAddress'] || metadata.walletAddress
  metadata.mnemonic = options['mnemonic'] || metadata.mnemonic
  try {
    let showNotesResult = ''
    let llmCost = 0
    let userModel = ''
    let promptSections = options.prompt || ['summary', 'longChapters']
    if (llmServices) {
      l.dim(`${p} Preparing to process with '${llmServices}' Language Model...`)
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
      l.dim(`${p} LLM processing completed, combined front matter + LLM output + transcript written to:\n    - ${outputFilename}`)
      showNotesResult = showNotes
    } else {
      l.dim(`${p} No LLM selected, skipping processing...`)
      const noLLMFile = `${finalPath}-prompt.md`
      l.dim(`${p} Writing front matter + prompt + transcript to file:\n    - ${noLLMFile}`)
      await writeFile(noLLMFile, `${frontMatter}\n${prompt}\n## Transcript\n\n${transcript}`)
    }
    if (options.save) {
      l.dim(`${p} Uploading output files to cloud storage (${options.save})`)
      const transcriptionCostCents = Math.round((transcriptionCost || 0) * 100)
      const llmCostCents = Math.round(llmCost * 100)
      
      const uploadMetadata = {
        metadata,
        transcriptionService: transcriptionServices,
        transcriptionModel,
        transcriptionCostCents,
        audioDuration: audioDuration || 0,
        llmService: llmServices,
        llmModel: userModel,
        llmCostCents,
        promptSections,
        transcript,
        llmOutput: showNotesResult
      }
      
      await uploadAllOutputFiles(finalPath, options, uploadMetadata)
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
    l.dim(`${p} ${JSON.stringify(finalShowNote, null, 2)}`)
    return showNotesResult
  } catch (error) {
    err(`${p} Error running Language Model: ${(error as Error).message}`)
    throw error
  }
}
export async function retryLLMCall<T>(
  fn: () => Promise<T>
) {
  const p = '[text/process-steps/05-run-llm]'
  const maxRetries = 7
  let attempt = 0
  while (attempt < maxRetries) {
    try {
      attempt++
      l.dim(`${p} Attempt ${attempt} - Processing LLM call...`)
      const result = await fn()
      l.dim(`${p} LLM call completed successfully on attempt ${attempt}.`)
      return result
    } catch (error) {
      err(`${p} Attempt ${attempt} failed: ${(error as Error).message}`)
      if (attempt >= maxRetries) {
        err(`${p} Max retries (${maxRetries}) reached. Aborting LLM processing.`)
        throw error
      }
      const delayMs = 1000 * 2 ** (attempt - 1)
      l.dim(`${p} Retrying in ${delayMs / 1000} seconds...`)
      await new Promise((resolve) => setTimeout(resolve, delayMs))
    }
  }
  throw new Error('LLM call failed after maximum retries.')
}
export { formatCost, logLLMCost }