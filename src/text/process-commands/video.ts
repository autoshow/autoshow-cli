// src/process-commands/video.ts

import { generateMarkdown } from '../process-steps/01-generate-markdown.ts'
import { downloadAudio, saveAudio } from '../process-steps/02-download-audio.ts'
import { runTranscription } from '../process-steps/03-run-transcription.ts'
import { selectPrompts } from '../process-steps/04-select-prompt.ts'
import { runLLM } from '../process-steps/05-run-llm.ts'
import { err, logInitialFunctionCall } from '../../logging.ts'
import type { ProcessingOptions, ShowNoteMetadata } from '@/types.ts'

export async function processVideo(
  options: ProcessingOptions,
  url: string,
  llmServices?: string,
  transcriptServices?: string
) {
  logInitialFunctionCall('processVideo', { url, llmServices, transcriptServices })

  try {
    // Step 1 - Generate markdown
    const { frontMatter, finalPath, filename, metadata } = await generateMarkdown(options, url)

    // Step 2 - Download audio and convert to WAV
    await downloadAudio(options, url, filename)

    // Step 3 - Transcribe audio and read transcript
    const { transcript, modelId: transcriptionModel } = await runTranscription(options, finalPath, transcriptServices)

    // Step 4 - Selecting prompt
    const selectedPrompts = await selectPrompts(options)

    // Step 5 - Running LLM processing on transcript (if applicable)
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

    // Step 6 - Cleanup
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
    err('Error processing video:', (error as Error).message)
    throw error
  }
}