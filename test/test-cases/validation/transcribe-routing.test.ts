import { describe, expect, test } from 'bun:test'
import {
  GROQ_MAX_ATTACHMENT_BYTES,
  OPENAI_MAX_ATTACHMENT_BYTES,
  SPEECHMATICS_MAX_ATTACHMENT_BYTES,
  isPayloadTooLargeTranscriptionError,
  mergeSplitTranscriptionChunks,
  resolveEffectiveSegmentConcurrency,
  resolveDiarizationOptions,
  shouldRetrySplitTranscriptionAfterError,
  shouldSplitTranscriptionInput
} from '~/cli/commands/process-steps/step-2-stt/run-transcribe'

describe('shouldSplitTranscriptionInput', () => {
  test('respects explicit split mode for any engine', () => {
    expect(shouldSplitTranscriptionInput('whisper', 1024, true)).toBe(true)
    expect(shouldSplitTranscriptionInput('groq', 1024, true)).toBe(true)
  })

  test('auto-splits Groq uploads above the attachment cap', () => {
    expect(shouldSplitTranscriptionInput('groq', GROQ_MAX_ATTACHMENT_BYTES + 1, false)).toBe(true)
  })

  test('auto-splits OpenAI uploads above the attachment cap', () => {
    expect(shouldSplitTranscriptionInput('openai', OPENAI_MAX_ATTACHMENT_BYTES + 1, false)).toBe(true)
  })

  test('auto-splits Speechmatics uploads above the attachment cap', () => {
    expect(shouldSplitTranscriptionInput('speechmatics', SPEECHMATICS_MAX_ATTACHMENT_BYTES + 1, false)).toBe(true)
  })

  test('does not auto-split Groq uploads at or below the attachment cap', () => {
    expect(shouldSplitTranscriptionInput('groq', GROQ_MAX_ATTACHMENT_BYTES, false)).toBe(false)
    expect(shouldSplitTranscriptionInput('groq', GROQ_MAX_ATTACHMENT_BYTES - 1, false)).toBe(false)
  })

  test('does not auto-split OpenAI uploads at or below the attachment cap', () => {
    expect(shouldSplitTranscriptionInput('openai', OPENAI_MAX_ATTACHMENT_BYTES, false)).toBe(false)
    expect(shouldSplitTranscriptionInput('openai', OPENAI_MAX_ATTACHMENT_BYTES - 1, false)).toBe(false)
  })

  test('does not auto-split Speechmatics uploads at or below the attachment cap', () => {
    expect(shouldSplitTranscriptionInput('speechmatics', SPEECHMATICS_MAX_ATTACHMENT_BYTES, false)).toBe(false)
    expect(shouldSplitTranscriptionInput('speechmatics', SPEECHMATICS_MAX_ATTACHMENT_BYTES - 1, false)).toBe(false)
  })

  test('does not auto-split engines without a documented upload cap', () => {
    expect(shouldSplitTranscriptionInput('whisper', GROQ_MAX_ATTACHMENT_BYTES * 10, false)).toBe(false)
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
    expect(shouldRetrySplitTranscriptionAfterError('mistral', false, error)).toBe(true)
    expect(shouldRetrySplitTranscriptionAfterError('deepgram', false, error)).toBe(true)
    expect(shouldRetrySplitTranscriptionAfterError('openai', false, error)).toBe(true)
    expect(shouldRetrySplitTranscriptionAfterError('groq', false, error)).toBe(true)
    expect(shouldRetrySplitTranscriptionAfterError('speechmatics', false, error)).toBe(true)
  })

  test('does not retry when split mode was already requested', () => {
    const error = new Error('Mistral transcription failed (413): {"message":"Request size limit exceeded"}')
    expect(shouldRetrySplitTranscriptionAfterError('mistral', true, error)).toBe(false)
  })

  test('does not retry local engines on payload-too-large errors', () => {
    const error = new Error('Payload Too Large')
    expect(shouldRetrySplitTranscriptionAfterError('whisper', false, error)).toBe(false)
    expect(shouldRetrySplitTranscriptionAfterError('reverb', false, error)).toBe(false)
  })
})

describe('resolveDiarizationOptions', () => {
  test('ignores speaker-count for OpenAI and preserves known speaker references', () => {
    expect(resolveDiarizationOptions({
      diarizationSpeakerCount: 2,
      diarizationSpeakerNames: ['Host', 'Guest'],
      diarizationSpeakerReferences: ['clips/host.mp3', 'clips/guest.mp3']
    }, 'openai')).toEqual({
      enabled: true,
      knownSpeakerNames: ['Host', 'Guest'],
      knownSpeakerReferencePaths: ['clips/host.mp3', 'clips/guest.mp3']
    })
  })

  test('preserves speaker-count for providers that support it', () => {
    expect(resolveDiarizationOptions({
      diarizationSpeakerCount: 3,
      diarizationSpeakerNames: undefined,
      diarizationSpeakerReferences: undefined
    }, 'assemblyai')).toEqual({ enabled: true, speakerCount: 3 })
  })

  test('ignores speaker-count for Deepgram while keeping diarization enabled', () => {
    expect(resolveDiarizationOptions({
      diarizationSpeakerCount: 2,
      diarizationSpeakerNames: undefined,
      diarizationSpeakerReferences: undefined
    }, 'deepgram')).toEqual({ enabled: true })
  })

  test('ignores speaker-count for Soniox while keeping diarization enabled', () => {
    expect(resolveDiarizationOptions({
      diarizationSpeakerCount: 2,
      diarizationSpeakerNames: undefined,
      diarizationSpeakerReferences: undefined
    }, 'soniox')).toEqual({ enabled: true })
  })

  test('ignores speaker-count for Speechmatics while keeping diarization enabled', () => {
    expect(resolveDiarizationOptions({
      diarizationSpeakerCount: 2,
      diarizationSpeakerNames: undefined,
      diarizationSpeakerReferences: undefined
    }, 'speechmatics')).toEqual({ enabled: true })
  })

  test('ignores speaker-count for Rev while keeping diarization enabled', () => {
    expect(resolveDiarizationOptions({
      diarizationSpeakerCount: 2,
      diarizationSpeakerNames: undefined,
      diarizationSpeakerReferences: undefined
    }, 'rev')).toEqual({ enabled: true })
  })

  test('enables diarization by default for diarized ElevenLabs models', () => {
    expect(resolveDiarizationOptions({
      diarizationSpeakerCount: undefined,
      diarizationSpeakerNames: undefined,
      diarizationSpeakerReferences: undefined
    }, 'elevenlabs')).toEqual({ enabled: true })
  })

  test('rejects OpenAI speaker names without matching references', () => {
    expect(() => resolveDiarizationOptions({
      diarizationSpeakerCount: undefined,
      diarizationSpeakerNames: ['Host'],
      diarizationSpeakerReferences: undefined
    }, 'openai')).toThrow('OpenAI diarization requires matching --speaker-name and --speaker-reference values.')
  })

  test('rejects known speaker references for non-OpenAI engines', () => {
    expect(() => resolveDiarizationOptions({
      diarizationSpeakerCount: undefined,
      diarizationSpeakerNames: ['Host'],
      diarizationSpeakerReferences: ['clips/host.mp3']
    }, 'elevenlabs')).toThrow('only supported with OpenAI diarization')
  })
})

describe('resolveEffectiveSegmentConcurrency', () => {
  test('clamps local providers to 1 even when a higher value is requested', () => {
    expect(resolveEffectiveSegmentConcurrency({ local: true }, 4)).toBe(1)
  })

  test('preserves requested concurrency for cloud providers', () => {
    expect(resolveEffectiveSegmentConcurrency({ local: false }, 4)).toBe(4)
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
            transcriptionModelName: 'whisper-large-v3-turbo',
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
            transcriptionModelName: 'whisper-large-v3-turbo',
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
            transcriptionModelName: 'whisper-large-v3-turbo',
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
