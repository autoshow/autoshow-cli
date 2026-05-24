import { mkdir } from 'node:fs/promises'
import { downloadHuggingFaceSnapshot } from '~/cli/commands/setup-and-utilities/setup/setup-download/huggingface'
import * as l from '~/utils/logger'
import { withRetry } from '~/utils/retries'
import { getHuggingFaceToken } from './reverb-huggingface'
import {
  checkReverbDiarizationAssets,
  checkReverbAsrAssets,
  getMissingReverbDiarizationFiles,
  getMissingReverbAsrFiles,
  REVERB_ASR_REQUIRED_FILES,
  REVERB_DIARIZATION_EMBEDDING_REQUIRED_FILES,
  REVERB_DIARIZATION_PIPELINE_REQUIRED_FILES,
  type ReverbDiarizationRequiredFile,
  reverbDiarizationDir,
  reverbDiarizationEmbeddingDir,
  reverbModelDir
} from './reverb-assets'

const REVERB_ASR_REPO = 'Revai/reverb-asr'
const REVERB_ASR_REVISION = 'main'
const REVERB_DIARIZATION_REPO = 'Revai/reverb-diarization-v2'
const REVERB_DIARIZATION_REVISION = 'main'
const REVERB_DIARIZATION_EMBEDDING_REPO = 'Revai/pyannote-wespeaker-voxceleb-resnet34-LM'
const REVERB_DIARIZATION_EMBEDDING_REVISION = 'main'

export const checkReverbModelExists = async (): Promise<boolean> => {
  return await checkReverbAsrAssets()
}

export const checkDiarizationModelCached = async (): Promise<boolean> => {
  return await checkReverbDiarizationAssets()
}

export const downloadReverbModel = async (): Promise<void> => {
  l.write('info', 'Downloading Reverb ASR model from Hugging Face')

  if (await checkReverbModelExists()) {
    return
  }

  const hfToken = getHuggingFaceToken()
  if (!hfToken) {
    l.error('HUGGINGFACE_TOKEN is required to download Reverb model assets')
    throw new Error('Missing HUGGINGFACE_TOKEN')
  }

  await withRetry(
    { retryClass: 'setup_download', operationName: 'reverb-model' },
    async () => {
      const missingBeforeDownload = await getMissingReverbAsrFiles()
      if (missingBeforeDownload.length === 0) {
        return
      }

      await mkdir(reverbModelDir, { recursive: true })
      await downloadHuggingFaceSnapshot({
        repoId: REVERB_ASR_REPO,
        revision: REVERB_ASR_REVISION,
        token: hfToken,
        destination: reverbModelDir,
        allowPatterns: [...missingBeforeDownload],
        requiredFiles: [...REVERB_ASR_REQUIRED_FILES]
      })

      const missing = await getMissingReverbAsrFiles()
      if (missing.length > 0) {
        throw new Error(`Reverb ASR files missing after download: ${missing.join(', ')}`)
      }
    }
  )

  l.write('success', 'Reverb ASR model downloaded')
}

export const downloadDiarizationModel = async (): Promise<boolean> => {
  if (await checkDiarizationModelCached()) {
    return true
  }

  const hfToken = getHuggingFaceToken()
  if (!hfToken) {
    l.warn('No HUGGINGFACE_TOKEN found, cannot download diarization model')
    return false
  }

  try {
    await withRetry(
      { retryClass: 'setup_download', operationName: 'reverb-diarization-model' },
      async () => {
        const missingBeforeDownload = await getMissingReverbDiarizationFiles()
        if (missingBeforeDownload.length === 0) {
          return
        }

        const missingPipelineFiles = missingBeforeDownload
          .filter((file): file is Extract<ReverbDiarizationRequiredFile, `diarization-v2/${string}`> =>
            file.startsWith('diarization-v2/')
          )
          .map(file => file.replace('diarization-v2/', ''))

        if (missingPipelineFiles.length > 0) {
          await mkdir(reverbDiarizationDir, { recursive: true })
          await downloadHuggingFaceSnapshot({
            repoId: REVERB_DIARIZATION_REPO,
            revision: REVERB_DIARIZATION_REVISION,
            token: hfToken,
            destination: reverbDiarizationDir,
            allowPatterns: missingPipelineFiles,
            requiredFiles: [...REVERB_DIARIZATION_PIPELINE_REQUIRED_FILES]
          })
        }

        const missingEmbeddingFiles = missingBeforeDownload
          .filter((file): file is Extract<ReverbDiarizationRequiredFile, `pyannote-wespeaker-voxceleb-resnet34-LM/${string}`> =>
            file.startsWith('pyannote-wespeaker-voxceleb-resnet34-LM/')
          )
          .map(file => file.replace('pyannote-wespeaker-voxceleb-resnet34-LM/', ''))

        if (missingEmbeddingFiles.length > 0) {
          await mkdir(reverbDiarizationEmbeddingDir, { recursive: true })
          await downloadHuggingFaceSnapshot({
            repoId: REVERB_DIARIZATION_EMBEDDING_REPO,
            revision: REVERB_DIARIZATION_EMBEDDING_REVISION,
            token: hfToken,
            destination: reverbDiarizationEmbeddingDir,
            allowPatterns: missingEmbeddingFiles,
            requiredFiles: [...REVERB_DIARIZATION_EMBEDDING_REQUIRED_FILES]
          })
        }

        const missing = await getMissingReverbDiarizationFiles()
        if (missing.length > 0) {
          throw new Error(`Reverb diarization files missing after download: ${missing.join(', ')}`)
        }
      }
    )
  } catch (error) {
    l.error('Failed to download diarization model v2')
    const details = error instanceof Error ? error.message : String(error)
    if (details) l.error(`Error details: ${details}`)
    return false
  }

  l.write('success', 'Diarization model v2 downloaded')
  return true
}
