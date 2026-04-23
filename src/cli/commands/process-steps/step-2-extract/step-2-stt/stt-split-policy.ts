import { getSttLimits } from '~/cli/commands/setup-and-utilities/models/model-loader'
import type { SttTarget } from '~/types'
import type { SttSplitDecision, SttSplitDecisionReason, SttSplitPolicy } from './stt-types'

export const DEFAULT_SPLIT_SEGMENT_DURATION_MINUTES = 30
export const SPLIT_DURATION_SAFETY_SECONDS = 1
export const SPLIT_ATTACHMENT_CAP_SAFETY_RATIO = 0.95

const resolveRequiredEffectiveBytes = (
  service: string,
  model: string
): number => {
  const effectiveBytes = getSttLimits(service, model).effectiveBytes
  if (effectiveBytes === undefined) {
    throw new Error(`Missing STT effectiveBytes limit for ${service}/${model}`)
  }

  return effectiveBytes
}

export const GROQ_MAX_ATTACHMENT_BYTES = resolveRequiredEffectiveBytes('groq', 'whisper-large-v3-turbo')
export const SPEECHMATICS_MAX_ATTACHMENT_BYTES = resolveRequiredEffectiveBytes('speechmatics', 'standard')
export const REV_MAX_ATTACHMENT_BYTES = resolveRequiredEffectiveBytes('rev', 'low_cost')
export const GLADIA_MAX_ATTACHMENT_BYTES = resolveRequiredEffectiveBytes('gladia', 'default')

export const resolveSttSplitPolicy = (
  target: Pick<SttTarget, 'service' | 'model'>
): SttSplitPolicy => {
  const limits = getSttLimits(target.service, target.model)

  return {
    ...(limits.effectiveBytes !== undefined
      ? { attachmentCapBytes: limits.effectiveBytes }
      : {}),
    ...(limits.durationSeconds !== undefined
      ? { maxDurationSeconds: limits.durationSeconds }
      : {})
  }
}

export const resolveEffectiveSplitSegmentDurationMinutes = (
  policy: SttSplitPolicy,
  defaultSegmentDurationMinutes: number = DEFAULT_SPLIT_SEGMENT_DURATION_MINUTES,
  options: {
    audioFileSizeBytes?: number | undefined
    audioDurationSeconds?: number | undefined
  } = {}
): number => {
  const preferredSegmentDurationMinutes = policy.preferredSegmentDurationMinutes ?? defaultSegmentDurationMinutes
  const audioFileSizeBytes = typeof options.audioFileSizeBytes === 'number' && Number.isFinite(options.audioFileSizeBytes) && options.audioFileSizeBytes > 0
    ? options.audioFileSizeBytes
    : undefined
  const audioDurationSeconds = typeof options.audioDurationSeconds === 'number' && Number.isFinite(options.audioDurationSeconds) && options.audioDurationSeconds > 0
    ? options.audioDurationSeconds
    : undefined

  let effectiveSegmentMinutes = preferredSegmentDurationMinutes

  if (policy.maxDurationSeconds !== undefined) {
    const safeMaxDurationSeconds = Math.max(1, policy.maxDurationSeconds - SPLIT_DURATION_SAFETY_SECONDS)
    const durationLimitedSegmentMinutes = safeMaxDurationSeconds / 60
    effectiveSegmentMinutes = Math.min(effectiveSegmentMinutes, durationLimitedSegmentMinutes)
  }

  if (policy.attachmentCapBytes !== undefined && audioFileSizeBytes !== undefined && audioDurationSeconds !== undefined) {
    const bytesPerSecond = audioFileSizeBytes / audioDurationSeconds
    if (Number.isFinite(bytesPerSecond) && bytesPerSecond > 0) {
      const safeAttachmentCapBytes = Math.max(1, Math.floor(policy.attachmentCapBytes * SPLIT_ATTACHMENT_CAP_SAFETY_RATIO))
      const byteLimitedSegmentSeconds = Math.max(1, Math.floor(safeAttachmentCapBytes / bytesPerSecond) - SPLIT_DURATION_SAFETY_SECONDS)
      effectiveSegmentMinutes = Math.min(effectiveSegmentMinutes, byteLimitedSegmentSeconds / 60)
    }
  }

  return Number(effectiveSegmentMinutes.toFixed(3))
}

export const resolveTranscriptionSplitDecision = (
  target: Pick<SttTarget, 'service' | 'model'>,
  options: {
    audioFileSizeBytes: number
    audioDurationSeconds?: number | undefined
    splitRequested: boolean
  }
): SttSplitDecision => {
  const policy = resolveSttSplitPolicy(target)
  const reasons: SttSplitDecisionReason[] = []

  if (options.splitRequested) {
    reasons.push({ kind: 'explicit' })
  }

  if (policy.attachmentCapBytes !== undefined && options.audioFileSizeBytes > policy.attachmentCapBytes) {
    reasons.push({
      kind: 'attachment_cap',
      attachmentCapBytes: policy.attachmentCapBytes,
      audioFileSizeBytes: options.audioFileSizeBytes
    })
  }

  if (
    policy.maxDurationSeconds !== undefined
    && typeof options.audioDurationSeconds === 'number'
    && Number.isFinite(options.audioDurationSeconds)
    && options.audioDurationSeconds > policy.maxDurationSeconds
  ) {
    reasons.push({
      kind: 'duration_cap',
      maxDurationSeconds: policy.maxDurationSeconds,
      audioDurationSeconds: options.audioDurationSeconds
    })
  }

  return {
    shouldSplit: reasons.length > 0,
    policy,
    reasons,
    segmentDurationMinutes: resolveEffectiveSplitSegmentDurationMinutes(policy, DEFAULT_SPLIT_SEGMENT_DURATION_MINUTES, {
      audioFileSizeBytes: options.audioFileSizeBytes,
      audioDurationSeconds: options.audioDurationSeconds
    })
  }
}
