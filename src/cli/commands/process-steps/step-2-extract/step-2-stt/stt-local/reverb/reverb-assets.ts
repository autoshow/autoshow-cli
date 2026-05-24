import { stat } from 'node:fs/promises'
import { join } from 'node:path'
import { RUNTIME_DIR } from '~/utils/runtime-paths'

export const REVERB_ASR_REQUIRED_FILES = [
  'reverb_asr_v1.pt',
  'config.yaml',
  'en-cmvn.json',
  'tk.model',
  'tk.units.txt'
] as const

export type ReverbAsrRequiredFile = typeof REVERB_ASR_REQUIRED_FILES[number]

export const reverbModelDir = join(RUNTIME_DIR, 'models/reverb/reverb_asr_v1')
export const reverbModelPath = join(reverbModelDir, 'reverb_asr_v1.pt')
export const reverbConfigPath = join(reverbModelDir, 'config.yaml')
export const reverbDiarizationDir = join(RUNTIME_DIR, 'models/reverb/diarization-v2')
export const reverbDiarizationConfigPath = join(reverbDiarizationDir, 'config.yaml')
export const reverbDiarizationSegmentationCheckpointPath = join(reverbDiarizationDir, 'pytorch_model.bin')
export const reverbDiarizationEmbeddingDir = join(RUNTIME_DIR, 'models/reverb/pyannote-wespeaker-voxceleb-resnet34-LM')
export const reverbDiarizationEmbeddingCheckpointPath = join(reverbDiarizationEmbeddingDir, 'pytorch_model.bin')

export const REVERB_DIARIZATION_PIPELINE_REQUIRED_FILES = [
  'config.yaml',
  'pytorch_model.bin'
] as const

export const REVERB_DIARIZATION_EMBEDDING_REQUIRED_FILES = [
  'pytorch_model.bin'
] as const

export const REVERB_DIARIZATION_REQUIRED_FILES = [
  'diarization-v2/config.yaml',
  'diarization-v2/pytorch_model.bin',
  'pyannote-wespeaker-voxceleb-resnet34-LM/pytorch_model.bin'
] as const

const pathExistsAsFile = async (path: string): Promise<boolean> => {
  try {
    return (await stat(path)).isFile()
  } catch {
    return false
  }
}

export const getReverbAsrAssetPath = (file: ReverbAsrRequiredFile): string =>
  join(reverbModelDir, file)

export type ReverbDiarizationRequiredFile = typeof REVERB_DIARIZATION_REQUIRED_FILES[number]

export const getReverbDiarizationAssetPath = (file: ReverbDiarizationRequiredFile): string =>
  join(RUNTIME_DIR, 'models/reverb', file)

export const getMissingReverbAsrFiles = async (
  exists: (path: string) => Promise<boolean> = pathExistsAsFile
): Promise<ReverbAsrRequiredFile[]> => {
  const missing: ReverbAsrRequiredFile[] = []
  for (const file of REVERB_ASR_REQUIRED_FILES) {
    if (!await exists(getReverbAsrAssetPath(file))) {
      missing.push(file)
    }
  }
  return missing
}

export const checkReverbAsrAssets = async (
  exists?: (path: string) => Promise<boolean>
): Promise<boolean> =>
  (await getMissingReverbAsrFiles(exists)).length === 0

export const formatReverbAsrAssetPaths = (): string =>
  REVERB_ASR_REQUIRED_FILES.map(getReverbAsrAssetPath).join(', ')

export const getMissingReverbDiarizationFiles = async (
  exists: (path: string) => Promise<boolean> = pathExistsAsFile
): Promise<ReverbDiarizationRequiredFile[]> => {
  const missing: ReverbDiarizationRequiredFile[] = []
  for (const file of REVERB_DIARIZATION_REQUIRED_FILES) {
    if (!await exists(getReverbDiarizationAssetPath(file))) {
      missing.push(file)
    }
  }
  return missing
}

export const checkReverbDiarizationAssets = async (
  exists?: (path: string) => Promise<boolean>
): Promise<boolean> =>
  (await getMissingReverbDiarizationFiles(exists)).length === 0

export const formatReverbDiarizationAssetPaths = (): string =>
  REVERB_DIARIZATION_REQUIRED_FILES.map(getReverbDiarizationAssetPath).join(', ')
