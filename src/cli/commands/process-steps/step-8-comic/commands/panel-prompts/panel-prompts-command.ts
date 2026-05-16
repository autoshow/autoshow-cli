import { existsSync } from 'node:fs'
import { mkdir } from 'node:fs/promises'
import { l, err, bold, cyan, green, red } from '../../utils/logger'
import { processScene } from '../process-scenes/process-scenes-command'
import {
  COMIC_OUTPUT_ROOT,
  getSceneJsonPath,
  getPanelPromptsDirectory,
} from '../../utils/project-paths'
import type {
  PanelPromptsCommandOptions,
} from '../../types'



export const panelPromptsCommand = async (options: PanelPromptsCommandOptions): Promise<void> => {
  l(`${bold('USS Acampo')} - Building panel prompt packages for ${options.sceneSlug}`)
  l(`${cyan('═'.repeat(50))}\n`)

  const startTime = Date.now()
  const stats = {
    processScenes: { success: false, error: '' }
  }

  try {
    l(`${cyan('Step 1/1:')} Processing scene`)
    l(`${cyan('━'.repeat(50))}\n`)

    const sceneJsonPath = getSceneJsonPath(options.sceneSlug)
    if (!existsSync(sceneJsonPath)) {
      throw new Error(
        `Scene JSON not found at ${sceneJsonPath}. ` +
        `Run "bun as comic draft-scenes <script-path>" first.`
      )
    }

    const outputDir = getPanelPromptsDirectory(options.sceneSlug)
    await mkdir(outputDir, { recursive: true })

    await processScene({
      sceneSlug: options.sceneSlug,
      sceneJsonPath,
      outputDir,
    })

    stats.processScenes.success = true
    l.success(`Scene processing complete`)
    l('')
  } catch (error) {
    stats.processScenes.error = error instanceof Error ? error.message : String(error)
    err('Scene processing failed:', stats.processScenes.error)
    throw new Error('Failed at scene processing step')
  }

  const endTime = Date.now()
  const duration = ((endTime - startTime) / 1000).toFixed(2)

  l(`${cyan('═'.repeat(50))}`)
  l(bold('Prompt Packaging Complete'))
  l(`${cyan('═'.repeat(50))}\n`)

  l(`  ${stats.processScenes.success ? green('✓') : red('✗')} Scene processing`)
  l('')

  l.dim(`Output directory: ${COMIC_OUTPUT_ROOT}/${options.sceneSlug}`)
  l.success(`All operations completed in ${duration}s`)
}
