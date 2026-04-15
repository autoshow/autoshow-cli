import { describe, expect, test } from 'bun:test'
import {
  buildSttBatchFinalSummaryLines,
  formatBatchCompletionSummary,
  formatSttBatchCompletionSummary,
  formatBatchPartialFailureSummary,
  getBatchManifestErrorCount
} from '~/cli/commands/process-steps/step-1-download/targets/target-utils'

describe('batch summary helpers', () => {
  test('counts manifest errors when a batch item completed with partial failures', () => {
    expect(getBatchManifestErrorCount({
      step1: { title: 'example' },
      errors: [{ service: 'elevenlabs', model: 'scribe_v2', message: 'timed out' }]
    })).toBe(1)
  })

  test('treats missing or non-array errors as zero manifest errors', () => {
    expect(getBatchManifestErrorCount(null)).toBe(0)
    expect(getBatchManifestErrorCount({ errors: 'not-an-array' })).toBe(0)
  })

  test('formats batch completion summaries with an explicit partial count', () => {
    expect(formatBatchCompletionSummary(3, 1, 0)).toBe('Batch complete: 3 completed (2 full, 1 partial, 0 failed)')
    expect(formatBatchCompletionSummary(3, 0, 0)).toBe('Batch complete: 3 completed (3 full, 0 partial, 0 failed)')
  })

  test('formats STT batch completion summaries with incomplete items separated from failed items', () => {
    expect(formatSttBatchCompletionSummary(1, 2, 0)).toBe('Batch complete: 1 full, 2 incomplete, 0 failed')
  })

  test('groups partial provider failures by service/model', () => {
    expect(formatBatchPartialFailureSummary([
      { service: 'soniox', model: 'stt-async-v4', message: 'bad schema' },
      { service: 'soniox', model: 'stt-async-v4', message: 'bad schema' },
      { service: 'mistral', model: 'voxtral-mini-latest', message: '503' }
    ])).toBe('Partial provider failures: mistral/voxtral-mini-latest x1, soniox/stt-async-v4 x2')
  })

  test('builds final STT batch summary lines grouped by item and provider status', () => {
    expect(buildSttBatchFinalSummaryLines([
      {
        step1: {
          title: '2023-08-16-jsjam-magnoliajs-with-danielle-maxwell-mark-noonan-and-kayla-sween'
        },
        completionStatus: 'incomplete',
        providerStates: [
          { service: 'elevenlabs', model: 'scribe_v2', status: 'succeeded' },
          { service: 'deepgram', model: 'nova-3', status: 'succeeded' },
          { service: 'soniox', model: 'stt-async-v4', status: 'succeeded' },
          { service: 'speechmatics', model: 'enhanced', status: 'succeeded' },
          {
            service: 'rev',
            model: 'machine',
            status: 'failed',
            lastError: {
              message: 'REVAI_ACCESS_TOKEN environment variable is required for Rev transcription'
            }
          },
          { service: 'assemblyai', model: 'universal-3-pro', status: 'succeeded' }
        ]
      },
      {
        step1: {
          title: '2023-08-22-jsjam-chris-coyier'
        },
        completionStatus: 'incomplete',
        providerStates: [
          { service: 'elevenlabs', model: 'scribe_v2', status: 'succeeded' },
          { service: 'deepgram', model: 'nova-3', status: 'succeeded' },
          { service: 'soniox', model: 'stt-async-v4', status: 'succeeded' },
          { service: 'speechmatics', model: 'enhanced', status: 'succeeded' },
          {
            service: 'rev',
            model: 'machine',
            status: 'skipped',
            lastError: {
              message: 'REVAI_ACCESS_TOKEN environment variable is required for Rev transcription'
            }
          },
          { service: 'assemblyai', model: 'universal-3-pro', status: 'succeeded' }
        ]
      }
    ])).toEqual([
      'STT final provider status by item:',
      '1/2 2023-08-16-jsjam-magnoliajs-with-danielle-maxwell-mark-noonan-and-kayla-sween [incomplete]',
      'working: elevenlabs/scribe_v2, deepgram/nova-3, soniox/stt-async-v4, speechmatics/enhanced, assemblyai/universal-3-pro',
      'failed: rev/machine — REVAI_ACCESS_TOKEN environment variable is required for Rev transcription',
      '2/2 2023-08-22-jsjam-chris-coyier [incomplete]',
      'working: elevenlabs/scribe_v2, deepgram/nova-3, soniox/stt-async-v4, speechmatics/enhanced, assemblyai/universal-3-pro',
      'skipped: rev/machine — REVAI_ACCESS_TOKEN environment variable is required for Rev transcription'
    ])
  })

  test('falls back to a placeholder when STT provider details are unavailable', () => {
    expect(buildSttBatchFinalSummaryLines([
      {
        title: 'example-episode',
        completionStatus: 'failed'
      }
    ])).toEqual([
      'STT final provider status by item:',
      '1/1 example-episode [failed]',
      'providers: unavailable'
    ])
  })
})
