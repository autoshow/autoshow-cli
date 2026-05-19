import { comicLog, formatDuration } from '../../utils/logger'
import { generateSceneJson } from './generate-scene-json'
import { DEFAULT_LLM_MODEL } from '../../models/model-registry'
import { structureScriptsCommand } from '../structure-scripts/structure-scripts-command'
import { draftPromptsCommand } from '../draft-prompts/draft-prompts-command'
import { panelPromptsCommand } from '../panel-prompts/panel-prompts-command'
import { getSceneOutputDirectory } from '../../utils/project-paths'
import type {
  DraftScenesCommandOptions,
  DraftScenesStage,
  PanelPromptsCommandOptions,
} from '../../types'



const DRAFT_SCENE_STAGE_ORDER: DraftScenesStage[] = ['structure', 'prompt', 'scene', 'panel-prompts']

export type DraftScenesWorkflowDependencies = {
  runStructureScripts?: (options: DraftScenesCommandOptions) => Promise<unknown>
  runDraftPrompts?: (options: DraftScenesCommandOptions) => Promise<unknown>
  runSceneDraft?: (options: DraftScenesCommandOptions) => Promise<unknown>
  runPanelPrompts?: (options: PanelPromptsCommandOptions) => Promise<unknown>
}

export type DraftScenesLogMode = 'standalone' | 'nested'

export type DraftScenesWorkflowResult = {
  stages: DraftScenesStage[]
  durationMs: number
}

const getDraftSceneStages = (only: DraftScenesCommandOptions['only']): DraftScenesStage[] => {
  return only ? [only] : DRAFT_SCENE_STAGE_ORDER
}

export const runSceneDraftStage = async (options: DraftScenesCommandOptions) => {
  const llmModel = options.llmModel ?? DEFAULT_LLM_MODEL

  try {
    return await generateSceneJson(options.sceneSlug, { model: llmModel })
  } catch {
    throw new Error('Failed at scene JSON generation step')
  }
}

export const draftScenesCommand = async (
  options: DraftScenesCommandOptions,
  dependencies: DraftScenesWorkflowDependencies = {},
  logMode: DraftScenesLogMode = 'standalone'
): Promise<DraftScenesWorkflowResult> => {
  const runStructureScripts = dependencies.runStructureScripts ?? structureScriptsCommand
  const runDraftPrompts = dependencies.runDraftPrompts ?? ((opts: DraftScenesCommandOptions) => draftPromptsCommand({ sceneSlug: opts.sceneSlug }))
  const runSceneDraft = dependencies.runSceneDraft ?? runSceneDraftStage
  const runPanelPrompts = dependencies.runPanelPrompts ?? panelPromptsCommand
  const stages = getDraftSceneStages(options.only)
  const startTime = Date.now()

  if (logMode === 'standalone') {
    comicLog.header('comic draft-scenes', [
      `scene=${options.sceneSlug}`,
      `stages=${stages.join(',')}`,
    ])
  }

  for (const stage of stages) {
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

  const durationMs = Date.now() - startTime

  if (logMode === 'standalone') {
    comicLog.summary([
      `stages=${stages.length}`,
      `duration=${formatDuration(durationMs)}`,
    ])
    comicLog.outputDirectory(getSceneOutputDirectory(options.sceneSlug))
  }

  return { stages, durationMs }
}
