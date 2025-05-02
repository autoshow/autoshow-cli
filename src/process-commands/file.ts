// src/process-commands/file.ts

import { generateMarkdown } from '../process-steps/01-generate-markdown.ts'
import { downloadAudio } from '../process-steps/02-download-audio.ts'
import { saveAudio } from '../process-steps/02-download-audio.ts'
import { runTranscription } from '../process-steps/03-run-transcription.ts'
import { selectPrompts } from '../process-steps/04-select-prompt.ts'
import { runLLM } from '../process-steps/05-run-llm.ts'
import { l, err, logInitialFunctionCall } from '../utils/logging.ts'

import type { ProcessingOptions, ShowNoteMetadata } from '../utils/types.ts'

export async function processFile(
  options: ProcessingOptions,
  filePath: string,
  llmServices?: string,
  transcriptServices?: string
) {
  logInitialFunctionCall('processFile', { filePath, llmServices, transcriptServices })

  try {
    // Step 1 - Generate markdown
    const { frontMatter, finalPath, filename, metadata } = await generateMarkdown(options, filePath)

    // Step 2 - Convert to WAV
    await downloadAudio(options, filePath, filename)

    // Step 3 - Transcribe audio, returning transcript and cost
    const { transcript, transcriptionCost, modelId: transcriptionModel } = await runTranscription(options, finalPath, transcriptServices)

    // Step 4 - Selecting prompt
    const selectedPrompts = await selectPrompts(options)

    // Step 5 - Run LLM with transcription details
    const llmOutput = await runLLM(
      options,
      finalPath,
      frontMatter,
      selectedPrompts,
      transcript,
      metadata as ShowNoteMetadata,
      llmServices,
      transcriptServices,
      transcriptionModel,
      transcriptionCost
    )

    // Step 6 - Cleanup
    if (!options.saveAudio) {
      await saveAudio(finalPath)
    }

    l.dim('\n  processFile command completed successfully.')

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