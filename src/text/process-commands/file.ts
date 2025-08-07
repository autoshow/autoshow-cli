import { generateMarkdown } from '../process-steps/01-generate-markdown.ts'
import { downloadAudio } from '../process-steps/02-download-audio.ts'
import { saveAudio } from '../process-steps/02-download-audio.ts'
import { runTranscription } from '../process-steps/03-run-transcription.ts'
import { selectPrompts } from '../process-steps/04-select-prompt.ts'
import { runLLM } from '../process-steps/05-run-llm.ts'
import { err, logInitialFunctionCall } from '@/logging'

import type { ProcessingOptions, ShowNoteMetadata } from '@/types'

export async function processFile(
  options: ProcessingOptions,
  filePath: string,
  llmServices?: string,
  transcriptServices?: string
) {
  const p = '[text/process-commands/file]'
  logInitialFunctionCall('processFile', { filePath, llmServices, transcriptServices })

  try {
    const { frontMatter, finalPath, filename, metadata } = await generateMarkdown(options, filePath)
    await downloadAudio(options, filePath, filename)
    const { transcript, modelId: transcriptionModel } = await runTranscription(options, finalPath, transcriptServices)
    const selectedPrompts = await selectPrompts(options)
    const llmOutput = await runLLM(
      options,
      finalPath,
      frontMatter,
      selectedPrompts,
      transcript,
      metadata as ShowNoteMetadata,
      llmServices,
      transcriptServices,
      transcriptionModel
    )

    if (!options.saveAudio) {
      await saveAudio(finalPath)
    }

    return {
      frontMatter,
      prompt: selectedPrompts,
      llmOutput: llmOutput || '',
      transcript,
    }
  } catch (error) {
    err(`${p} Error processing file: ${(error as Error).message}`)
    process.exit(1)
  }
}