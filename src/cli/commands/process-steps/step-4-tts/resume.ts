import { getGenerationTargetKey } from '~/cli/commands/process-steps/generation-command-utils'
import { hasResumableGenerationWork, resumeGenerationTarget } from '~/cli/commands/process-steps/generation-resume-utils'
import { collectTtsTargets } from './tts-targets'
import { runTtsTargets } from './run-tts'
import type { ResumeTarget, RuntimeOptions, Step4Metadata, TtsTarget } from '~/types'

const ttsResumeConfig = {
  kind: 'tts' as const,
  metadataKey: 'tts',
  stepLabel: 'TTS',
  getSuccessKey: (entry: Step4Metadata) =>
    getGenerationTargetKey(entry.ttsService, entry.ttsModel),
  collectTargets: (opts: RuntimeOptions) => collectTtsTargets(opts),
  runMissingTargets: async (
    targets: TtsTarget[],
    input: string,
    outputDir: string,
    opts: RuntimeOptions
  ) => await runTtsTargets(targets, input, outputDir, opts)
}

export const hasResumableTtsWork = async (
  target: ResumeTarget,
  opts: RuntimeOptions
): Promise<boolean> =>
  await hasResumableGenerationWork(target, ttsResumeConfig, opts)

export const resumeTtsTarget = async (
  target: ResumeTarget,
  opts: RuntimeOptions
): Promise<void> =>
  await resumeGenerationTarget(target, ttsResumeConfig, opts)
