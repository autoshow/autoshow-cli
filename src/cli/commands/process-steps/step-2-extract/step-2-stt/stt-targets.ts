import type { RuntimeOptions, SttTarget } from '~/types'
import type { Step2ProviderSelectionFilter } from '../step-2-shared/provider-registry'
import { collectSttProviderSpecs, resolveDiarizationOptions } from './cli'

const sanitizeSegment = (value: string): string =>
  value.replace(/[/\\:*?"<>|]+/g, '_')

export const getSttTargetKey = (target: Pick<SttTarget, 'service' | 'model'>): string =>
  `${target.service}:${target.model}`

export const formatSttTargetLabel = (target: Pick<SttTarget, 'service' | 'model'>): string =>
  `${target.service === 'whisper' ? 'whisper.cpp' : target.service}/${target.model}`

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
      ...(service === 'aws' && options.awsRegion ? { awsRegion: options.awsRegion } : {}),
      ...(service === 'aws' && options.awsBucket ? { awsBucket: options.awsBucket } : {}),
      ...(service === 'whisper' || service === 'reverb'
        ? {}
        : { diarizationOptions: resolveDiarizationOptions(options, service) })
    } satisfies SttTarget
  })
}
