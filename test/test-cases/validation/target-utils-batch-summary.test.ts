import { describe, expect, test } from 'bun:test'
import { formatBatchCompletionSummary, getBatchManifestErrorCount } from '~/cli/commands/process-steps/step-1-download/targets/target-utils'

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
    expect(formatBatchCompletionSummary(3, 1, 0)).toBe('Batch complete: 2 succeeded, 1 partial, 0 failed')
    expect(formatBatchCompletionSummary(3, 0, 0)).toBe('Batch complete: 3 succeeded, 0 failed')
  })
})
