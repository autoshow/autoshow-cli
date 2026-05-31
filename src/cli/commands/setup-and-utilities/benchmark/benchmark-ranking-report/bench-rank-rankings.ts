import {
  TOP_PICK_LIMIT_PER_BUCKET,
  TOP_PICK_TARGET_COUNT
} from './bench-rank-config'
import { assertValidReleaseDate, MODEL_RELEASE_DATES } from './bench-rank-release-dates'
import { isExcludedService } from './bench-rank-sources'
import type {
  CombinedRankingComponent,
  CombinedRankingMetric,
  CombinedRankingRow,
  ProviderAggregate,
  RankingRow,
  ReleaseDateMap,
  ReleaseDateMetadata,
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

const rankByKey = (rows: readonly RankingRow[]): Map<string, number> =>
  new Map(rows.map((row) => [row.key, row.rank]))

const rowByKey = (rows: readonly RankingRow[]): Map<string, RankingRow> =>
  new Map(rows.map((row) => [row.key, row]))

const clampScore = (score: number): number => Math.max(0, Math.min(100, score))

const lowerIsBetterScore = (row: RankingRow, rows: readonly RankingRow[]): number => {
  const values = rows.map((candidate) => candidate.average)
  const min = Math.min(...values)
  const max = Math.max(...values)

  if (min === max) {
    return 100
  }

  return clampScore(((max - row.average) / (max - min)) * 100)
}

const qualityScore = (row: RankingRow): number => clampScore(row.average)

const combinedMetricWeights = ({
  priceRows,
  speedRows,
  qualityRows
}: {
  priceRows: readonly RankingRow[]
  speedRows: readonly RankingRow[]
  qualityRows: readonly RankingRow[]
}): Map<CombinedRankingMetric, number> => {
  const baseWeights = new Map<CombinedRankingMetric, number>()

  if (qualityRows.length > 0) {
    baseWeights.set('quality', 0.5)
    if (speedRows.length > 0) {
      baseWeights.set('speed', 0.25)
    }
    if (priceRows.length > 0) {
      baseWeights.set('price', 0.25)
    }
  } else {
    if (speedRows.length > 0) {
      baseWeights.set('speed', 1)
    }
    if (priceRows.length > 0) {
      baseWeights.set('price', 1)
    }
  }

  const totalWeight = [...baseWeights.values()].reduce((sum, weight) => sum + weight, 0)
  if (totalWeight === 0) {
    return baseWeights
  }

  return new Map([...baseWeights.entries()].map(([metric, weight]) => [metric, weight / totalWeight]))
}

const component = ({
  key,
  rows,
  rowsByKey,
  metric
}: {
  key: string
  rows: readonly RankingRow[]
  rowsByKey: ReadonlyMap<string, RankingRow>
  metric: CombinedRankingMetric
}): CombinedRankingComponent => {
  if (rows.length === 0) {
    return {
      active: false,
      score: 0
    }
  }

  const row = rowsByKey.get(key)
  if (!row) {
    return {
      active: true,
      score: 50
    }
  }

  const score = metric === 'quality' ? qualityScore(row) : lowerIsBetterScore(row, rows)
  return {
    active: true,
    score,
    rank: row.rank,
    average: row.average,
    samples: row.count
  }
}

const releaseMetadataForKey = (
  key: string,
  releaseDates: ReleaseDateMap
): ReleaseDateMetadata | undefined =>
  releaseDates[key] ?? releaseDates[key.split('#')[0] ?? key]

export const combinedRankingRows = ({
  priceRows,
  speedRows,
  qualityRows,
  releaseDates = MODEL_RELEASE_DATES
}: {
  priceRows: readonly RankingRow[]
  speedRows: readonly RankingRow[]
  qualityRows: readonly RankingRow[]
  releaseDates?: ReleaseDateMap
}): CombinedRankingRow[] => {
  const weights = combinedMetricWeights({ priceRows, speedRows, qualityRows })
  if (weights.size === 0) {
    return []
  }

  const priceRowsByKey = rowByKey(priceRows)
  const speedRowsByKey = rowByKey(speedRows)
  const qualityRowsByKey = rowByKey(qualityRows)
  const keys = [...new Set([
    ...priceRows.map((row) => row.key),
    ...speedRows.map((row) => row.key),
    ...qualityRows.map((row) => row.key)
  ])].sort()

  const rows = keys.map((key): Omit<CombinedRankingRow, 'rank'> => {
    const releaseDate = assertValidReleaseDate(key, releaseMetadataForKey(key, releaseDates))
    const price = component({ key, rows: priceRows, rowsByKey: priceRowsByKey, metric: 'price' })
    const speed = component({ key, rows: speedRows, rowsByKey: speedRowsByKey, metric: 'speed' })
    const quality = component({ key, rows: qualityRows, rowsByKey: qualityRowsByKey, metric: 'quality' })
    const combinedScore = [...weights.entries()].reduce((score, [metric, weight]) => {
      if (metric === 'price') {
        return score + price.score * weight
      }
      if (metric === 'speed') {
        return score + speed.score * weight
      }
      return score + quality.score * weight
    }, 0)

    return {
      key,
      combinedScore,
      releaseDate: releaseDate.date,
      releaseDateSourceUrl: releaseDate.sourceUrl,
      ...(releaseDate.note ? { releaseDateNote: releaseDate.note } : {}),
      price,
      speed,
      quality
    }
  })

  return rows
    .sort((left, right) => {
      const scoreComparison = right.combinedScore - left.combinedScore
      return scoreComparison === 0 ? left.key.localeCompare(right.key) : scoreComparison
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
  const priceRanks = rankByKey(priceRows)
  const speedRanks = rankByKey(speedRows)
  const qualityRanks = rankByKey(qualityRows)
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

      const priceRank = priceRanks.get(candidate.key)
      const speedRank = speedRanks.get(candidate.key)
      const qualityRank = qualityRanks.get(candidate.key)

      rows.push({
        bucket,
        key: candidate.key,
        metric,
        metricName: candidate.metricName ?? metricName,
        metricValue: candidate.average,
        originalRank: candidate.rank,
        ...(priceRank !== undefined ? { priceRank } : {}),
        ...(speedRank !== undefined ? { speedRank } : {}),
        ...(qualityRank !== undefined ? { qualityRank } : {}),
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
