import type { Step6VideoMetadata, VideoGenOptions, VideoTarget } from '~/types'
import { runSingleFileTargets } from '~/cli/commands/process-steps/target-runner'
import {
  collectVideoTargets,
  getVideoArtifactFileName,
} from './video-targets'

export const runVideoTargets = async (
  targets: VideoTarget[],
  prompt: string,
  outputDir: string,
  options?: Pick<VideoGenOptions, 'videoProviderConcurrency' | 'videoLocalConcurrency'>,
): Promise<{ videoPaths: string[], metadata: Step6VideoMetadata[] }> => {
  const successes = await runSingleFileTargets<VideoTarget, Step6VideoMetadata>({
    targets,
    outputDir,
    stepLabel: 'video',
    noProviderMessage: 'No provider produced video',
    concurrency: {
      provider: options?.videoProviderConcurrency ?? 2,
      local: options?.videoLocalConcurrency ?? 1
    },
    runTarget: async (target, workspaceDir) =>
      target.run(prompt, workspaceDir).then(({ videoPath, metadata }) => ({ filePath: videoPath, metadata })),
    workspacePrefix: '.video-tmp',
    getArtifactFileName: getVideoArtifactFileName,
    finalizeMetadata: (metadata, finalFileName, finalPath) => {
      return {
        ...metadata,
        videoFileName: finalFileName,
        videoFileSize: Bun.file(finalPath).size,
      }
    },
  })

  return {
    videoPaths: successes.map((entry) => entry.filePath),
    metadata: successes.map((entry) => entry.metadata),
  }
}

export const runVideoGen = async (
  prompt: string,
  outputDir: string,
  options: VideoGenOptions
): Promise<{ videoPaths: string[], metadata: Step6VideoMetadata[] }> => {
  const targets = collectVideoTargets(options)
  if (targets.length === 0) {
    throw new Error('Specify a video generation provider with --provider gemini|minimax|glm|grok|runway[=model].')
  }
  return await runVideoTargets(targets, prompt, outputDir, options)
}
