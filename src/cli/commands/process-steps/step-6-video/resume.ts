import { getGenerationTargetKey } from '~/cli/commands/process-steps/generation-command-utils'
import { buildUpdatedGenerationCostTiming, hasResumableGenerationWork, resumeGenerationTarget } from '~/cli/commands/process-steps/generation-resume-utils'
import { collectVideoTargets } from './video-targets'
import { runVideoTargets } from './run-video-gen'
import { computeActualCosts } from '~/utils/pricing/compute-actual-costs'
import { computeActualProcessingTimes } from '~/utils/pricing/compute-processing-time'
import type { ResumeTarget, RuntimeOptions, Step6VideoMetadata, VideoTarget } from '~/types'

const VIDEO_PROVIDER_FLAGS = [
  'gemini-video',
  'minimax-video',
  'glm-video',
  'grok-video',
  'runway-video',
  'deapi-video'
] as const

const VIDEO_MODEL_FIELDS = {
  gemini: ['geminiVideoModels', 'geminiVideoModel'],
  minimax: ['minimaxVideoModels', 'minimaxVideoModel'],
  glm: ['glmVideoModels', 'glmVideoModel'],
  grok: ['grokVideoModels', 'grokVideoModel'],
  runway: ['runwayVideoModels', 'runwayVideoModel'],
  deapi: ['deapiVideoModels', 'deapiVideoModel']
} as const

const clearVideoProviderModels = (opts: RuntimeOptions): RuntimeOptions => ({
  ...opts,
  geminiVideoModels: undefined,
  geminiVideoModel: undefined,
  minimaxVideoModels: undefined,
  minimaxVideoModel: undefined,
  glmVideoModels: undefined,
  glmVideoModel: undefined,
  grokVideoModels: undefined,
  grokVideoModel: undefined,
  runwayVideoModels: undefined,
  runwayVideoModel: undefined,
  deapiVideoModels: undefined,
  deapiVideoModel: undefined
})

const collectVideoTargetsForProviders = (
  providers: Array<{ service: string, model: string }>,
  opts: RuntimeOptions
): VideoTarget[] =>
  providers.flatMap((provider) => {
    const fields = VIDEO_MODEL_FIELDS[provider.service as keyof typeof VIDEO_MODEL_FIELDS]
    if (!fields) {
      return []
    }
    const [modelsField, modelField] = fields
    return collectVideoTargets({
      ...clearVideoProviderModels(opts),
      [modelsField]: [provider.model],
      [modelField]: provider.model
    } as RuntimeOptions).filter((target) =>
      target.service === provider.service && target.model === provider.model
    )
  })

const videoResumeConfig = {
  kind: 'video' as const,
  metadataKey: 'video',
  stepLabel: 'Video',
  providerFlags: VIDEO_PROVIDER_FLAGS,
  getSuccessKey: (entry: Step6VideoMetadata) =>
    getGenerationTargetKey(entry.videoGenService, entry.videoGenModel),
  collectTargets: (opts: RuntimeOptions) => collectVideoTargets(opts),
  collectTargetsForProviders: collectVideoTargetsForProviders,
  runMissingTargets: async (
    targets: VideoTarget[],
    input: string,
    outputDir: string,
    opts: RuntimeOptions
  ) => {
    const { metadata } = await runVideoTargets(targets, input, outputDir, opts)
    return metadata
  },
  rebuildRunMetadata: (
    metadata: Step6VideoMetadata[],
    currentManifestMetadata: Record<string, unknown>
  ) => buildUpdatedGenerationCostTiming(
    currentManifestMetadata,
    computeActualCosts({ step6: metadata }),
    computeActualProcessingTimes({ step6: metadata })
  )
}

export const hasResumableVideoWork = async (
  target: ResumeTarget,
  opts: RuntimeOptions,
  explicitFlags: Set<string> = new Set()
): Promise<boolean> =>
  await hasResumableGenerationWork(target, videoResumeConfig, opts, explicitFlags)

export const resumeVideoTarget = async (
  target: ResumeTarget,
  opts: RuntimeOptions,
  explicitFlags: Set<string> = new Set()
): Promise<void> =>
  await resumeGenerationTarget(target, videoResumeConfig, opts, explicitFlags)
