import type {
  PreparedSttMedia,
  ResolvedStep2Execution,
  RuntimeOptions,
  Step2Metadata,
  SttProviderState,
  SttTarget
} from '~/types'
import { mergeStep2TimingMetadata } from '../stt-timing-metadata'
import { formatSttTargetLabel } from '../stt-targets'
import { resolveSttStep2Execution } from '../../step-2-shared/resolved-step2'

export const resolveRecordedSttStep2 = (
  requestedTargets: Array<Pick<SttTarget, 'service' | 'model'>>,
  options: RuntimeOptions
): ResolvedStep2Execution => {
  const resolved = resolveSttStep2Execution(options)
  const resolvedProviders = resolved.route === 'stt' ? resolved.providers : []

  return {
    route: 'stt',
    sourceKind: 'media',
    providers: requestedTargets.map((target) => ({
      service: target.service,
      model: target.model,
      origin: resolvedProviders.find((provider) =>
        provider.service === target.service && provider.model === target.model
      )?.origin
    }))
  }
}

export const formatProviderStateIssue = (
  state: Pick<SttProviderState, 'service' | 'model' | 'lastError'>
): string => {
  const label = formatSttTargetLabel(state)
  return state.lastError?.message ? `${label}: ${state.lastError.message}` : label
}

export const withMergedStep2Timings = (
  metadata: Step2Metadata,
  ...timings: Array<Step2Metadata['timings']>
): Step2Metadata => {
  const mergedTimings = mergeStep2TimingMetadata([metadata.timings, ...timings])
  if (!mergedTimings) {
    return metadata
  }

  return {
    ...metadata,
    timings: mergedTimings
  }
}

export const resolveTargetAudioPath = (
  _target: SttTarget,
  prepared: PreparedSttMedia
): string => {
  const sourceMediaPath = prepared.executionArtifacts.sourceMediaPath
  return sourceMediaPath
}
