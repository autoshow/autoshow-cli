import { generateMarkdown } from '../process-steps/01-process-content/generate-markdown'
import { downloadAudio } from '../process-steps/01-process-content/download-audio'
import { saveAudio } from '../process-steps/01-process-content/download-audio'
import { runTranscription } from '../process-steps/02-run-transcription/run-transcription'
import { selectPrompts } from '../process-steps/03-select-prompts/select-prompt'
import { runLLM } from '../process-steps/04-run-llm/run-llm'
import { generateMusic } from '../process-steps/05-generate-music/generate-music'
import { err, l } from '@/logging'
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
    
    // Generate music if requested (ElevenLabs or MiniMax)
    if ((options.elevenlabs || options.minimax) && llmOutput) {
      const musicResult = await generateMusic(options, llmOutput, finalPath)
      if (!musicResult.success) {
        l.warn(`Music generation failed: ${musicResult.error}`)
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
    err(`Error processing file: ${(error as Error).message}`)
    process.exit(1)
  }
}