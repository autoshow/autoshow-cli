import { describe, expect, test } from 'bun:test'
import {
  derivePersistedTranscriptionEvidenceFromProviderResult,
  parseStoredTranscriptionResult
} from '~/cli/commands/process-steps/step-2-stt/stt-utils/stt-result-artifacts'
import { sttProviderResultFixture } from './fixtures/stt-provider-result.fixture'

describe('stt result artifacts', () => {
  test('derives normalized evidence from provider result fixtures', () => {
    const evidence = derivePersistedTranscriptionEvidenceFromProviderResult(sttProviderResultFixture)
    const transcription = parseStoredTranscriptionResult(sttProviderResultFixture.result)

    expect(evidence).toBeDefined()
    expect(evidence?.timingQuality).toBe('native_word')
    expect(evidence?.speakerInventory).toEqual(['speaker-0', 'speaker-1'])
    expect(evidence?.capabilities).toEqual({
      hasNativeWordTiming: true,
      hasConfidence: true,
      hasSpeakerLabels: true
    })
    expect(evidence?.segments).toHaveLength(3)
    expect(evidence?.words[0]?.normalized).toBe('hello')
    expect(evidence?.words.at(-1)?.normalized).toBe('power')

    expect(transcription?.evidence?.rawResponse).toEqual({
      id: 'tx-123',
      status: 'completed',
      utterances: [
        { speaker: 'speaker-0', text: 'Hello there General Kenobi' },
        { speaker: 'speaker-1', text: 'I have the high ground you underestimate my power' }
      ]
    })
  })
})
