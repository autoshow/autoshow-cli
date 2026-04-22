import { rename } from 'node:fs/promises'
import type { Step4Metadata, TtsOptions, TtsTarget } from '~/types'
import { sanitizeModelName, runTargets } from '~/cli/commands/process-steps/target-runner'
import {
  collectTtsTargets,
  getTtsArtifactFileName,
  validateTtsInput,
} from './tts-targets'

const getMetadataAudioPath = (outputDir: string, metadata: Step4Metadata): string =>
  `${outputDir}/${metadata.audioFileName}`

export const runTtsTargets = async (
  targets: TtsTarget[],
  text: string,
  outputDir: string,
  _options: TtsOptions
): Promise<Step4Metadata[]> =>
  runTargets<TtsTarget, Step4Metadata>({
    targets,
    outputDir,
    stepLabel: 'TTS',
    noProviderMessage: 'No provider produced audio',
    getWorkspaceDir: (dir, target) =>
      `${dir}/.tts-tmp-${target.service}-${sanitizeModelName(target.model)}`,
    runTarget: async (target, workspaceDir) => {
      const { audioPath, metadata } = await target.run(text, workspaceDir, _options)
      return { ...metadata, _audioPath: audioPath }
    },
    finalizeTarget: async (target, result, singleTarget) => {
      const { _audioPath, ...metadata } = result as Step4Metadata & { _audioPath: string }
      if (singleTarget) return metadata

      const fileName = getTtsArtifactFileName(target, false)
      const finalPath = `${outputDir}/${fileName}`
      await rename(_audioPath, finalPath)

      return {
        ...metadata,
        audioFileName: fileName,
        audioFileSize: Bun.file(finalPath).size
      }
    }
  })

export const runTts = async (
  text: string,
  outputDir: string,
  options: TtsOptions
): Promise<{ audioPaths: string[], metadata: Step4Metadata[] }> => {
  validateTtsInput(text, options)
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
