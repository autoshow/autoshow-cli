import type { ProviderResult } from '~/types'

export const sttProviderResultFixture: ProviderResult = {
  schemaVersion: 2,
  kind: 'provider-result',
  provider: 'assemblyai',
  model: 'universal-3-pro',
  metadata: {
    transcriptionService: 'assemblyai',
    transcriptionModel: 'universal-3-pro',
    processingTime: 1234,
    tokenCount: 17
  },
  result: {
    text: 'Hello there General Kenobi I have the high ground you underestimate my power',
    segments: [
      {
        start: '00:00:00',
        end: '00:00:03',
        text: 'Hello there General Kenobi',
        speaker: 'speaker-0'
      },
      {
        start: '00:00:03',
        end: '00:00:05',
        text: 'I have the high ground',
        speaker: 'speaker-1'
      },
      {
        start: '00:00:05',
        end: '00:00:07',
        text: 'you underestimate my power',
        speaker: 'speaker-1'
      }
    ],
    evidence: {
      segments: [
        {
          startSeconds: 0,
          endSeconds: 3,
          text: 'Hello there General Kenobi',
          speaker: 'speaker-0',
          confidence: 0.98
        },
        {
          startSeconds: 3,
          endSeconds: 5,
          text: 'I have the high ground',
          speaker: 'speaker-1',
          confidence: 0.94
        },
        {
          startSeconds: 5,
          endSeconds: 7,
          text: 'you underestimate my power',
          speaker: 'speaker-1',
          confidence: 0.91
        }
      ],
      words: [
        { startSeconds: 0, endSeconds: 0.5, text: 'Hello', normalized: 'hello', speaker: 'speaker-0', confidence: 0.99, timingSource: 'native' },
        { startSeconds: 0.5, endSeconds: 1, text: 'there', normalized: 'there', speaker: 'speaker-0', confidence: 0.98, timingSource: 'native' },
        { startSeconds: 1, endSeconds: 1.6, text: 'General', normalized: 'general', speaker: 'speaker-0', confidence: 0.97, timingSource: 'native' },
        { startSeconds: 1.6, endSeconds: 3, text: 'Kenobi', normalized: 'kenobi', speaker: 'speaker-0', confidence: 0.96, timingSource: 'native' },
        { startSeconds: 3, endSeconds: 3.2, text: 'I', normalized: 'i', speaker: 'speaker-1', confidence: 0.95, timingSource: 'native' },
        { startSeconds: 3.2, endSeconds: 3.7, text: 'have', normalized: 'have', speaker: 'speaker-1', confidence: 0.95, timingSource: 'native' },
        { startSeconds: 3.7, endSeconds: 4, text: 'the', normalized: 'the', speaker: 'speaker-1', confidence: 0.93, timingSource: 'native' },
        { startSeconds: 4, endSeconds: 5, text: 'high', normalized: 'high', speaker: 'speaker-1', confidence: 0.93, timingSource: 'native' },
        { startSeconds: 5, endSeconds: 5.6, text: 'you', normalized: 'you', speaker: 'speaker-1', confidence: 0.92, timingSource: 'native' },
        { startSeconds: 5.6, endSeconds: 6.2, text: 'underestimate', normalized: 'underestimate', speaker: 'speaker-1', confidence: 0.9, timingSource: 'native' },
        { startSeconds: 6.2, endSeconds: 6.6, text: 'my', normalized: 'my', speaker: 'speaker-1', confidence: 0.9, timingSource: 'native' },
        { startSeconds: 6.6, endSeconds: 7, text: 'power', normalized: 'power', speaker: 'speaker-1', confidence: 0.89, timingSource: 'native' }
      ],
      capabilities: {
        hasNativeWordTiming: true,
        hasConfidence: true,
        hasSpeakerLabels: true
      },
      timingQuality: 'native_word',
      rawResponse: {
        id: 'tx-123',
        status: 'completed',
        utterances: [
          { speaker: 'speaker-0', text: 'Hello there General Kenobi' },
          { speaker: 'speaker-1', text: 'I have the high ground you underestimate my power' }
        ]
      }
    }
  }
}
