import { mkdir, rename, rm } from 'node:fs/promises'
import type { Step4Metadata } from '~/types'
import * as l from '~/logger'
import {
  type TtsOptions,
  type TtsTarget,
  collectTtsTargets,
  getTtsArtifactFileName,
  sanitizeTtsModelName,
} from './tts-targets'

const getTargetWorkspaceDir = (outputDir: string, target: TtsTarget): string =>
  `${outputDir}/.tts-tmp-${target.service}-${sanitizeTtsModelName(target.model)}`

const getMetadataAudioPath = (outputDir: string, metadata: Step4Metadata): string =>
  `${outputDir}/${metadata.audioFileName}`

const finalizeTargetArtifact = async (
  outputDir: string,
  target: TtsTarget,
  audioPath: string,
  metadata: Step4Metadata,
  singleTarget: boolean
): Promise<Step4Metadata> => {
  if (singleTarget) {
    return metadata
  }

  const fileName = getTtsArtifactFileName(target, false)
  const finalPath = `${outputDir}/${fileName}`
  await rename(audioPath, finalPath)

  const audioFile = Bun.file(finalPath)
  return {
    ...metadata,
    audioFileName: fileName,
    audioFileSize: audioFile.size
  }
}

export const runTtsTargets = async (
  targets: TtsTarget[],
  text: string,
  outputDir: string,
  _options: TtsOptions
): Promise<Step4Metadata[]> => {
  const successes: Step4Metadata[] = []
  const failedTargets: string[] = []
  const singleTarget = targets.length === 1

  for (const target of targets) {
    const workspaceDir = singleTarget ? outputDir : getTargetWorkspaceDir(outputDir, target)

    try {
      if (!singleTarget) {
        await mkdir(workspaceDir, { recursive: true })
      }

      const { audioPath, metadata } = await target.run(text, workspaceDir, _options)
      const finalizedMetadata = await finalizeTargetArtifact(outputDir, target, audioPath, metadata, singleTarget)
      successes.push(finalizedMetadata)
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      l.error(`Failed to run TTS target ${target.service}/${target.model}: ${message}`)
      failedTargets.push(`${target.service}/${target.model}: ${message}`)
    } finally {
      if (!singleTarget) {
        await rm(workspaceDir, { recursive: true, force: true })
      }
    }
  }

  if (successes.length === 0) {
    const details = failedTargets.length > 0 ? failedTargets.join('; ') : 'No provider produced audio'
    throw new Error(`No TTS outputs were generated. ${details}`)
  }

  if (failedTargets.length > 0) {
    l.warn(`TTS run completed with partial failures: ${failedTargets.join('; ')}`)
  }

  return successes
}

export const runTts = async (
  text: string,
  outputDir: string,
  options: TtsOptions
): Promise<{ audioPaths: string[], metadata: Step4Metadata[] }> => {
  const targets = collectTtsTargets(options)
  if (targets.length === 0) {
    throw new Error('No TTS provider configured')
  }

  const metadata = await runTtsTargets(targets, text, outputDir, options)
  return {
    audioPaths: metadata.map((entry) => getMetadataAudioPath(outputDir, entry)),
    metadata
  }
}
