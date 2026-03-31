import { rename } from 'node:fs/promises'
import type { Step7MusicMetadata } from '~/types'
import { sanitizeModelName, runTargets } from '~/cli/commands/process-steps/target-runner'
import {
  type MusicGenOptions,
  type MusicTarget,
  collectMusicTargets,
  getMusicArtifactFileName,
} from './music-targets'

type MusicResult = { musicPath: string, metadata: Step7MusicMetadata }

export const runMusicTargets = async (
  targets: MusicTarget[],
  prompt: string,
  outputDir: string,
): Promise<{ musicPaths: string[], metadata: Step7MusicMetadata[] }> => {
  const successes = await runTargets<MusicTarget, MusicResult>({
    targets,
    outputDir,
    stepLabel: 'music',
    noProviderMessage: 'No provider produced music',
    getWorkspaceDir: (dir, target) =>
      `${dir}/.music-tmp-${target.service}-${sanitizeModelName(target.model)}`,
    runTarget: async (target, workspaceDir) =>
      target.run(prompt, workspaceDir),
    finalizeTarget: async (target, result, singleTarget) => {
      if (singleTarget) return result

      const finalFileName = getMusicArtifactFileName(target, singleTarget)
      const finalPath = `${outputDir}/${finalFileName}`
      await rename(result.musicPath, finalPath)
      return {
        musicPath: finalPath,
        metadata: {
          ...result.metadata,
          musicFileName: finalFileName,
          musicFileSize: Bun.file(finalPath).size,
        }
      }
    },
  })

  return {
    musicPaths: successes.map((entry) => entry.musicPath),
    metadata: successes.map((entry) => entry.metadata),
  }
}

export const runMusicGen = async (
  prompt: string,
  outputDir: string,
  options: MusicGenOptions
): Promise<{ musicPaths: string[], metadata: Step7MusicMetadata[] }> => {
  const targets = collectMusicTargets(options)
  if (targets.length === 0) {
    throw new Error('Specify a music generation provider: --elevenlabs-music <model> or --minimax-music <model>')
  }

  return await runMusicTargets(targets, prompt, outputDir)
}
