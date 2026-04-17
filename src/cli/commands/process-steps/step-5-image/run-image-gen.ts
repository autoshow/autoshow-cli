import { rename } from 'node:fs/promises'
import { basename } from 'node:path'
import type { ImageGenOptions, ImageResult, ImageTarget, Step5Metadata } from '~/types'
import { sanitizeModelName, runTargets } from '~/cli/commands/process-steps/target-runner'
import {
  collectImageTargets,
  getImageArtifactFileNames,
} from './image-targets'

const finalizeTargetArtifacts = async (
  outputDir: string,
  target: ImageTarget,
  result: ImageResult,
  singleTarget: boolean
): Promise<ImageResult> => {
  const sourceFileNames = result.imagePaths.map((imagePath) => basename(imagePath))
  const finalFileNames = getImageArtifactFileNames(target, sourceFileNames, singleTarget)
  const finalImagePaths: string[] = []

  for (const [index, imagePath] of result.imagePaths.entries()) {
    const finalFileName = finalFileNames[index]
    if (!finalFileName) continue

    const finalPath = singleTarget ? imagePath : `${outputDir}/${finalFileName}`
    if (!singleTarget) await rename(imagePath, finalPath)
    finalImagePaths.push(finalPath)
  }

  const primaryPath = finalImagePaths[0]
  if (!primaryPath) {
    throw new Error(`No finalized image artifacts were produced for ${target.service}/${target.model}`)
  }

  return {
    imagePaths: finalImagePaths,
    metadata: {
      ...result.metadata,
      imageCount: finalImagePaths.length,
      imageFileName: finalFileNames[0] ?? result.metadata.imageFileName,
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
  const successes = await runTargets<ImageTarget, ImageResult>({
    targets,
    outputDir,
    stepLabel: 'image',
    noProviderMessage: 'No provider produced images',
    getWorkspaceDir: (dir, target) =>
      `${dir}/.image-tmp-${target.service}-${sanitizeModelName(target.model)}`,
    runTarget: async (target, workspaceDir) =>
      target.run(prompt, workspaceDir, options),
    finalizeTarget: async (target, result, singleTarget) =>
      finalizeTargetArtifacts(outputDir, target, result, singleTarget),
  })

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
