import { generateMarkdown } from '../process-steps/01-process-content/generate-markdown.ts'
import { downloadAudio } from '../process-steps/01-process-content/download-audio.ts'
import { saveAudio } from '../process-steps/01-process-content/download-audio.ts'
import { runTranscription } from '../process-steps/02-run-transcription/run-transcription.ts'
import { selectPrompts } from '../process-steps/03-select-prompts/select-prompt.ts'
import { runLLM } from '../process-steps/04-run-llm/run-llm.ts'
import { err } from '@/logging'
import type { ProcessingOptions, ShowNoteMetadata } from '@/text/text-types'

export async function processFile(
  options: ProcessingOptions,
  filePath: string,
  llmServices?: string,
  transcriptServices?: string
) {
  try {
    const { frontMatter, finalPath, filename, metadata } = await generateMarkdown(options, filePath)
    await downloadAudio(options, filePath, filename)
    const { transcript } = await runTranscription(options, finalPath, transcriptServices)
    const selectedPrompts = await selectPrompts(options)
    const llmOutput = await runLLM(
      options,
      finalPath,
      frontMatter,
      selectedPrompts,
      transcript,
      metadata as ShowNoteMetadata,
      llmServices
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
    err(`Error processing file: ${(error as Error).message}`)
    process.exit(1)
  }
}