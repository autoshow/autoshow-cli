import { err } from '../../utils/logger'
import { generateJsonPrompt } from '../../utils/json-prompt-utils'
import type {
  DraftPromptsCommandOptions,
} from '../../types'



export const draftPromptsCommand = async (options: DraftPromptsCommandOptions): Promise<void> => {
  try {
    await generateJsonPrompt(options.sceneSlug)
  } catch (error) {
    err('Draft prompt bundle generation failed:', error instanceof Error ? error.message : String(error))
    throw new Error('Failed at draft prompt generation step')
  }
}
