import { mkdir, rename, rm } from 'node:fs/promises'
import type { Step6VideoMetadata } from '~/types'
import * as l from '~/logger'
import {
  type VideoGenOptions,
  type VideoTarget,
  collectVideoTargets,
  getVideoArtifactFileName,
  sanitizeVideoModelName,
} from './video-targets'

const getTargetWorkspaceDir = (outputDir: string, target: VideoTarget): string =>
  `${outputDir}/.video-tmp-${target.service}-${sanitizeVideoModelName(target.model)}`

export const runVideoTargets = async (
  targets: VideoTarget[],
  prompt: string,
  outputDir: string,
): Promise<{ videoPaths: string[], metadata: Step6VideoMetadata[] }> => {
  const successes: Array<{ videoPath: string, metadata: Step6VideoMetadata }> = []
  const failedTargets: string[] = []
  const singleTarget = targets.length === 1

  for (const target of targets) {
    const workspaceDir = singleTarget ? outputDir : getTargetWorkspaceDir(outputDir, target)

    try {
      if (!singleTarget) {
        await mkdir(workspaceDir, { recursive: true })
      }

      const { videoPath, metadata } = await target.run(prompt, workspaceDir)

      if (singleTarget) {
        successes.push({ videoPath, metadata })
      } else {
        const finalFileName = getVideoArtifactFileName(target, singleTarget)
        const finalPath = `${outputDir}/${finalFileName}`
        await rename(videoPath, finalPath)
        successes.push({
          videoPath: finalPath,
          metadata: {
            ...metadata,
            videoFileName: finalFileName,
            videoFileSize: Bun.file(finalPath).size,
          }
        })
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      l.error(`Failed to run video target ${target.service}/${target.model}: ${message}`)
      failedTargets.push(`${target.service}/${target.model}: ${message}`)
    } finally {
      if (!singleTarget) {
        await rm(workspaceDir, { recursive: true, force: true })
      }
    }
  }

  if (successes.length === 0) {
    const details = failedTargets.length > 0 ? failedTargets.join('; ') : 'No provider produced video'
    throw new Error(`No video outputs were generated. ${details}`)
  }

  if (failedTargets.length > 0) {
    l.warn(`Video run completed with partial failures: ${failedTargets.join('; ')}`)
  }

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
