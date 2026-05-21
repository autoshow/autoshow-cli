import { describe, expect, test } from 'bun:test'
import { buildBenchmarkAttemptRecord } from '~/cli/commands/setup-and-utilities/benchmark/run-benchmark'
import {
  buildEstimatedCostCentsByProviderModel,
  combinedRankingRows,
  isExcludedService,
  resolveDashboardSpeedMsForRanking,
  resolveRawSpeedMsForRanking,
  resolveRawCostUsd,
  selectTopBenchmarkPicks
} from '~/cli/commands/setup-and-utilities/benchmark/benchmark-ranking-report/bench-rank-report'
import type { ReleaseDateMap } from '~/cli/commands/setup-and-utilities/benchmark/benchmark-ranking-report/bench-rank-types'

const rankingRow = (rank: number, key: string, average: number, count = 1, metricName?: string) => ({
  rank,
  key,
  average,
  count,
  ...(metricName ? { metricName } : {})
})

const pickKeys = (
  selection: ReturnType<typeof selectTopBenchmarkPicks>,
  bucket: 'Best' | 'Cheapest' | 'Fastest'
): string[] => selection.rows.filter((row) => row.bucket === bucket).map((row) => row.key)

const releaseDatesFor = (keys: readonly string[]): ReleaseDateMap =>
  Object.fromEntries(keys.map((key, index) => [
    key,
    {
      date: `2026-01-${String(index + 1).padStart(2, '0')}`,
      sourceUrl: `https://example.test/releases/${encodeURIComponent(key)}`
    }
  ]))

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
        service: 'deepgram',
        model: 'nova-3',
        envVar: 'DEEPGRAM_API_KEY'
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
      service: 'deepgram',
      model: 'nova-3',
      processingTimeMs: 1250,
      error: 'request failed: https://api.example.test/jobs?api_key=REDACTED'
    })
  })

  test('benchmark ranking excludes local Reverb providers', () => {
    expect(isExcludedService('reverb/reverb')).toBe(true)
    expect(isExcludedService('reverb/reverb_asr_v1')).toBe(true)
  })

  test('benchmark ranking falls back from zero raw Happy Scribe costs to run estimates', () => {
    const estimateCosts = buildEstimatedCostCentsByProviderModel({
      metadata: {
        cost: {
          estimated: {
            steps: [
              {
                provider: 'happyscribe',
                model: 'auto',
                cost: 40.384
              }
            ]
          }
        }
      }
    })

    const resolved = resolveRawCostUsd(
      {
        provider: 'happyscribe-auto',
        providerKey: 'happyscribe/auto',
        actualCostCents: 0,
        costCents: null
      },
      estimateCosts
    )

    expect(resolved.usedEstimateFallback).toBe(true)
    expect(resolved.priceUsd).toBeCloseTo(0.40384)
  })

  test('benchmark ranking preserves zero-cost rows without positive run estimates', () => {
    const estimateCosts = buildEstimatedCostCentsByProviderModel({
      metadata: {
        cost: {
          estimated: {
            steps: [
              {
                provider: 'zero',
                model: 'free',
                cost: 0
              }
            ]
          }
        }
      }
    })

    const resolved = resolveRawCostUsd(
      {
        provider: 'zero-free',
        providerKey: 'zero/free',
        actualCostCents: 0,
        costCents: 0
      },
      estimateCosts
    )

    expect(resolved).toEqual({
      priceUsd: 0,
      usedEstimateFallback: false
    })
  })

  test('benchmark ranking prefers normalized speed over absolute wall time', () => {
    expect(resolveRawSpeedMsForRanking({
      msPerUnit: 125,
      actualProcessingTimeMs: 5000,
      processingTimeMs: 6000
    })).toBe(125)

    expect(resolveDashboardSpeedMsForRanking({
      durations: {
        primaryStep: {
          actualMs: 5000,
          actualMsPerUnit: 250
        },
        endToEnd: {
          actualMs: 9000
        }
      }
    })).toBe(250)
  })

  test('benchmark Top 6 assigns an overlapping model to Best first', () => {
    const selection = selectTopBenchmarkPicks({
      qualityRows: [
        rankingRow(1, 'shared/model', 99, 3, 'quality score'),
        rankingRow(2, 'quality/runner-up', 98, 3, 'quality score')
      ],
      priceRows: [
        rankingRow(1, 'shared/model', 0.01),
        rankingRow(2, 'cheap/next', 0.02)
      ],
      speedRows: [
        rankingRow(1, 'shared/model', 0.1),
        rankingRow(2, 'fast/next', 0.2)
      ]
    })

    expect(selection.rows.filter((row) => row.key === 'shared/model')).toHaveLength(1)
    expect(selection.rows.find((row) => row.key === 'shared/model')?.bucket).toBe('Best')
  })

  test('benchmark Top 6 cheapest and fastest buckets skip already-selected models', () => {
    const selection = selectTopBenchmarkPicks({
      qualityRows: [
        rankingRow(1, 'claimed/best', 100, 2, 'quality score'),
        rankingRow(2, 'quality/second', 99, 2, 'quality score'),
        rankingRow(3, 'quality/third', 98, 2, 'quality score')
      ],
      priceRows: [
        rankingRow(1, 'claimed/best', 0.01),
        rankingRow(2, 'cheap/one', 0.02),
        rankingRow(3, 'cheap/two', 0.03),
        rankingRow(4, 'cheap/three', 0.04)
      ],
      speedRows: [
        rankingRow(1, 'claimed/best', 0.1),
        rankingRow(2, 'cheap/one', 0.2),
        rankingRow(3, 'quality/second', 0.3),
        rankingRow(4, 'fast/one', 0.4),
        rankingRow(5, 'fast/two', 0.5),
        rankingRow(6, 'fast/three', 0.6)
      ]
    })

    expect(pickKeys(selection, 'Cheapest')).toEqual(['cheap/one', 'cheap/two'])
    expect(pickKeys(selection, 'Fastest')).toEqual(['fast/one', 'fast/two'])
    expect(selection.rows).toHaveLength(6)
    expect(new Set(selection.rows.map((row) => row.key)).size).toBe(6)
  })

  test('benchmark Top 6 uses highest price as the Best proxy when quality is missing', () => {
    const selection = selectTopBenchmarkPicks({
      qualityRows: [],
      priceRows: [
        rankingRow(1, 'cheap/model', 0.01),
        rankingRow(2, 'mid/model', 0.5),
        rankingRow(3, 'expensive/model', 1),
        rankingRow(4, 'most-expensive/model', 2)
      ],
      speedRows: []
    })

    const bestRows = selection.rows.filter((row) => row.bucket === 'Best')
    expect(bestRows.map((row) => row.key)).toEqual(['most-expensive/model', 'expensive/model'])
    expect(bestRows.map((row) => row.originalRank)).toEqual([4, 3])
    expect(bestRows.every((row) => row.selectionNote === 'Best proxy: highest cost')).toBe(true)
  })

  test('benchmark Top 6 returns fewer unique picks when fewer unique candidates exist', () => {
    const selection = selectTopBenchmarkPicks({
      qualityRows: [rankingRow(1, 'only/shared', 90, 1, 'quality score')],
      priceRows: [rankingRow(1, 'only/shared', 0.01)],
      speedRows: [
        rankingRow(1, 'only/shared', 0.1),
        rankingRow(2, 'only/fast', 0.2)
      ]
    })

    const keys = selection.rows.map((row) => row.key)
    expect(keys).toHaveLength(2)
    expect(new Set(keys).size).toBe(keys.length)
    expect(selection.note).toBe('Only 2 picks are shown because only 2 unique provider/models had eligible ranking rows for this step.')
  })

  test('benchmark combined ranking uses 50/25/25 scoring when quality is present', () => {
    const rows = combinedRankingRows({
      qualityRows: [
        rankingRow(1, 'balanced/a', 80, 1, 'quality score'),
        rankingRow(2, 'balanced/b', 60, 1, 'quality score')
      ],
      priceRows: [
        rankingRow(1, 'balanced/a', 10),
        rankingRow(2, 'balanced/b', 20)
      ],
      speedRows: [
        rankingRow(1, 'balanced/b', 2),
        rankingRow(2, 'balanced/a', 4)
      ],
      releaseDates: releaseDatesFor(['balanced/a', 'balanced/b'])
    })

    expect(rows.map((row) => [row.key, row.rank, row.combinedScore])).toEqual([
      ['balanced/a', 1, 65],
      ['balanced/b', 2, 55]
    ])
  })

  test('benchmark combined ranking renormalizes price and speed when quality is absent', () => {
    const rows = combinedRankingRows({
      qualityRows: [],
      priceRows: [
        rankingRow(1, 'no-quality/cheap', 10),
        rankingRow(2, 'no-quality/mid', 15),
        rankingRow(3, 'no-quality/expensive', 20)
      ],
      speedRows: [
        rankingRow(1, 'no-quality/cheap', 2),
        rankingRow(2, 'no-quality/mid', 3),
        rankingRow(3, 'no-quality/expensive', 4)
      ],
      releaseDates: releaseDatesFor(['no-quality/cheap', 'no-quality/mid', 'no-quality/expensive'])
    })

    expect(rows.map((row) => [row.key, row.combinedScore])).toEqual([
      ['no-quality/cheap', 100],
      ['no-quality/mid', 50],
      ['no-quality/expensive', 0]
    ])
  })

  test('benchmark combined ranking uses neutral 50 for missing active provider metrics', () => {
    const rows = combinedRankingRows({
      qualityRows: [],
      priceRows: [
        rankingRow(1, 'missing/complete', 10),
        rankingRow(2, 'missing/no-speed', 20)
      ],
      speedRows: [
        rankingRow(1, 'missing/complete', 2)
      ],
      releaseDates: releaseDatesFor(['missing/complete', 'missing/no-speed'])
    })

    const missing = rows.find((row) => row.key === 'missing/no-speed')
    expect(missing?.speed.score).toBe(50)
    expect(missing?.speed.rank).toBeUndefined()
    expect(missing?.combinedScore).toBe(25)
  })

  test('benchmark combined ranking orders ties deterministically by provider/model key', () => {
    const rows = combinedRankingRows({
      qualityRows: [],
      priceRows: [
        rankingRow(1, 'tie/b', 1),
        rankingRow(2, 'tie/a', 1)
      ],
      speedRows: [],
      releaseDates: releaseDatesFor(['tie/a', 'tie/b'])
    })

    expect(rows.map((row) => row.key)).toEqual(['tie/a', 'tie/b'])
  })

  test('benchmark combined ranking fails when release-date metadata is missing', () => {
    expect(() => combinedRankingRows({
      qualityRows: [],
      priceRows: [rankingRow(1, 'missing/date', 1)],
      speedRows: [],
      releaseDates: {}
    })).toThrow('Missing benchmark release-date metadata for provider/model: missing/date')
  })
})
