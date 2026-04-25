import { getGenerationTargetKey } from '~/cli/commands/process-steps/generation-command-utils'
import { hasResumableGenerationWork, resumeGenerationTarget } from '~/cli/commands/process-steps/generation-resume-utils'
import { collectImageTargets } from './image-targets'
import { runImageTargets } from './run-image-gen'
import type { ResumeTarget, RuntimeOptions, Step5Metadata, ImageTarget } from '~/types'

const imageResumeConfig = {
  kind: 'image' as const,
  metadataKey: 'image',
  stepLabel: 'Image',
  getSuccessKey: (entry: Step5Metadata) =>
    getGenerationTargetKey(entry.imageService, entry.imageModel),
  collectTargets: (opts: RuntimeOptions) => collectImageTargets(opts),
  runMissingTargets: async (
    targets: ImageTarget[],
    input: string,
    outputDir: string,
    opts: RuntimeOptions
  ) => {
    const { metadata } = await runImageTargets(targets, input, outputDir, opts)
    return metadata
  }
}

export const hasResumableImageWork = async (
  target: ResumeTarget,
  opts: RuntimeOptions
): Promise<boolean> =>
  await hasResumableGenerationWork(target, imageResumeConfig, opts)

export const resumeImageTarget = async (
  target: ResumeTarget,
  opts: RuntimeOptions
): Promise<void> =>
  await resumeGenerationTarget(target, imageResumeConfig, opts)
