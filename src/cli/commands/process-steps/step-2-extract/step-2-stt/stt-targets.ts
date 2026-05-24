import type { RuntimeOptions, Step2ProviderSelectionFilter, SttTarget } from '~/types'
import { collectSttProviderSpecs, resolveDiarizationOptions } from './cli'
import { resolveReverbModelLabel } from './stt-model-labels'

const sanitizeSegment = (value: string): string =>
  value.replace(/[/\\:*?"<>|]+/g, '_')

export const getSttTargetKey = (target: Pick<SttTarget, 'service' | 'model'>): string =>
  `${target.service}:${target.model}`

const formatSttTargetModel = (target: Pick<SttTarget, 'service' | 'model'>): string =>
  target.service === 'reverb' ? resolveReverbModelLabel(target.model) : target.model

export const formatSttTargetLabel = (target: Pick<SttTarget, 'service' | 'model'>): string =>
  `${target.service === 'whisper' ? 'whisper.cpp' : target.service}/${formatSttTargetModel(target)}`

export const getSttTargetDirectoryName = (target: Pick<SttTarget, 'service' | 'model'>): string =>
  `${sanitizeSegment(target.service)}-${sanitizeSegment(target.model)}`

export const collectSttTargets = (
  options: RuntimeOptions,
  filter?: Step2ProviderSelectionFilter
): SttTarget[] => {
  return collectSttProviderSpecs(options, filter).map((spec) => {
    const service = spec.provider as SttTarget['service']
    const model = spec.model ?? service

    return {
      service,
      model,
      local: service === 'reverb' || service === 'whisper',
      ...(service === 'whisper' || service === 'reverb'
        ? {}
        : { diarizationOptions: resolveDiarizationOptions(options, service) })
    } satisfies SttTarget
  })
}
