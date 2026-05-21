import { getGenerationTargetKey } from '~/cli/commands/process-steps/generation-command-utils'
import { buildUpdatedGenerationCostTiming, hasResumableGenerationWork, resumeGenerationTarget } from '~/cli/commands/process-steps/generation-resume-utils'
import { collectTtsTargets } from './tts-targets'
import { runTtsTargets } from './run-tts'
import { computeActualCosts } from '~/utils/pricing/compute-actual-costs'
import { computeActualProcessingTimes } from '~/utils/pricing/compute-processing-time'
import type { ResumeTarget, RuntimeOptions, Step4Metadata, TtsTarget } from '~/types'

const TTS_PROVIDER_FLAGS = [
  'all-tts',
  'kitten-tts',
  'elevenlabs-tts',
  'minimax-tts',
  'groq-tts',
  'grok-tts',
  'mistral-tts',
  'openai-tts',
  'gemini-tts',
  'deepgram-tts',
  'speechify-tts',
  'hume-tts',
  'cartesia-tts',
  'gcloud-tts'
] as const

const TTS_MODEL_FIELDS = {
  kitten: ['kittenTtsModels', 'kittenTtsModel'],
  elevenlabs: ['elevenlabsTtsModels', 'elevenlabsTtsModel'],
  minimax: ['minimaxTtsModels', 'minimaxTtsModel'],
  groq: ['groqTtsModels', 'groqTtsModel'],
  grok: ['grokTtsModels', 'grokTtsModel'],
  mistral: ['mistralTtsModels', 'mistralTtsModel'],
  openai: ['openaiTtsModels', 'openaiTtsModel'],
  gemini: ['geminiTtsModels', 'geminiTtsModel'],
  deepgram: ['deepgramTtsModels', 'deepgramTtsModel'],
  speechify: ['speechifyTtsModels', 'speechifyTtsModel'],
  hume: ['humeTtsModels', 'humeTtsModel'],
  cartesia: ['cartesiaTtsModels', 'cartesiaTtsModel'],
  gcloud: ['gcloudTtsModels', 'gcloudTtsModel']
} as const

const clearTtsProviderModels = (opts: RuntimeOptions): RuntimeOptions => ({
  ...opts,
  kittenTtsModels: undefined,
  kittenTtsModel: undefined,
  elevenlabsTtsModels: undefined,
  elevenlabsTtsModel: undefined,
  minimaxTtsModels: undefined,
  minimaxTtsModel: undefined,
  groqTtsModels: undefined,
  groqTtsModel: undefined,
  grokTtsModels: undefined,
  grokTtsModel: undefined,
  mistralTtsModels: undefined,
  mistralTtsModel: undefined,
  openaiTtsModels: undefined,
  openaiTtsModel: undefined,
  geminiTtsModels: undefined,
  geminiTtsModel: undefined,
  deepgramTtsModels: undefined,
  deepgramTtsModel: undefined,
  speechifyTtsModels: undefined,
  speechifyTtsModel: undefined,
  humeTtsModels: undefined,
  humeTtsModel: undefined,
  cartesiaTtsModels: undefined,
  cartesiaTtsModel: undefined,
  gcloudTtsModels: undefined,
  gcloudTtsModel: undefined
})

const collectTtsTargetsForProviders = (
  providers: Array<{ service: string, model: string }>,
  opts: RuntimeOptions
): TtsTarget[] =>
  providers.flatMap((provider) => {
    const fields = TTS_MODEL_FIELDS[provider.service as keyof typeof TTS_MODEL_FIELDS]
    if (!fields) {
      return []
    }
    const [modelsField, modelField] = fields
    return collectTtsTargets({
      ...clearTtsProviderModels(opts),
      [modelsField]: [provider.model],
      [modelField]: provider.model
    } as RuntimeOptions).filter((target) =>
      target.service === provider.service && target.model === provider.model
    )
  })

const ttsResumeConfig = {
  kind: 'tts' as const,
  metadataKey: 'tts',
  stepLabel: 'TTS',
  providerFlags: TTS_PROVIDER_FLAGS,
  getSuccessKey: (entry: Step4Metadata) =>
    getGenerationTargetKey(entry.ttsService, entry.ttsModel),
  collectTargets: (opts: RuntimeOptions) => collectTtsTargets(opts),
  collectTargetsForProviders: collectTtsTargetsForProviders,
  runMissingTargets: async (
    targets: TtsTarget[],
    input: string,
    outputDir: string,
    opts: RuntimeOptions
  ) => await runTtsTargets(targets, input, outputDir, opts),
  rebuildRunMetadata: (
    metadata: Step4Metadata[],
    currentManifestMetadata: Record<string, unknown>,
    input: string
  ) => buildUpdatedGenerationCostTiming(
    currentManifestMetadata,
    computeActualCosts({ step4: metadata, ttsCharacterCount: input.length }),
    computeActualProcessingTimes({ step4: metadata, ttsCharacterCount: input.length })
  )
}

export const hasResumableTtsWork = async (
  target: ResumeTarget,
  opts: RuntimeOptions,
  explicitFlags: Set<string> = new Set()
): Promise<boolean> =>
  await hasResumableGenerationWork(target, ttsResumeConfig, opts, explicitFlags)

export const resumeTtsTarget = async (
  target: ResumeTarget,
  opts: RuntimeOptions,
  explicitFlags: Set<string> = new Set()
): Promise<void> =>
  await resumeGenerationTarget(target, ttsResumeConfig, opts, explicitFlags)
