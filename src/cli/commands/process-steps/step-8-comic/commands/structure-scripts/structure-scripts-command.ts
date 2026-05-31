import { err } from '../../utils/logger'
import { generateStructuredScript } from '../../utils/structured-script-utils'
import type {
  StructureScriptsCommandOptions,
  StructuredScriptRunStats,
} from '../../types/comic-command-types'



export const structureScriptsCommand = async (
  options: StructureScriptsCommandOptions
): Promise<StructuredScriptRunStats> => {
  try {
    return await generateStructuredScript(
      options.scriptPath,
      options.sceneSlug,
      {
        ...(options.llmModel ? { llmModel: options.llmModel } : {}),
      }
    )
  } catch (error) {
    err('Structured script generation failed:', error instanceof Error ? error.message : String(error))
    throw new Error('Failed at structured script generation step')
  }
}
