import { describe, expect, test } from 'bun:test'
import {
  DEFAULT_SPLIT_SEGMENT_DURATION_MINUTES,
  GROQ_MAX_ATTACHMENT_BYTES,
  GLADIA_MAX_ATTACHMENT_BYTES,
  REV_MAX_ATTACHMENT_BYTES,
  SPEECHMATICS_MAX_ATTACHMENT_BYTES,
  isPayloadTooLargeTranscriptionError,
  mergeSplitTranscriptionChunks,
  resolveEffectiveSegmentConcurrency,
  resolveEffectiveSplitSegmentDurationMinutes,
  resolveDiarizationOptions,
  resolveSttSplitPolicy,
  resolveTranscriptionSplitDecision,
  shouldRetrySplitTranscriptionAfterError,
  shouldSplitTranscriptionInput
} from '~/cli/commands/process-steps/step-2-stt/orchestrator'
import { getSttLimits } from '~/cli/commands/setup-and-utilities/models/model-loader'

const TARGET_MODELS = {
  whisper: 'large-v3-turbo',
  gcloud: 'chirp_3',
  deepgram: 'nova-3',
  groq: 'whisper-large-v3-turbo',
  soniox: 'stt-async-v4',
  speechmatics: 'standard',
  rev: 'low_cost',
  elevenlabs: 'scribe_v2',
  mistral: 'voxtral-mini-2602',
  assemblyai: 'universal-3-pro',
  gladia: 'default',
  reverb: 'test-model'
} as const

type TestTargetService = keyof typeof TARGET_MODELS

const createTarget = (service: TestTargetService) => ({
  service,
  model: TARGET_MODELS[service]
})

const requireSttLimit = (
  service: Exclude<TestTargetService, 'whisper' | 'reverb'>,
  field: 'effectiveBytes' | 'durationSeconds'
): number => {
  const value = getSttLimits(service, TARGET_MODELS[service])[field]
  if (typeof value !== 'number') {
    throw new Error(`Missing ${field} for ${service}/${TARGET_MODELS[service]}`)
  }

  return value
}

describe('getSttLimits', () => {
  test('returns transport-aware AssemblyAI limits', () => {
    expect(getSttLimits('assemblyai', TARGET_MODELS.assemblyai)).toEqual(expect.objectContaining({
      effectiveBytes: 2362232013,
      directUploadBytes: 2362232013,
      remoteUrlBytes: 5368709120,
      durationSeconds: 36000
    }))
  })

  test('returns no numeric limits for uncapped local Whisper models', () => {
    const limits = getSttLimits('whisper', TARGET_MODELS.whisper)
    expect(limits.effectiveBytes).toBeUndefined()
    expect(limits.directUploadBytes).toBeUndefined()
    expect(limits.remoteUrlBytes).toBeUndefined()
    expect(limits.durationSeconds).toBeUndefined()
    expect(limits.notes).toContain('provider-side upload and duration caps do not apply')
  })

  test('returns transport-specific Groq and Gladia remote URL limits', () => {
    expect(getSttLimits('groq', TARGET_MODELS.groq)).toEqual(expect.objectContaining({
      effectiveBytes: 26214400,
      directUploadBytes: 26214400,
      remoteUrlBytes: 104857600
    }))
    expect(getSttLimits('gladia', TARGET_MODELS.gladia)).toEqual(expect.objectContaining({
      effectiveBytes: 1048576000,
      directUploadBytes: 1048576000,
      remoteUrlBytes: 1048576000
    }))
  })

  test('returns documented Mistral upload and duration limits', () => {
    expect(getSttLimits('mistral', TARGET_MODELS.mistral)).toEqual(expect.objectContaining({
      effectiveBytes: 524288000,
      directUploadBytes: 524288000,
      durationSeconds: 10800
    }))
  })
})

describe('shouldSplitTranscriptionInput', () => {
  test('respects explicit split mode for any engine', () => {
    expect(shouldSplitTranscriptionInput(createTarget('whisper'), 1024, undefined, true)).toBe(true)
    expect(shouldSplitTranscriptionInput(createTarget('groq'), 1024, undefined, true)).toBe(true)
  })

  test('auto-splits Deepgram uploads above the attachment cap', () => {
    expect(shouldSplitTranscriptionInput(createTarget('deepgram'), requireSttLimit('deepgram', 'effectiveBytes') + 1, undefined, false)).toBe(true)
  })

  test('auto-splits Google Cloud uploads above the attachment cap', () => {
    expect(shouldSplitTranscriptionInput(createTarget('gcloud'), requireSttLimit('gcloud', 'effectiveBytes') + 1, undefined, false)).toBe(true)
  })

  test('auto-splits Groq uploads above the attachment cap', () => {
    expect(shouldSplitTranscriptionInput(createTarget('groq'), GROQ_MAX_ATTACHMENT_BYTES + 1, undefined, false)).toBe(true)
  })

  test('auto-splits ElevenLabs uploads above the attachment cap', () => {
    expect(shouldSplitTranscriptionInput(createTarget('elevenlabs'), requireSttLimit('elevenlabs', 'effectiveBytes') + 1, undefined, false)).toBe(true)
  })

  test('auto-splits Speechmatics uploads above the attachment cap', () => {
    expect(shouldSplitTranscriptionInput(createTarget('speechmatics'), SPEECHMATICS_MAX_ATTACHMENT_BYTES + 1, undefined, false)).toBe(true)
  })

  test('auto-splits Rev uploads above the attachment cap', () => {
    expect(shouldSplitTranscriptionInput(createTarget('rev'), REV_MAX_ATTACHMENT_BYTES + 1, undefined, false)).toBe(true)
  })

  test('auto-splits AssemblyAI uploads above the effective upload cap', () => {
    expect(shouldSplitTranscriptionInput(createTarget('assemblyai'), requireSttLimit('assemblyai', 'effectiveBytes') + 1, undefined, false)).toBe(true)
  })

  test('auto-splits Gladia uploads above the attachment cap', () => {
    expect(shouldSplitTranscriptionInput(createTarget('gladia'), GLADIA_MAX_ATTACHMENT_BYTES + 1, undefined, false)).toBe(true)
  })

  test('auto-splits Mistral uploads above the documented attachment cap', () => {
    expect(shouldSplitTranscriptionInput(createTarget('mistral'), requireSttLimit('mistral', 'effectiveBytes') + 1, undefined, false)).toBe(true)
  })

  test('auto-splits duration-limited ElevenLabs inputs above the model cap', () => {
    expect(shouldSplitTranscriptionInput(createTarget('elevenlabs'), 1024, requireSttLimit('elevenlabs', 'durationSeconds') + 1, false)).toBe(true)
  })

  test('auto-splits duration-limited Soniox inputs above the model cap', () => {
    expect(shouldSplitTranscriptionInput(createTarget('soniox'), 1024, requireSttLimit('soniox', 'durationSeconds') + 1, false)).toBe(true)
  })

  test('auto-splits duration-limited Google Cloud inputs above the model cap', () => {
    expect(shouldSplitTranscriptionInput(createTarget('gcloud'), 1024, requireSttLimit('gcloud', 'durationSeconds') + 1, false)).toBe(true)
  })

  test('auto-splits duration-limited Mistral inputs above the model cap', () => {
    expect(shouldSplitTranscriptionInput(createTarget('mistral'), 1024, requireSttLimit('mistral', 'durationSeconds') + 1, false)).toBe(true)
  })

  test('auto-splits duration-limited AssemblyAI inputs above the model cap', () => {
    expect(shouldSplitTranscriptionInput(createTarget('assemblyai'), 1024, requireSttLimit('assemblyai', 'durationSeconds') + 1, false)).toBe(true)
  })

  test('auto-splits duration-limited Gladia inputs above the model cap', () => {
    expect(shouldSplitTranscriptionInput(createTarget('gladia'), 1024, requireSttLimit('gladia', 'durationSeconds') + 1, false)).toBe(true)
  })

  test('auto-splits duration-limited Rev inputs above the model cap', () => {
    expect(shouldSplitTranscriptionInput(createTarget('rev'), 1024, requireSttLimit('rev', 'durationSeconds') + 1, false)).toBe(true)
  })

  test('does not auto-split Groq uploads at or below the attachment cap', () => {
    expect(shouldSplitTranscriptionInput(createTarget('groq'), GROQ_MAX_ATTACHMENT_BYTES, undefined, false)).toBe(false)
    expect(shouldSplitTranscriptionInput(createTarget('groq'), GROQ_MAX_ATTACHMENT_BYTES - 1, undefined, false)).toBe(false)
  })

  test('does not auto-split Speechmatics uploads at or below the attachment cap', () => {
    expect(shouldSplitTranscriptionInput(createTarget('speechmatics'), SPEECHMATICS_MAX_ATTACHMENT_BYTES, undefined, false)).toBe(false)
    expect(shouldSplitTranscriptionInput(createTarget('speechmatics'), SPEECHMATICS_MAX_ATTACHMENT_BYTES - 1, undefined, false)).toBe(false)
  })

  test('does not auto-split Gladia uploads at or below the attachment cap', () => {
    expect(shouldSplitTranscriptionInput(createTarget('gladia'), GLADIA_MAX_ATTACHMENT_BYTES, undefined, false)).toBe(false)
    expect(shouldSplitTranscriptionInput(createTarget('gladia'), GLADIA_MAX_ATTACHMENT_BYTES - 1, undefined, false)).toBe(false)
  })

  test('does not auto-split engines without a documented upload cap', () => {
    expect(shouldSplitTranscriptionInput(createTarget('whisper'), GROQ_MAX_ATTACHMENT_BYTES * 10, undefined, false)).toBe(false)
  })

  test('returns detailed split reasons for size and duration caps', () => {
    const attachmentCapBytes = requireSttLimit('assemblyai', 'effectiveBytes')
    const maxDurationSeconds = requireSttLimit('assemblyai', 'durationSeconds')
    const decision = resolveTranscriptionSplitDecision(createTarget('assemblyai'), {
      audioFileSizeBytes: attachmentCapBytes + 1,
      audioDurationSeconds: maxDurationSeconds + 1,
      splitRequested: false
    })

    expect(decision.shouldSplit).toBe(true)
    expect(decision.reasons).toEqual([
      {
        kind: 'attachment_cap',
        attachmentCapBytes,
        audioFileSizeBytes: attachmentCapBytes + 1
      },
      {
        kind: 'duration_cap',
        maxDurationSeconds,
        audioDurationSeconds: maxDurationSeconds + 1
      }
    ])
  })
})

describe('split policy helpers', () => {
  test('reads AssemblyAI attachment and duration caps from config metadata', () => {
    expect(resolveSttSplitPolicy(createTarget('assemblyai'))).toEqual({
      attachmentCapBytes: requireSttLimit('assemblyai', 'effectiveBytes'),
      maxDurationSeconds: requireSttLimit('assemblyai', 'durationSeconds')
    })
  })

  test('keeps the default split duration when the provider cap is looser than 30 minutes', () => {
    expect(resolveEffectiveSplitSegmentDurationMinutes(resolveSttSplitPolicy(createTarget('assemblyai')))).toBe(DEFAULT_SPLIT_SEGMENT_DURATION_MINUTES)
  })

  test('shortens segment duration when a provider cap is tighter than the default', () => {
    expect(resolveEffectiveSplitSegmentDurationMinutes({ maxDurationSeconds: 300 })).toBeLessThan(DEFAULT_SPLIT_SEGMENT_DURATION_MINUTES)
    expect(resolveEffectiveSplitSegmentDurationMinutes({ maxDurationSeconds: 300 })).toBeLessThan(5)
  })
})

describe('isPayloadTooLargeTranscriptionError', () => {
  test('detects numeric 413 errors', () => {
    expect(isPayloadTooLargeTranscriptionError(new Error('Groq transcription failed (413): too large'))).toBe(true)
  })

  test('detects text payload-too-large errors case-insensitively', () => {
    expect(isPayloadTooLargeTranscriptionError(new Error('Payload Too Large'))).toBe(true)
    expect(isPayloadTooLargeTranscriptionError('payload too large')).toBe(true)
  })

  test('detects request-size-limit errors from providers that include 413 payloads', () => {
    expect(isPayloadTooLargeTranscriptionError(new Error('Mistral transcription failed (413): {"message":"Request size limit exceeded"}'))).toBe(true)
    expect(isPayloadTooLargeTranscriptionError('request size limit exceeded')).toBe(true)
  })

  test('ignores unrelated errors', () => {
    expect(isPayloadTooLargeTranscriptionError(new Error('Groq transcription failed (401): unauthorized'))).toBe(false)
    expect(isPayloadTooLargeTranscriptionError({ status: 413 })).toBe(false)
  })
})

describe('shouldRetrySplitTranscriptionAfterError', () => {
  test('retries hosted upload engines when the provider rejects the payload as too large', () => {
    const error = new Error('Mistral transcription failed (413): {"message":"Request size limit exceeded"}')
    expect(shouldRetrySplitTranscriptionAfterError(createTarget('mistral'), false, error)).toBe(true)
    expect(shouldRetrySplitTranscriptionAfterError(createTarget('deepgram'), false, error)).toBe(true)
    expect(shouldRetrySplitTranscriptionAfterError(createTarget('groq'), false, error)).toBe(true)
    expect(shouldRetrySplitTranscriptionAfterError(createTarget('speechmatics'), false, error)).toBe(true)
  })

  test('retries duration-limited models when the provider rejects audio that exceeds the model cap', () => {
    const maxDurationSeconds = requireSttLimit('assemblyai', 'durationSeconds')
    const error = new Error(`400 audio duration ${maxDurationSeconds + 1} seconds is longer than ${maxDurationSeconds} seconds which is the maximum for this model`)
    expect(shouldRetrySplitTranscriptionAfterError(createTarget('assemblyai'), false, error)).toBe(true)
  })

  test('does not retry when split mode was already requested', () => {
    const error = new Error('Mistral transcription failed (413): {"message":"Request size limit exceeded"}')
    expect(shouldRetrySplitTranscriptionAfterError(createTarget('mistral'), true, error)).toBe(false)
  })

  test('does not retry local engines on payload-too-large errors', () => {
    const error = new Error('Payload Too Large')
    expect(shouldRetrySplitTranscriptionAfterError(createTarget('whisper'), false, error)).toBe(false)
    expect(shouldRetrySplitTranscriptionAfterError(createTarget('reverb'), false, error)).toBe(false)
  })

  test('does not retry duration errors for models without a configured duration cap', () => {
    const error = new Error('400 audio duration 1413.693625 seconds is longer than 1400 seconds which is the maximum for this model')
    expect(shouldRetrySplitTranscriptionAfterError(createTarget('deepgram'), false, error)).toBe(false)
  })
})

describe('resolveDiarizationOptions', () => {
  test('preserves speaker-count for AssemblyAI', () => {
    expect(resolveDiarizationOptions({
      diarizationSpeakerCount: 3,
    }, 'assemblyai')).toEqual({ enabled: true, speakerCount: 3 })
  })

  test('preserves speaker-count for Google Cloud', () => {
    expect(resolveDiarizationOptions({
      diarizationSpeakerCount: 2
    }, 'gcloud')).toEqual({ enabled: true, speakerCount: 2 })
  })

  test('preserves speaker-count for Gladia', () => {
    expect(resolveDiarizationOptions({
      diarizationSpeakerCount: 2
    }, 'gladia')).toEqual({ enabled: true, speakerCount: 2 })
  })

  test('ignores speaker-count for Deepgram while keeping diarization enabled', () => {
    expect(resolveDiarizationOptions({
      diarizationSpeakerCount: 2
    }, 'deepgram')).toEqual({ enabled: true })
  })

  test('ignores speaker-count for Soniox while keeping diarization enabled', () => {
    expect(resolveDiarizationOptions({
      diarizationSpeakerCount: 2
    }, 'soniox')).toEqual({ enabled: true })
  })

  test('ignores speaker-count for Speechmatics while keeping diarization enabled', () => {
    expect(resolveDiarizationOptions({
      diarizationSpeakerCount: 2
    }, 'speechmatics')).toEqual({ enabled: true })
  })

  test('ignores speaker-count for Rev while keeping diarization enabled', () => {
    expect(resolveDiarizationOptions({
      diarizationSpeakerCount: 2
    }, 'rev')).toEqual({ enabled: true })
  })

  test('enables diarization by default for diarized ElevenLabs models', () => {
    expect(resolveDiarizationOptions({}, 'elevenlabs')).toEqual({ enabled: true })
  })
})

describe('resolveEffectiveSegmentConcurrency', () => {
  test('clamps local providers to 1 even when a higher value is requested', () => {
    expect(resolveEffectiveSegmentConcurrency({ local: true, service: 'whisper' }, 4)).toBe(1)
  })

  test('clamps Mistral providers to 1 even when a higher value is requested', () => {
    expect(resolveEffectiveSegmentConcurrency({ local: false, service: 'mistral' }, 4)).toBe(1)
  })

  test('preserves requested concurrency for cloud providers', () => {
    expect(resolveEffectiveSegmentConcurrency({ local: false, service: 'assemblyai' }, 4)).toBe(4)
  })
})

describe('mergeSplitTranscriptionChunks', () => {
  test('merges split results deterministically regardless of completion order', () => {
    const merged = mergeSplitTranscriptionChunks([
      {
        segmentIndex: 2,
        data: {
          result: {
            text: 'third',
            segments: [{ start: '00:00:20', end: '00:00:29', text: 'third' }]
          },
          metadata: {
            transcriptionService: 'groq',
            transcriptionModel: 'whisper-large-v3-turbo',
            processingTime: 300,
            tokenCount: 3
          }
        }
      },
      {
        segmentIndex: 0,
        data: {
          result: {
            text: 'first',
            segments: [{ start: '00:00:00', end: '00:00:09', text: 'first' }]
          },
          metadata: {
            transcriptionService: 'groq',
            transcriptionModel: 'whisper-large-v3-turbo',
            processingTime: 100,
            tokenCount: 1
          }
        }
      },
      {
        segmentIndex: 1,
        data: {
          result: {
            text: 'second',
            segments: [{ start: '00:00:10', end: '00:00:19', text: 'second' }]
          },
          metadata: {
            transcriptionService: 'groq',
            transcriptionModel: 'whisper-large-v3-turbo',
            processingTime: 200,
            tokenCount: 2
          }
        }
      }
    ])

    expect(merged.result.text).toBe('first second third')
    expect(merged.result.segments.map((segment) => segment.text)).toEqual(['first', 'second', 'third'])
    expect(merged.metadata.processingTime).toBe(600)
    expect(merged.metadata.tokenCount).toBe(6)
  })
})
