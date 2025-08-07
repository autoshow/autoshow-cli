import { generateMarkdown } from '../process-steps/01-generate-markdown.ts'
import { downloadAudio, saveAudio } from '../process-steps/02-download-audio.ts'
import { runTranscription } from '../process-steps/03-run-transcription.ts'
import { selectPrompts } from '../process-steps/04-select-prompt.ts'
import { runLLM } from '../process-steps/05-run-llm.ts'
import { err, logInitialFunctionCall } from '@/logging'
import type { ProcessingOptions, ShowNoteMetadata } from '@/types'

export async function processVideo(
  options: ProcessingOptions,
  url: string,
  llmServices?: string,
  transcriptServices?: string
) {
  const p = '[text/process-commands/video]'
  logInitialFunctionCall('processVideo', { url, llmServices, transcriptServices })

  try {
    const { frontMatter, finalPath, filename, metadata } = await generateMarkdown(options, url)
    await downloadAudio(options, url, filename)
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
    err(`${p} Error processing video: ${(error as Error).message}`)
    throw error
  }
}