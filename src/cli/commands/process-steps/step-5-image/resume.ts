import { getGenerationTargetKey } from '~/cli/commands/process-steps/generation-command-utils'
import { buildUpdatedGenerationCostTiming, hasResumableGenerationWork, resumeGenerationTarget } from '~/cli/commands/process-steps/generation-resume-utils'
import { collectImageTargets } from './image-targets'
import { runImageTargets } from './run-image-gen'
import { computeActualCosts } from '~/utils/pricing/compute-actual-costs'
import { computeActualProcessingTimes } from '~/utils/pricing/compute-processing-time'
import type { ResumeTarget, RuntimeOptions, Step5Metadata, ImageTarget } from '~/types'

const IMAGE_PROVIDER_FLAGS = [
  'all-image',
  'gemini-image',
  'openai-image',
  'grok-image',
  'bfl-image',
  'reve-image'
] as const

const IMAGE_MODEL_FIELDS = {
  gemini: ['geminiImageModels', 'geminiImageModel'],
  openai: ['openaiImageModels', 'openaiImageModel'],
  grok: ['grokImageModels', 'grokImageModel'],
  bfl: ['bflImageModels', 'bflImageModel'],
  reve: ['reveImageModels', 'reveImageModel']
} as const

const clearImageProviderModels = (opts: RuntimeOptions): RuntimeOptions => ({
  ...opts,
  geminiImageModels: undefined,
  geminiImageModel: undefined,
  openaiImageModels: undefined,
  openaiImageModel: undefined,
  grokImageModels: undefined,
  grokImageModel: undefined,
  bflImageModels: undefined,
  bflImageModel: undefined,
  reveImageModels: undefined,
  reveImageModel: undefined
})

const collectImageTargetsForProviders = (
  providers: Array<{ service: string, model: string }>,
  opts: RuntimeOptions
): ImageTarget[] =>
  providers.flatMap((provider) => {
    const fields = IMAGE_MODEL_FIELDS[provider.service as keyof typeof IMAGE_MODEL_FIELDS]
    if (!fields) {
      return []
    }
    const [modelsField, modelField] = fields
    return collectImageTargets({
      ...clearImageProviderModels(opts),
      [modelsField]: [provider.model],
      [modelField]: provider.model
    } as RuntimeOptions).filter((target) =>
      target.service === provider.service && target.model === provider.model
    )
  })

const imageResumeConfig = {
  kind: 'image' as const,
  metadataKey: 'image',
  stepLabel: 'Image',
  providerFlags: IMAGE_PROVIDER_FLAGS,
  getSuccessKey: (entry: Step5Metadata) =>
    getGenerationTargetKey(entry.imageService, entry.imageModel),
  collectTargets: (opts: RuntimeOptions) => collectImageTargets(opts),
  collectTargetsForProviders: collectImageTargetsForProviders,
  runMissingTargets: async (
    targets: ImageTarget[],
    input: string,
    outputDir: string,
    opts: RuntimeOptions
  ) => {
    const { metadata } = await runImageTargets(targets, input, outputDir, opts)
    return metadata
  },
  rebuildRunMetadata: (
    metadata: Step5Metadata[],
    currentManifestMetadata: Record<string, unknown>
  ) => buildUpdatedGenerationCostTiming(
    currentManifestMetadata,
    computeActualCosts({ step5: metadata }),
    computeActualProcessingTimes({ step5: metadata })
  )
}

export const hasResumableImageWork = async (
  target: ResumeTarget,
  opts: RuntimeOptions,
  explicitFlags: Set<string> = new Set()
): Promise<boolean> =>
  await hasResumableGenerationWork(target, imageResumeConfig, opts, explicitFlags)

export const resumeImageTarget = async (
  target: ResumeTarget,
  opts: RuntimeOptions,
  explicitFlags: Set<string> = new Set()
): Promise<void> =>
  await resumeGenerationTarget(target, imageResumeConfig, opts, explicitFlags)
