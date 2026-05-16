import { l, err, bold, cyan, green, red } from '../../utils/logger'
import { generateStructuredScript } from '../../utils/structured-script-utils'
import { COMIC_OUTPUT_ROOT } from '../../utils/project-paths'
import type {
  StructureScriptsCommandOptions,
} from '../../types'



export const structureScriptsCommand = async (
  options: StructureScriptsCommandOptions
): Promise<void> => {
  l(`${bold('USS Acampo')} - Structuring script: ${options.sceneSlug}`)
  l(`${cyan('═'.repeat(50))}\n`)

  const startTime = Date.now()
  const stats = {
    generateStructuredScripts: { success: false, error: '' }
  }

  try {
    l(`${cyan('Step 1/1:')} Generating structured script JSON`)
    l(`${cyan('━'.repeat(50))}\n`)

    if (options.llmModel) {
      l.dim(`LLM review model: ${options.llmModel}`)
    }

    await generateStructuredScript(
      options.scriptPath,
      options.sceneSlug,
      {
        ...(options.llmModel ? { llmModel: options.llmModel } : {}),
      }
    )

    stats.generateStructuredScripts.success = true
    l.success('Structured script generation complete')
    l('')
  } catch (error) {
    stats.generateStructuredScripts.error = error instanceof Error ? error.message : String(error)
    err('Structured script generation failed:', stats.generateStructuredScripts.error)
    throw new Error('Failed at structured script generation step')
  }

  const duration = ((Date.now() - startTime) / 1000).toFixed(2)

  l(`${cyan('═'.repeat(50))}`)
  l(bold('Structured Script Generation Complete'))
  l(`${cyan('═'.repeat(50))}\n`)

  l(`  ${stats.generateStructuredScripts.success ? green('✓') : red('✗')} Structured script generation`)
  l('')

  l.dim(`Output directory: ${COMIC_OUTPUT_ROOT}/${options.sceneSlug}`)
  l.success(`All operations completed in ${duration}s`)
}
