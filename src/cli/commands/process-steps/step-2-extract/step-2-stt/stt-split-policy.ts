import { getSttLimits } from '~/cli/commands/setup-and-utilities/models/model-loader'
import type { SttTarget } from '~/types'
import type { SttSplitDecision, SttSplitDecisionReason, SttSplitPolicy } from '~/types'

export const DEFAULT_SPLIT_SEGMENT_DURATION_MINUTES = 30
export const SPLIT_DURATION_SAFETY_SECONDS = 1
const SPLIT_ATTACHMENT_CAP_SAFETY_RATIO = 0.95

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
      : {}),
    ...(limits.requestBudgetSeconds !== undefined
      ? { requestBudgetSeconds: limits.requestBudgetSeconds }
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

  if (policy.requestBudgetSeconds !== undefined) {
    effectiveSegmentMinutes = Math.min(effectiveSegmentMinutes, policy.requestBudgetSeconds / 60)
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

  if (
    policy.requestBudgetSeconds !== undefined
    && typeof options.audioDurationSeconds === 'number'
    && Number.isFinite(options.audioDurationSeconds)
    && options.audioDurationSeconds > policy.requestBudgetSeconds
  ) {
    reasons.push({
      kind: 'request_budget',
      requestBudgetSeconds: policy.requestBudgetSeconds,
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
