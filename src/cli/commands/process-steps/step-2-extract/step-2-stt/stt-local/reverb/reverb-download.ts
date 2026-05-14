import { mkdir, readdir, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { pathExists, reverbConfigPath, reverbDiarizationDir, reverbModelDir, reverbModelPath } from '~/cli/commands/setup-and-utilities/setup/run-complete-setup'
import { downloadHuggingFaceSnapshot } from '~/cli/commands/setup-and-utilities/setup/setup-download/huggingface'
import * as l from '~/utils/logger'
import { withRetry } from '~/utils/retries'
import { getHuggingFaceToken } from './reverb-huggingface'

const REVERB_ASR_REPO = 'Revai/reverb-asr'
const REVERB_ASR_REVISION = 'main'
const REVERB_ASR_REQUIRED_FILES = ['reverb_asr_v1.pt', 'config.yaml'] as const
const REVERB_DIARIZATION_REPO = 'Revai/reverb-diarization-v2'
const REVERB_DIARIZATION_REVISION = 'main'

const directoryHasFiles = async (root: string): Promise<boolean> => {
  try {
    const entries = await readdir(root, { withFileTypes: true })
    for (const entry of entries) {
      const path = join(root, entry.name)
      if (entry.isFile()) return true
      if (entry.isDirectory() && await directoryHasFiles(path)) return true
    }
    return false
  } catch {
    return false
  }
}

export const checkReverbModelExists = async (): Promise<boolean> => {
  return await pathExists(reverbModelPath) && await pathExists(reverbConfigPath)
}

export const checkDiarizationModelCached = async (): Promise<boolean> => {
  return await directoryHasFiles(reverbDiarizationDir)
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
      await rm(reverbModelDir, { recursive: true, force: true })
      await mkdir(reverbModelDir, { recursive: true })
      await downloadHuggingFaceSnapshot({
        repoId: REVERB_ASR_REPO,
        revision: REVERB_ASR_REVISION,
        token: hfToken,
        destination: reverbModelDir,
        allowPatterns: [...REVERB_ASR_REQUIRED_FILES],
        requiredFiles: [...REVERB_ASR_REQUIRED_FILES]
      })

      if (!await checkReverbModelExists()) {
        throw new Error('Reverb model files missing after download')
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
        await rm(reverbDiarizationDir, { recursive: true, force: true })
        await mkdir(reverbDiarizationDir, { recursive: true })
        await downloadHuggingFaceSnapshot({
          repoId: REVERB_DIARIZATION_REPO,
          revision: REVERB_DIARIZATION_REVISION,
          token: hfToken,
          destination: reverbDiarizationDir
        })
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
