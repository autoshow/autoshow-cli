import { mkdir, rename, rm } from 'node:fs/promises'
import type { Step7MusicMetadata } from '~/types'
import * as l from '~/logger'
import {
  type MusicGenOptions,
  type MusicTarget,
  collectMusicTargets,
  getMusicArtifactFileName,
  sanitizeMusicModelName,
} from './music-targets'

const getTargetWorkspaceDir = (outputDir: string, target: MusicTarget): string =>
  `${outputDir}/.music-tmp-${target.service}-${sanitizeMusicModelName(target.model)}`

export const runMusicTargets = async (
  targets: MusicTarget[],
  prompt: string,
  outputDir: string,
): Promise<{ musicPaths: string[], metadata: Step7MusicMetadata[] }> => {
  const successes: Array<{ musicPath: string, metadata: Step7MusicMetadata }> = []
  const failedTargets: string[] = []
  const singleTarget = targets.length === 1

  for (const target of targets) {
    const workspaceDir = singleTarget ? outputDir : getTargetWorkspaceDir(outputDir, target)

    try {
      if (!singleTarget) {
        await mkdir(workspaceDir, { recursive: true })
      }

      const { musicPath, metadata } = await target.run(prompt, workspaceDir)

      if (singleTarget) {
        successes.push({ musicPath, metadata })
      } else {
        const finalFileName = getMusicArtifactFileName(target, singleTarget)
        const finalPath = `${outputDir}/${finalFileName}`
        await rename(musicPath, finalPath)
        successes.push({
          musicPath: finalPath,
          metadata: {
            ...metadata,
            musicFileName: finalFileName,
            musicFileSize: Bun.file(finalPath).size,
          }
        })
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      l.error(`Failed to run music target ${target.service}/${target.model}: ${message}`)
      failedTargets.push(`${target.service}/${target.model}: ${message}`)
    } finally {
      if (!singleTarget) {
        await rm(workspaceDir, { recursive: true, force: true })
      }
    }
  }

  if (successes.length === 0) {
    const details = failedTargets.length > 0 ? failedTargets.join('; ') : 'No provider produced music'
    throw new Error(`No music outputs were generated. ${details}`)
  }

  if (failedTargets.length > 0) {
    l.warn(`Music run completed with partial failures: ${failedTargets.join('; ')}`)
  }

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
