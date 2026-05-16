import { l, err, bold, cyan, green, red } from '../../utils/logger'
import { generateJsonPrompt } from '../../utils/json-prompt-utils'
import { COMIC_OUTPUT_ROOT } from '../../utils/project-paths'
import type {
  DraftPromptsCommandOptions,
} from '../../types'



export const draftPromptsCommand = async (options: DraftPromptsCommandOptions): Promise<void> => {
  l(`${bold('USS Acampo')} - Building draft prompt bundle for ${options.sceneSlug}`)
  l(`${cyan('═'.repeat(50))}\n`)

  const startTime = Date.now()
  const stats = {
    generatePrompts: { success: false, error: '' }
  }

  try {
    l(`${cyan('Step 1/1:')} Generating draft prompt bundle from structured script`)
    l(`${cyan('━'.repeat(50))}\n`)

    await generateJsonPrompt(options.sceneSlug)

    stats.generatePrompts.success = true
    l.success('Draft prompt bundle generation complete')
    l('')
  } catch (error) {
    stats.generatePrompts.error = error instanceof Error ? error.message : String(error)
    err('Draft prompt bundle generation failed:', stats.generatePrompts.error)
    throw new Error('Failed at draft prompt generation step')
  }

  const duration = ((Date.now() - startTime) / 1000).toFixed(2)

  l(`${cyan('═'.repeat(50))}`)
  l(bold('Draft Prompt Generation Complete'))
  l(`${cyan('═'.repeat(50))}\n`)

  l(`  ${stats.generatePrompts.success ? green('✓') : red('✗')} Draft prompt bundle generation`)
  l('')

  l.dim(`Output directory: ${COMIC_OUTPUT_ROOT}/${options.sceneSlug}`)
  l.success(`All operations completed in ${duration}s`)
}
