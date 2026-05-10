import { getGenerationTargetKey } from '~/cli/commands/process-steps/generation-command-utils'
import { hasResumableGenerationWork, resumeGenerationTarget } from '~/cli/commands/process-steps/generation-resume-utils'
import { collectVideoTargets } from './video-targets'
import { runVideoTargets } from './run-video-gen'
import type { ResumeTarget, RuntimeOptions, Step6VideoMetadata, VideoTarget } from '~/types'

const videoResumeConfig = {
  kind: 'video' as const,
  metadataKey: 'video',
  stepLabel: 'Video',
  getSuccessKey: (entry: Step6VideoMetadata) =>
    getGenerationTargetKey(entry.videoGenService, entry.videoGenModel),
  collectTargets: (opts: RuntimeOptions) => collectVideoTargets(opts),
  runMissingTargets: async (
    targets: VideoTarget[],
    input: string,
    outputDir: string,
    opts: RuntimeOptions
  ) => {
    const { metadata } = await runVideoTargets(targets, input, outputDir, opts)
    return metadata
  }
}

export const hasResumableVideoWork = async (
  target: ResumeTarget,
  opts: RuntimeOptions
): Promise<boolean> =>
  await hasResumableGenerationWork(target, videoResumeConfig, opts)

export const resumeVideoTarget = async (
  target: ResumeTarget,
  opts: RuntimeOptions
): Promise<void> =>
  await resumeGenerationTarget(target, videoResumeConfig, opts)
