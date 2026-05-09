import type { Step4Metadata, TtsTarget } from '~/types'
import { buildSingleArtifactMap, getSingleFileArtifactName } from '~/cli/commands/process-steps/target-runner'

const toTtsArtifactTarget = (
  target: Pick<TtsTarget, 'service' | 'model'> | Pick<Step4Metadata, 'ttsService' | 'ttsModel'>
): { service: string, model: string } =>
  'service' in target
    ? target
    : { service: target.ttsService, model: target.ttsModel }

export const getTtsArtifactFileName = (
  target: Pick<TtsTarget, 'service' | 'model'> | Pick<Step4Metadata, 'ttsService' | 'ttsModel'>,
  singleTarget: boolean
): string => {
  return getSingleFileArtifactName(toTtsArtifactTarget(target), singleTarget, {
    singleFileName: 'speech.wav',
    multiFilePrefix: 'speech',
    extension: 'wav'
  })
}

export const buildTtsArtifactMap = (
  metadata: Step4Metadata[],
  singleKey = 'speech'
): Record<string, string> =>
  buildSingleArtifactMap(metadata, {
    singleKey,
    multiKeyPrefix: 'speech',
    getService: (entry) => entry.ttsService,
    getModel: (entry) => entry.ttsModel,
    getFileName: (entry) => entry.audioFileName
  })

export const buildEstimatedTtsTargets = (
  targets: TtsTarget[]
): Array<{ service: Step4Metadata['ttsService'], model: string, setupCostCents?: number, setupTimeMs?: number, setupNote?: string }> =>
  targets.map((target) => ({
    service: target.service,
    model: target.model,
    ...(typeof target.setupCostCents === 'number' ? { setupCostCents: target.setupCostCents } : {}),
    ...(typeof target.setupTimeMs === 'number' ? { setupTimeMs: target.setupTimeMs } : {}),
    ...(typeof target.setupNote === 'string' ? { setupNote: target.setupNote } : {})
  }))
