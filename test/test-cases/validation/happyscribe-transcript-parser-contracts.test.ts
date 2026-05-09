import { describe, expect, test } from 'bun:test'
import { parseHappyScribeTranscriptPayload } from '~/cli/commands/process-steps/step-2-extract/step-2-stt/stt-services/happyscribe/parse-happyscribe-transcript'

describe('Happy Scribe transcript parser contracts', () => {
  test('normalizes word-level payloads with offsets, speakers, and confidence', () => {
    const result = parseHappyScribeTranscriptPayload({
      transcript: 'Hello world.',
      segments: [
        {
          text: 'Hello world.',
          start_seconds: 1,
          end_seconds: 2,
          speaker: 1,
          confidence: 0.91
        }
      ],
      words: [
        {
          text: 'Hello',
          start_seconds: 1,
          end_seconds: 1.5,
          speaker: 1,
          confidence: '0.97'
        },
        {
          text: 'world.',
          start_seconds: 1.5,
          end_seconds: 2,
          speaker: 1
        }
      ]
    }, { offsetSeconds: 60 })

    expect(result.text).toBe('Hello world.')
    expect(result.segments).toEqual([
      {
        start: '00:01:01',
        end: '00:01:02',
        text: 'Hello world.',
        speaker: 'speaker-1'
      }
    ])
    expect(result.evidence?.words).toEqual([
      {
        startSeconds: 61,
        endSeconds: 61.5,
        text: 'Hello',
        normalized: 'hello',
        speaker: 'speaker-1',
        confidence: 0.97,
        timingSource: 'native'
      },
      {
        startSeconds: 61.5,
        endSeconds: 62,
        text: 'world.',
        normalized: 'world.',
        speaker: 'speaker-1',
        timingSource: 'native'
      }
    ])
    expect(result.evidence?.capabilities).toEqual({
      hasNativeWordTiming: true,
      hasConfidence: true,
      hasSpeakerLabels: true
    })
    expect(result.evidence?.timingQuality).toBe('native_word')
  })

  test('normalizes segment-level payloads when native word timing is absent', () => {
    const result = parseHappyScribeTranscriptPayload({
      full_text: 'First segment Second segment',
      paragraphs: [
        {
          sentence: 'First segment',
          start_time: '00:00:01',
          end_time: '00:00:03',
          speakerName: 'Host'
        },
        {
          sentence: 'Second segment',
          start_time: '00:00:03',
          end_time: '00:00:05',
          speakerName: 'Guest'
        }
      ]
    }, { offsetSeconds: 5 })

    expect(result.text).toBe('First segment Second segment')
    expect(result.segments).toEqual([
      {
        start: '00:00:06',
        end: '00:00:08',
        text: 'First segment',
        speaker: 'Host'
      },
      {
        start: '00:00:08',
        end: '00:00:10',
        text: 'Second segment',
        speaker: 'Guest'
      }
    ])
    expect(result.evidence?.words).toBeUndefined()
    expect(result.evidence?.capabilities).toEqual({
      hasNativeWordTiming: false,
      hasConfidence: false,
      hasSpeakerLabels: true
    })
    expect(result.evidence?.timingQuality).toBe('segment_interpolated')
  })

  test('rejects payloads without recognizable transcript content', () => {
    expect(() => parseHappyScribeTranscriptPayload({
      metadata: {
        id: 'transcription-1'
      }
    })).toThrow('Happy Scribe transcript payload did not include recognizable structured transcript content')
  })
})
