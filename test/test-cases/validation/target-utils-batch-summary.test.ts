import { describe, expect, test } from 'bun:test'
import {
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
})
