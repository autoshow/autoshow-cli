import { existsSync } from 'node:fs'
import { mkdir } from 'node:fs/promises'
import { err } from '../../utils/logger'
import { processScene, type ProcessSceneResult } from '../process-scenes/process-scenes-command'
import {
  getSceneJsonPath,
  getPanelPromptsDirectory,
} from '../../utils/project-paths'
import type {
  PanelPromptsCommandOptions,
} from '../../types'



export const panelPromptsCommand = async (options: PanelPromptsCommandOptions): Promise<ProcessSceneResult> => {
  try {
    const sceneJsonPath = getSceneJsonPath(options.sceneSlug)
    if (!existsSync(sceneJsonPath)) {
      throw new Error(
        `Scene JSON not found at ${sceneJsonPath}. ` +
        `Run "bun as comic draft-scenes <script-path>" first.`
      )
    }

    const outputDir = getPanelPromptsDirectory(options.sceneSlug)
    await mkdir(outputDir, { recursive: true })

    return await processScene({
      sceneSlug: options.sceneSlug,
      sceneJsonPath,
      outputDir,
    })
  } catch (error) {
    err('Scene processing failed:', error instanceof Error ? error.message : String(error))
    throw new Error('Failed at scene processing step')
  }
}
