import { describe, expect, test } from 'bun:test'
import {
  GROQ_MAX_ATTACHMENT_BYTES,
  isPayloadTooLargeTranscriptionError,
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

  test('does not auto-split Groq uploads at or below the attachment cap', () => {
    expect(shouldSplitTranscriptionInput('groq', GROQ_MAX_ATTACHMENT_BYTES, false)).toBe(false)
    expect(shouldSplitTranscriptionInput('groq', GROQ_MAX_ATTACHMENT_BYTES - 1, false)).toBe(false)
  })

  test('does not auto-split other engines based on Groq limits', () => {
    expect(shouldSplitTranscriptionInput('openai', GROQ_MAX_ATTACHMENT_BYTES * 10, false)).toBe(false)
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

  test('ignores unrelated errors', () => {
    expect(isPayloadTooLargeTranscriptionError(new Error('Groq transcription failed (401): unauthorized'))).toBe(false)
    expect(isPayloadTooLargeTranscriptionError({ status: 413 })).toBe(false)
  })
})
