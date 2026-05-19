import {
  TOP_PICK_LIMIT_PER_BUCKET,
  TOP_PICK_TARGET_COUNT
} from './bench-rank-config'
import { isExcludedService } from './bench-rank-sources'
import type {
  ProviderAggregate,
  RankingRow,
  StepKey,
  TopBenchmarkPick,
  TopBenchmarkPickSelection,
  TopPickBucket,
  TopPickMetric
} from './bench-rank-types'

const average = (values: readonly number[]): number => {
  if (values.length === 0) {
    throw new Error('Cannot average an empty value list')
  }
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

export const rankingRows = (
  stepAggregates: Map<string, ProviderAggregate>,
  metric: 'price' | 'speed' | 'quality'
): RankingRow[] => {
  const rows: Omit<RankingRow, 'rank'>[] = []

  for (const aggregate of stepAggregates.values()) {
    if (metric === 'price' && aggregate.priceValues.length > 0) {
      rows.push({
        key: aggregate.key,
        average: average(aggregate.priceValues),
        count: aggregate.priceValues.length
      })
    } else if (metric === 'speed' && aggregate.speedValues.length > 0) {
      rows.push({
        key: aggregate.key,
        average: average(aggregate.speedValues) / 1000,
        count: aggregate.speedValues.length
      })
    } else if (metric === 'quality' && aggregate.qualityValues.length > 0) {
      const metrics = [...aggregate.qualityMetrics].sort()
      const row: Omit<RankingRow, 'rank'> = {
        key: aggregate.key,
        average: average(aggregate.qualityValues),
        count: aggregate.qualityValues.length
      }
      const metricName = metrics.length === 1 ? metrics[0] ?? '' : metrics.join(', ')
      if (metricName.length > 0) {
        row.metricName = metricName
      }
      rows.push(row)
    }
  }

  const direction = metric === 'quality' ? -1 : 1
  return rows
    .sort((left, right) => {
      const averageComparison = (left.average - right.average) * direction
      return averageComparison === 0 ? left.key.localeCompare(right.key) : averageComparison
    })
    .map((row, index) => ({ ...row, rank: index + 1 }))
}

const topPickShortfallNote = (selectedCount: number, eligibleCount: number): string | undefined => {
  if (selectedCount >= TOP_PICK_TARGET_COUNT) {
    return undefined
  }

  if (eligibleCount < TOP_PICK_TARGET_COUNT) {
    return `Only ${selectedCount} ${selectedCount === 1 ? 'pick is' : 'picks are'} shown because only ${eligibleCount} unique provider/models had eligible ranking rows for this step.`
  }

  return `Only ${selectedCount} picks are shown because overlapping provider/models were already claimed by higher-priority buckets.`
}

export const selectTopBenchmarkPicks = ({
  priceRows,
  speedRows,
  qualityRows
}: {
  priceRows: readonly RankingRow[]
  speedRows: readonly RankingRow[]
  qualityRows: readonly RankingRow[]
}): TopBenchmarkPickSelection => {
  const rows: TopBenchmarkPick[] = []
  const selectedKeys = new Set<string>()
  const bestRows = qualityRows.length > 0
    ? qualityRows
    : [...priceRows].sort((left, right) => {
      const priceComparison = right.average - left.average
      return priceComparison === 0 ? left.rank - right.rank : priceComparison
    })
  const eligibleKeys = new Set([
    ...bestRows.map((row) => row.key),
    ...priceRows.map((row) => row.key),
    ...speedRows.map((row) => row.key)
  ])

  const addBucket = (
    bucket: TopPickBucket,
    candidates: readonly RankingRow[],
    metric: TopPickMetric,
    metricName: string,
    selectionNote: string
  ): void => {
    let added = 0
    for (const candidate of candidates) {
      if (selectedKeys.has(candidate.key)) {
        continue
      }

      rows.push({
        bucket,
        key: candidate.key,
        metric,
        metricName: candidate.metricName ?? metricName,
        metricValue: candidate.average,
        originalRank: candidate.rank,
        samples: candidate.count,
        selectionNote
      })
      selectedKeys.add(candidate.key)
      added++

      if (added >= TOP_PICK_LIMIT_PER_BUCKET) {
        return
      }
    }
  }

  addBucket(
    'Best',
    bestRows,
    qualityRows.length > 0 ? 'quality' : 'price',
    qualityRows.length > 0 ? 'quality score' : 'average cost',
    qualityRows.length > 0 ? 'Best: highest quality score' : 'Best proxy: highest cost'
  )
  addBucket('Cheapest', priceRows, 'price', 'average cost', 'Cheapest: lowest cost')
  addBucket('Fastest', speedRows, 'speed', 'average seconds', 'Fastest: lowest processing time')

  const note = topPickShortfallNote(rows.length, eligibleKeys.size)
  return note ? { rows, note } : { rows }
}

export const verifyNoExcludedProvidersInRankings = (
  aggregates: Map<StepKey, Map<string, ProviderAggregate>>
): void => {
  const leakedProviders: string[] = []
  for (const stepAggregates of aggregates.values()) {
    for (const key of stepAggregates.keys()) {
      if (isExcludedService(key)) {
        leakedProviders.push(key)
      }
    }
  }

  if (leakedProviders.length > 0) {
    throw new Error(`Excluded local/non-third-party providers leaked into rankings: ${leakedProviders.join(', ')}`)
  }
}

export const sourceKindSummary = (aggregates: Map<StepKey, Map<string, ProviderAggregate>>): string => {
  let rawProviderModels = 0
  let dashboardProviderModels = 0

  for (const stepAggregates of aggregates.values()) {
    for (const aggregate of stepAggregates.values()) {
      if (aggregate.sourceKinds.has('raw')) {
        rawProviderModels++
      }
      if (aggregate.sourceKinds.has('dashboard')) {
        dashboardProviderModels++
      }
    }
  }

  return `${rawProviderModels} provider/model rankings include raw comparison data; ${dashboardProviderModels} include test-run dashboard data.`
}
