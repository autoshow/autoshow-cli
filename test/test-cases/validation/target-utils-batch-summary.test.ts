import { describe, expect, test } from 'bun:test'
import {
  buildBatchCompletionTable,
  buildBatchPartialFailureTable,
  buildSttBatchFinalSummaryTable,
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

  test('builds non-STT batch summary tables with full, partial, and failed counts', () => {
    expect(buildBatchCompletionTable('ocr', 3, 1, 0, 0).rows).toEqual([
      { completed: 3, full: 2, partial: 1, failed: 0 }
    ])
    expect(buildBatchCompletionTable('download', 3, 0, 0, 0).rows).toEqual([
      { completed: 3, full: 3, partial: 0, failed: 0 }
    ])
  })

  test('builds STT batch summary tables with incomplete items separated from failed items', () => {
    expect(buildBatchCompletionTable('stt', 1, 0, 2, 0).rows).toEqual([
      { full: 1, incomplete: 2, failed: 0 }
    ])
  })

  test('builds a partial provider failure table grouped by service/model', () => {
    expect(buildBatchPartialFailureTable([
      { service: 'soniox', model: 'stt-async-v4', message: 'bad schema' },
      { service: 'soniox', model: 'stt-async-v4', message: 'bad schema' },
      { service: 'mistral', model: 'voxtral-mini-2602', message: '503' }
    ]).rows).toEqual([
      { provider: 'mistral/voxtral-mini-2602', failures: 1 },
      { provider: 'soniox/stt-async-v4', failures: 2 }
    ])
  })

  test('builds an STT final summary table with one row per provider outcome', () => {
    expect(buildSttBatchFinalSummaryTable([
      {
        title: 'example-episode',
        completionStatus: 'incomplete',
        providerStates: [
          { service: 'deepgram', model: 'nova-3', status: 'succeeded' },
          {
            service: 'rev',
            model: 'machine',
            status: 'failed',
            lastError: { message: 'token missing' }
          }
        ]
      }
    ]).rows).toEqual([
      {
        item: '1/1',
        label: 'example-episode',
        status: 'incomplete',
        provider: 'deepgram/nova-3',
        providerStatus: 'succeeded',
        detail: ''
      },
      {
        item: '1/1',
        label: 'example-episode',
        status: 'incomplete',
        provider: 'rev/machine',
        providerStatus: 'failed',
        detail: 'token missing'
      }
    ])
  })

  test('falls back to a placeholder row when STT provider details are unavailable', () => {
    expect(buildSttBatchFinalSummaryTable([
      {
        title: 'example-episode',
        completionStatus: 'failed'
      }
    ]).rows).toEqual([
      {
        item: '1/1',
        label: 'example-episode',
        status: 'failed',
        provider: 'unavailable',
        providerStatus: 'unavailable',
        detail: ''
      }
    ])
  })
})
