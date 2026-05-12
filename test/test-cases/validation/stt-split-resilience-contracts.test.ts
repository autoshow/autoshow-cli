import { describe, expect, test } from 'bun:test'
import {
  classifySttSplitLimitError,
  extractSttSplitDurationCapSecondsFromError,
  resolveAdaptiveSplitSegmentDurationMinutes,
  resolveSttSplitPolicy,
  resolveTranscriptionSplitDecision,
  shouldRetrySplitTranscriptionAfterError
} from '~/cli/commands/process-steps/step-2-extract/step-2-stt/orchestrator'
import type { SplitPolicyTarget } from '~/types'

const OPENAI_MINI = {
  service: 'openai-stt',
  model: 'gpt-4o-mini-transcribe'
} satisfies SplitPolicyTarget

const OPENAI_FULL = {
  service: 'openai-stt',
  model: 'gpt-4o-transcribe'
} satisfies SplitPolicyTarget

describe('STT split resilience contracts', () => {
  test('OpenAI STT uses request budget when upload size would otherwise allow long segments', () => {
    const decision = resolveTranscriptionSplitDecision(OPENAI_MINI, {
      audioFileSizeBytes: Math.round(27.7 * 1024 * 1024),
      audioDurationSeconds: 2423,
      splitRequested: false
    })

    expect(decision.shouldSplit).toBe(true)
    expect(decision.segmentDurationMinutes).toBe(10)
    expect(decision.reasons.map((reason) => reason.kind)).toEqual(['attachment_cap', 'request_budget'])
    expect(decision.reasons.find((reason) => reason.kind === 'request_budget')).toEqual({
      kind: 'request_budget',
      requestBudgetSeconds: 600,
      audioDurationSeconds: 2423
    })
  })

  test('OpenAI STT splits under 25 MiB inputs that exceed the request budget', () => {
    const decision = resolveTranscriptionSplitDecision(OPENAI_FULL, {
      audioFileSizeBytes: 12 * 1024 * 1024,
      audioDurationSeconds: 601,
      splitRequested: false
    })

    expect(decision.shouldSplit).toBe(true)
    expect(decision.segmentDurationMinutes).toBe(10)
    expect(decision.reasons).toEqual([{
      kind: 'request_budget',
      requestBudgetSeconds: 600,
      audioDurationSeconds: 601
    }])
  })

  test('byte-cap and hard duration-cap policies stay unchanged for other providers', () => {
    const groqTarget = {
      service: 'groq',
      model: 'whisper-large-v3-turbo'
    } satisfies SplitPolicyTarget
    const glmTarget = {
      service: 'glm-stt',
      model: 'glm-asr-2512'
    } satisfies SplitPolicyTarget

    expect(resolveSttSplitPolicy(groqTarget).requestBudgetSeconds).toBeUndefined()

    const byteDecision = resolveTranscriptionSplitDecision(groqTarget, {
      audioFileSizeBytes: 100 * 1024 * 1024,
      audioDurationSeconds: 1800,
      splitRequested: false
    })
    expect(byteDecision.shouldSplit).toBe(true)
    expect(byteDecision.reasons.map((reason) => reason.kind)).toEqual(['attachment_cap'])
    expect(byteDecision.segmentDurationMinutes).toBeLessThan(10)

    const durationDecision = resolveTranscriptionSplitDecision(glmTarget, {
      audioFileSizeBytes: 1_000_000,
      audioDurationSeconds: 120,
      splitRequested: false
    })
    expect(durationDecision.shouldSplit).toBe(true)
    expect(durationDecision.reasons.map((reason) => reason.kind)).toEqual(['duration_cap'])
    expect(durationDecision.segmentDurationMinutes).toBe(0.483)
  })

  test('OpenAI input_too_large errors are retryable with smaller split segments', () => {
    const error = new Error('OpenAI transcription failed (400): {"error":{"message":"Input is too large for the model.","type":"invalid_request_error","code":"input_too_large"}}')

    expect(classifySttSplitLimitError(OPENAI_MINI, error)).toEqual({ reason: 'request_budget' })
    expect(shouldRetrySplitTranscriptionAfterError(OPENAI_MINI, false, error)).toBe(true)
    expect(shouldRetrySplitTranscriptionAfterError(OPENAI_MINI, true, error)).toBe(true)
    expect(resolveAdaptiveSplitSegmentDurationMinutes(10, error)).toBe(5)
  })

  test('OpenAI duration-limit errors expose the parsed cap for adaptive retries', () => {
    const error = new Error('OpenAI transcription failed (400): audio duration 1500.0 seconds is longer than 1400 seconds which is the maximum for this model')

    expect(extractSttSplitDurationCapSecondsFromError(error)).toBe(1400)
    expect(classifySttSplitLimitError(OPENAI_FULL, error)).toEqual({
      reason: 'duration_cap',
      durationCapSeconds: 1400
    })
    expect(resolveAdaptiveSplitSegmentDurationMinutes(30, error)).toBe(23.317)
  })

  test('auth, quota, and non-limit 400 errors are not split retries', () => {
    const nonLimitErrors = [
      new Error('OpenAI transcription failed (401): Incorrect API key provided.'),
      new Error('OpenAI transcription failed (429): You exceeded your current quota, please check your plan and billing details.'),
      new Error('OpenAI transcription failed (400): {"error":{"message":"Unsupported response_format","type":"invalid_request_error","param":"response_format"}}')
    ]

    for (const error of nonLimitErrors) {
      expect(classifySttSplitLimitError(OPENAI_FULL, error)).toBeUndefined()
      expect(shouldRetrySplitTranscriptionAfterError(OPENAI_FULL, false, error)).toBe(false)
    }
  })
})
