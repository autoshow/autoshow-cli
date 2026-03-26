import { mkdir, rename, rm } from 'node:fs/promises'
import { basename } from 'node:path'
import type { Step5Metadata } from '~/types'
import * as l from '~/logger'
import {
  type ImageGenOptions,
  type ImageTarget,
  collectImageTargets,
  getImageArtifactFileNames,
  sanitizeImageModelName,
} from './image-targets'

const getTargetWorkspaceDir = (outputDir: string, target: ImageTarget): string =>
  `${outputDir}/.image-tmp-${target.service}-${sanitizeImageModelName(target.model)}`

const finalizeTargetArtifacts = async (
  outputDir: string,
  target: ImageTarget,
  imagePaths: string[],
  metadata: Step5Metadata,
  singleTarget: boolean
): Promise<{ imagePaths: string[], metadata: Step5Metadata }> => {
  const sourceFileNames = imagePaths.map((imagePath) => basename(imagePath))
  const finalFileNames = getImageArtifactFileNames(target, sourceFileNames, singleTarget)
  const finalImagePaths: string[] = []

  for (const [index, imagePath] of imagePaths.entries()) {
    const finalFileName = finalFileNames[index]
    if (!finalFileName) {
      continue
    }

    const finalPath = singleTarget ? imagePath : `${outputDir}/${finalFileName}`
    if (!singleTarget) {
      await rename(imagePath, finalPath)
    }
    finalImagePaths.push(finalPath)
  }

  const primaryPath = finalImagePaths[0]
  if (!primaryPath) {
    throw new Error(`No finalized image artifacts were produced for ${target.service}/${target.model}`)
  }

  return {
    imagePaths: finalImagePaths,
    metadata: {
      ...metadata,
      imageCount: finalImagePaths.length,
      imageFileName: finalFileNames[0] ?? metadata.imageFileName,
      imageFileNames: finalFileNames,
      imageFileSize: Bun.file(primaryPath).size,
    }
  }
}

export const runImageTargets = async (
  targets: ImageTarget[],
  prompt: string,
  outputDir: string,
  options: ImageGenOptions
): Promise<{ imagePaths: string[], metadata: Step5Metadata[] }> => {
  const successes: Array<{ imagePaths: string[], metadata: Step5Metadata }> = []
  const failedTargets: string[] = []
  const singleTarget = targets.length === 1

  for (const target of targets) {
    const workspaceDir = singleTarget ? outputDir : getTargetWorkspaceDir(outputDir, target)

    try {
      if (!singleTarget) {
        await mkdir(workspaceDir, { recursive: true })
      }

      const { imagePaths, metadata } = await target.run(prompt, workspaceDir, options)
      successes.push(await finalizeTargetArtifacts(outputDir, target, imagePaths, metadata, singleTarget))
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      l.error(`Failed to run image target ${target.service}/${target.model}: ${message}`)
      failedTargets.push(`${target.service}/${target.model}: ${message}`)
    } finally {
      if (!singleTarget) {
        await rm(workspaceDir, { recursive: true, force: true })
      }
    }
  }

  if (successes.length === 0) {
    const details = failedTargets.length > 0 ? failedTargets.join('; ') : 'No provider produced images'
    throw new Error(`No image outputs were generated. ${details}`)
  }

  if (failedTargets.length > 0) {
    l.warn(`Image run completed with partial failures: ${failedTargets.join('; ')}`)
  }

  return {
    imagePaths: successes.flatMap((entry) => entry.imagePaths),
    metadata: successes.map((entry) => entry.metadata)
  }
}

export const runImageGen = async (
  prompt: string,
  outputDir: string,
  options: ImageGenOptions
): Promise<{ imagePaths: string[], metadata: Step5Metadata[] }> => {
  const targets = collectImageTargets(options)
  if (targets.length === 0) {
    throw new Error('No image provider configured')
  }

  return await runImageTargets(targets, prompt, outputDir, options)
}
