import { getGenerationTargetKey } from '~/cli/commands/process-steps/generation-command-utils'
import { hasResumableGenerationWork, resumeGenerationTarget } from '~/cli/commands/process-steps/generation-resume-utils'
import { collectMusicTargets } from './music-targets'
import { runMusicTargets } from './run-music-gen'
import type { ResumeTarget, RuntimeOptions, Step7MusicMetadata, MusicTarget } from '~/types'

const musicResumeConfig = {
  kind: 'music' as const,
  metadataKey: 'music',
  stepLabel: 'Music',
  getSuccessKey: (entry: Step7MusicMetadata) =>
    getGenerationTargetKey(entry.musicService, entry.musicModel),
  collectTargets: (opts: RuntimeOptions) => collectMusicTargets(opts),
  runMissingTargets: async (
    targets: MusicTarget[],
    input: string,
    outputDir: string,
    opts: RuntimeOptions
  ) => {
    const { metadata } = await runMusicTargets(targets, input, outputDir, opts)
    return metadata
  }
}

export const hasResumableMusicWork = async (
  target: ResumeTarget,
  opts: RuntimeOptions
): Promise<boolean> =>
  await hasResumableGenerationWork(target, musicResumeConfig, opts)

export const resumeMusicTarget = async (
  target: ResumeTarget,
  opts: RuntimeOptions
): Promise<void> =>
  await resumeGenerationTarget(target, musicResumeConfig, opts)
