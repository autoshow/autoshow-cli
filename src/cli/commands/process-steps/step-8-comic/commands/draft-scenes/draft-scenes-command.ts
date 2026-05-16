import { l, bold, cyan, green, red } from '../../utils/logger'
import { generateSceneJson } from './generate-scene-json'
import { DEFAULT_LLM_MODEL } from '../../models/model-registry'
import { structureScriptsCommand } from '../structure-scripts/structure-scripts-command'
import { draftPromptsCommand } from '../draft-prompts/draft-prompts-command'
import { panelPromptsCommand } from '../panel-prompts/panel-prompts-command'
import { COMIC_OUTPUT_ROOT } from '../../utils/project-paths'
import type {
  DraftScenesCommandOptions,
  DraftScenesStage,
  PanelPromptsCommandOptions,
} from '../../types'



const DRAFT_SCENE_STAGE_ORDER: DraftScenesStage[] = ['structure', 'prompt', 'scene', 'panel-prompts']

export type DraftScenesWorkflowDependencies = {
  runStructureScripts?: (options: DraftScenesCommandOptions) => Promise<void>
  runDraftPrompts?: (options: DraftScenesCommandOptions) => Promise<void>
  runSceneDraft?: (options: DraftScenesCommandOptions) => Promise<void>
  runPanelPrompts?: (options: PanelPromptsCommandOptions) => Promise<void>
}

const getDraftSceneStages = (only: DraftScenesCommandOptions['only']): DraftScenesStage[] => {
  return only ? [only] : DRAFT_SCENE_STAGE_ORDER
}

export const runSceneDraftStage = async (options: DraftScenesCommandOptions): Promise<void> => {
  const llmModel = options.llmModel ?? DEFAULT_LLM_MODEL

  l(`${bold('USS Acampo')} - Drafting scene JSON for ${options.sceneSlug}`)
  l(`${cyan('═'.repeat(50))}\n`)

  const startTime = Date.now()
  const stats = {
    generateSceneJson: { success: false, error: '' }
  }

  try {
    l(`${cyan('Step 1/1:')} Generating scene JSON via ${llmModel}`)
    l(`${cyan('━'.repeat(50))}\n`)

    await generateSceneJson(options.sceneSlug, { model: llmModel })

    stats.generateSceneJson.success = true
    l.success(`Scene JSON generation complete`)
    l('')
  } catch (error) {
    stats.generateSceneJson.error = error instanceof Error ? error.message : String(error)
    throw new Error('Failed at scene JSON generation step')
  }

  const endTime = Date.now()
  const duration = ((endTime - startTime) / 1000).toFixed(2)

  l(`${cyan('═'.repeat(50))}`)
  l(bold('Scene Drafting Complete'))
  l(`${cyan('═'.repeat(50))}\n`)

  l(`  ${stats.generateSceneJson.success ? green('✓') : red('✗')} Scene JSON generation (${llmModel})`)
  l('')

  l.dim(`Scene output directory: ${COMIC_OUTPUT_ROOT}/${options.sceneSlug}`)
  l.success(`All operations completed in ${duration}s`)
}

export const draftScenesCommand = async (
  options: DraftScenesCommandOptions,
  dependencies: DraftScenesWorkflowDependencies = {}
): Promise<void> => {
  const runStructureScripts = dependencies.runStructureScripts ?? structureScriptsCommand
  const runDraftPrompts = dependencies.runDraftPrompts ?? ((opts: DraftScenesCommandOptions) => draftPromptsCommand({ sceneSlug: opts.sceneSlug }))
  const runSceneDraft = dependencies.runSceneDraft ?? runSceneDraftStage
  const runPanelPrompts = dependencies.runPanelPrompts ?? panelPromptsCommand

  for (const stage of getDraftSceneStages(options.only)) {
    if (stage === 'structure') {
      await runStructureScripts(options)
      continue
    }

    if (stage === 'prompt') {
      await runDraftPrompts(options)
      continue
    }

    if (stage === 'scene') {
      await runSceneDraft(options)
      continue
    }

    await runPanelPrompts({ sceneSlug: options.sceneSlug })
  }
}
