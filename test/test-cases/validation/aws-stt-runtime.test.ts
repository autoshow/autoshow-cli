import { describe, expect, test } from 'bun:test'
import { parseAwsTranscribeOutput } from '~/cli/commands/process-steps/step-2-stt/stt-services/aws/parse-aws-transcribe-output'
import {
  AWS_STT_DEFAULT_MAX_SPEAKERS,
  resolveAwsMaxSpeakerLabels
} from '~/cli/commands/process-steps/step-2-stt/stt-services/aws/aws'

describe('resolveAwsMaxSpeakerLabels', () => {
  test('defaults to the AWS max-speaker fallback when speaker count is omitted', () => {
    expect(resolveAwsMaxSpeakerLabels()).toBe(AWS_STT_DEFAULT_MAX_SPEAKERS)
  })

  test('floors valid speaker counts to whole numbers', () => {
    expect(resolveAwsMaxSpeakerLabels(2.9)).toBe(2)
  })
})

describe('parseAwsTranscribeOutput', () => {
  test('preserves speaker labels, punctuation, and timing offsets', () => {
    const result = parseAwsTranscribeOutput({
      results: {
        transcripts: [
          { transcript: 'Hello, world!' }
        ],
        items: [
          {
            start_time: '0.00',
            end_time: '0.50',
            alternatives: [{ content: 'Hello', confidence: '0.99' }],
            type: 'pronunciation'
          },
          {
            alternatives: [{ content: ',' }],
            type: 'punctuation'
          },
          {
            start_time: '0.60',
            end_time: '1.00',
            alternatives: [{ content: 'world', confidence: '0.95' }],
            type: 'pronunciation'
          },
          {
            alternatives: [{ content: '!' }],
            type: 'punctuation'
          }
        ],
        speaker_labels: {
          speakers: 1,
          segments: [
            {
              start_time: '0.00',
              end_time: '1.00',
              speaker_label: 'spk_0',
              items: [
                { start_time: '0.00', speaker_label: 'spk_0' },
                { start_time: '0.60', speaker_label: 'spk_0' }
              ]
            }
          ]
        }
      }
    }, { offsetSeconds: 60 })

    expect(result.text).toBe('Hello, world!')
    expect(result.segments).toEqual([
      {
        start: '00:01:00',
        end: '00:01:01',
        text: 'Hello, world!',
        speaker: 'spk_0'
      }
    ])
    expect(result.evidence?.words).toEqual([
      {
        startSeconds: 60,
        endSeconds: 60.5,
        text: 'Hello,',
        normalized: 'hello,',
        speaker: 'spk_0',
        confidence: 0.99,
        timingSource: 'native'
      },
      {
        startSeconds: 60.6,
        endSeconds: 61,
        text: 'world!',
        normalized: 'world!',
        speaker: 'spk_0',
        confidence: 0.95,
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
})
