import type { RuntimeOptions, SttTarget } from '~/types'
import { collectSttProviderSpecs, resolveDiarizationOptions } from './cli'

const sanitizeSegment = (value: string): string =>
  value.replace(/[/\\:*?"<>|]+/g, '_')

export const getSttTargetKey = (target: Pick<SttTarget, 'service' | 'model'>): string =>
  `${target.service}:${target.model}`

export const formatSttTargetLabel = (target: Pick<SttTarget, 'service' | 'model'>): string =>
  `${target.service === 'whisper' ? 'whisper.cpp' : target.service}/${target.model}`

export const getSttTargetDirectoryName = (target: Pick<SttTarget, 'service' | 'model'>): string =>
  `${sanitizeSegment(target.service)}-${sanitizeSegment(target.model)}`

export const collectSttTargets = (options: RuntimeOptions): SttTarget[] => {
  return collectSttProviderSpecs(options).map((spec) => {
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
