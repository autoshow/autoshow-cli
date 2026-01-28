import { generateMarkdown } from '../process-steps/01-process-content/generate-markdown'
import { downloadAudio, saveAudio } from '../process-steps/01-process-content/download-audio'
import { runTranscription } from '../process-steps/02-run-transcription/run-transcription'
import { selectPrompts } from '../process-steps/03-select-prompts/select-prompt'
import { runLLM } from '../process-steps/04-run-llm/run-llm'
import { generateMusic } from '../process-steps/05-generate-music/generate-music'
import { err, l } from '@/logging'
import type { ProcessingOptions, ShowNoteMetadata } from '@/text/text-types'

export async function processVideo(
  options: ProcessingOptions,
  url: string,
  llmServices?: string,
  transcriptServices?: string
) {
  try {
    const { frontMatter, finalPath, filename, metadata } = await generateMarkdown(options, url)
    await downloadAudio(options, url, filename)
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
    
    if ((options.elevenlabs || options.minimax) && llmOutput) {
      const musicResult = await generateMusic(options, llmOutput, finalPath)
      if (!musicResult.success) {
        l('Music generation failed', { error: musicResult.error })
      }
    }
    
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
    err(`Error processing video: ${(error as Error).message}`)
    throw error
  }
}