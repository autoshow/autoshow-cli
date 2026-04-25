import { describe, expect, test } from 'bun:test'
import { buildBenchmarkAttemptRecord } from '~/cli/commands/setup-and-utilities/benchmark/run-benchmark'

describe('benchmark contracts', () => {
  test('benchmark attempt records identify provider, variant, status, and redact secrets', () => {
    const record = buildBenchmarkAttemptRecord(
      {
        path: '/tmp/audio.m4a',
        kind: 'speed',
        label: '3x',
        speedMultiplier: 3
      },
      {
        service: 'deapi',
        model: 'WhisperLargeV3',
        envVar: 'DEAPI_API_KEY'
      },
      'error',
      1250,
      'request failed: https://api.example.test/jobs?api_key=secret-token'
    )

    expect(record).toEqual({
      kind: 'benchmark-attempt',
      schemaVersion: 1,
      status: 'error',
      variant: {
        kind: 'speed',
        label: '3x',
        bitrateKbps: undefined,
        speedMultiplier: 3
      },
      service: 'deapi',
      model: 'WhisperLargeV3',
      processingTimeMs: 1250,
      error: 'request failed: https://api.example.test/jobs?api_key=REDACTED'
    })
  })
})
