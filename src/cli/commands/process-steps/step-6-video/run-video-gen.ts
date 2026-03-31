import { rename } from 'node:fs/promises'
import type { Step6VideoMetadata } from '~/types'
import { sanitizeModelName, runTargets } from '~/cli/commands/process-steps/target-runner'
import {
  type VideoGenOptions,
  type VideoTarget,
  collectVideoTargets,
  getVideoArtifactFileName,
} from './video-targets'

type VideoResult = { videoPath: string, metadata: Step6VideoMetadata }

export const runVideoTargets = async (
  targets: VideoTarget[],
  prompt: string,
  outputDir: string,
): Promise<{ videoPaths: string[], metadata: Step6VideoMetadata[] }> => {
  const successes = await runTargets<VideoTarget, VideoResult>({
    targets,
    outputDir,
    stepLabel: 'video',
    noProviderMessage: 'No provider produced video',
    getWorkspaceDir: (dir, target) =>
      `${dir}/.video-tmp-${target.service}-${sanitizeModelName(target.model)}`,
    runTarget: async (target, workspaceDir) =>
      target.run(prompt, workspaceDir),
    finalizeTarget: async (target, result, singleTarget) => {
      if (singleTarget) return result

      const finalFileName = getVideoArtifactFileName(target, singleTarget)
      const finalPath = `${outputDir}/${finalFileName}`
      await rename(result.videoPath, finalPath)
      return {
        videoPath: finalPath,
        metadata: {
          ...result.metadata,
          videoFileName: finalFileName,
          videoFileSize: Bun.file(finalPath).size,
        }
      }
    },
  })

  return {
    videoPaths: successes.map((entry) => entry.videoPath),
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
    throw new Error('Specify a video generation provider: --gemini-video <model>, or --minimax-video <model>')
  }
  return await runVideoTargets(targets, prompt, outputDir)
}
