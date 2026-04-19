import { describe, expect, test } from 'bun:test'
import { GCLOUD_STT_DEFAULT_LOCATION } from '~/cli/commands/process-steps/step-2-stt/stt-services/gcloud/gcloud'
import { parseGcloudSttResponse } from '~/cli/commands/process-steps/step-2-stt/stt-services/gcloud/parse-gcloud-stt-response'
import {
  buildGcloudRecognizeRequest,
  buildGcloudRecognizeUrl,
  buildGcloudSpeechEndpoint
} from '~/cli/commands/process-steps/step-2-stt/stt-services/gcloud/run-gcloud-stt'

describe('buildGcloudRecognizeRequest', () => {
  test('enables diarization by default with Google-specific sync settings', () => {
    expect(buildGcloudRecognizeRequest('Zm9v', {
      model: 'chirp_3'
    })).toEqual({
      config: {
        autoDecodingConfig: {},
        languageCodes: ['auto'],
        model: 'chirp_3',
        features: {
          enableAutomaticPunctuation: true,
          enableWordTimeOffsets: true,
          diarizationConfig: {}
        }
      },
      content: 'Zm9v'
    })
  })

  test('maps speaker-count hints to exact diarization bounds', () => {
    expect(buildGcloudRecognizeRequest('YmFy', {
      model: 'chirp_3',
      diarizationOptions: { enabled: true, speakerCount: 2 }
    })).toEqual({
      config: {
        autoDecodingConfig: {},
        languageCodes: ['auto'],
        model: 'chirp_3',
        features: {
          enableAutomaticPunctuation: true,
          enableWordTimeOffsets: true,
          diarizationConfig: {
            minSpeakerCount: 2,
            maxSpeakerCount: 2
          }
        }
      },
      content: 'YmFy'
    })
  })
})

describe('buildGcloudRecognizeUrl', () => {
  test('keeps the Google STT default location aligned with the Chirp 3 us multi-region', () => {
    expect(GCLOUD_STT_DEFAULT_LOCATION).toBe('us')
  })

  test('uses the matching regional speech endpoint for regional recognizer locations', () => {
    expect(buildGcloudSpeechEndpoint('us')).toBe('https://us-speech.googleapis.com')
    expect(buildGcloudRecognizeUrl('demo-project', 'us')).toBe(
      'https://us-speech.googleapis.com/v2/projects/demo-project/locations/us/recognizers/_:recognize'
    )
  })

  test('uses the default speech endpoint only for the global recognizer location', () => {
    expect(buildGcloudSpeechEndpoint('global')).toBe('https://speech.googleapis.com')
    expect(buildGcloudRecognizeUrl('demo-project', 'global')).toBe(
      'https://speech.googleapis.com/v2/projects/demo-project/locations/global/recognizers/_:recognize'
    )
  })
})

describe('parseGcloudSttResponse', () => {
  test('parses final diarized words into stable speakers, timings, and segments', () => {
    const result = parseGcloudSttResponse({
      results: [
        {
          alternatives: [
            {
              transcript: 'hello world. hi there.',
              words: [
                { startOffset: '0s', endOffset: '0.5s', word: 'hello', confidence: 0.91, speakerLabel: '2' },
                { startOffset: '0.5s', endOffset: '1.2s', word: 'world.', confidence: 0.88, speakerLabel: '2' },
                { startOffset: '1.3s', endOffset: '1.6s', word: 'hi', confidence: 0.82, speakerLabel: '1' },
                { startOffset: '1.6s', endOffset: '2.1s', word: 'there.', confidence: 0.8, speakerLabel: '1' }
              ]
            }
          ]
        }
      ]
    }, { offsetSeconds: 60 })

    expect(result.text).toBe('hello world. hi there.')
    expect(result.segments).toEqual([
      {
        start: '00:01:00',
        end: '00:01:01',
        text: 'hello world.',
        speaker: 'spk_1'
      },
      {
        start: '00:01:01',
        end: '00:01:02',
        text: 'hi there.',
        speaker: 'spk_2'
      }
    ])
    expect(result.evidence?.words).toEqual([
      {
        startSeconds: 60,
        endSeconds: 60.5,
        text: 'hello',
        normalized: 'hello',
        speaker: 'spk_1',
        confidence: 0.91,
        timingSource: 'native'
      },
      {
        startSeconds: 60.5,
        endSeconds: 61.2,
        text: 'world.',
        normalized: 'world.',
        speaker: 'spk_1',
        confidence: 0.88,
        timingSource: 'native'
      },
      {
        startSeconds: 61.3,
        endSeconds: 61.6,
        text: 'hi',
        normalized: 'hi',
        speaker: 'spk_2',
        confidence: 0.82,
        timingSource: 'native'
      },
      {
        startSeconds: 61.6,
        endSeconds: 62.1,
        text: 'there.',
        normalized: 'there.',
        speaker: 'spk_2',
        confidence: 0.8,
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
