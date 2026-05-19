import { getGenerationTargetKey } from '~/cli/commands/process-steps/generation-command-utils'
import { buildUpdatedGenerationCostTiming, hasResumableGenerationWork, resumeGenerationTarget } from '~/cli/commands/process-steps/generation-resume-utils'
import { collectMusicTargets } from './music-targets'
import { runMusicTargets } from './run-music-gen'
import { computeActualCosts } from '~/utils/pricing/compute-actual-costs'
import { computeActualProcessingTimes } from '~/utils/pricing/compute-processing-time'
import type { ResumeTarget, RuntimeOptions, Step7MusicMetadata, MusicTarget } from '~/types'

const MUSIC_PROVIDER_FLAGS = [
  'elevenlabs-music',
  'minimax-music',
  'deapi-music',
  'gemini-music'
] as const

const MUSIC_MODEL_FIELDS = {
  elevenlabs: ['elevenlabsMusicModels', 'elevenlabsMusicModel'],
  minimax: ['minimaxMusicModels', 'minimaxMusicModel'],
  deapi: ['deapiMusicModels', 'deapiMusicModel'],
  gemini: ['geminiMusicModels', 'geminiMusicModel']
} as const

const clearMusicProviderModels = (opts: RuntimeOptions): RuntimeOptions => ({
  ...opts,
  elevenlabsMusicModels: undefined,
  elevenlabsMusicModel: undefined,
  minimaxMusicModels: undefined,
  minimaxMusicModel: undefined,
  deapiMusicModels: undefined,
  deapiMusicModel: undefined,
  geminiMusicModels: undefined,
  geminiMusicModel: undefined
})

const collectMusicTargetsForProviders = (
  providers: Array<{ service: string, model: string }>,
  opts: RuntimeOptions
): MusicTarget[] =>
  providers.flatMap((provider) => {
    const fields = MUSIC_MODEL_FIELDS[provider.service as keyof typeof MUSIC_MODEL_FIELDS]
    if (!fields) {
      return []
    }
    const [modelsField, modelField] = fields
    return collectMusicTargets({
      ...clearMusicProviderModels(opts),
      [modelsField]: [provider.model],
      [modelField]: provider.model
    } as RuntimeOptions).filter((target) =>
      target.service === provider.service && target.model === provider.model
    )
  })

const musicResumeConfig = {
  kind: 'music' as const,
  metadataKey: 'music',
  stepLabel: 'Music',
  providerFlags: MUSIC_PROVIDER_FLAGS,
  getSuccessKey: (entry: Step7MusicMetadata) =>
    getGenerationTargetKey(entry.musicService, entry.musicModel),
  collectTargets: (opts: RuntimeOptions) => collectMusicTargets(opts),
  collectTargetsForProviders: collectMusicTargetsForProviders,
  runMissingTargets: async (
    targets: MusicTarget[],
    input: string,
    outputDir: string,
    opts: RuntimeOptions
  ) => {
    const { metadata } = await runMusicTargets(targets, input, outputDir, opts)
    return metadata
  },
  rebuildRunMetadata: (
    metadata: Step7MusicMetadata[],
    currentManifestMetadata: Record<string, unknown>
  ) => buildUpdatedGenerationCostTiming(
    currentManifestMetadata,
    computeActualCosts({ step7: metadata }),
    computeActualProcessingTimes({ step7: metadata })
  )
}

export const hasResumableMusicWork = async (
  target: ResumeTarget,
  opts: RuntimeOptions,
  explicitFlags: Set<string> = new Set()
): Promise<boolean> =>
  await hasResumableGenerationWork(target, musicResumeConfig, opts, explicitFlags)

export const resumeMusicTarget = async (
  target: ResumeTarget,
  opts: RuntimeOptions,
  explicitFlags: Set<string> = new Set()
): Promise<void> =>
  await resumeGenerationTarget(target, musicResumeConfig, opts, explicitFlags)
