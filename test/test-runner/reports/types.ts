import type { ParsedCommandMetric, ParsedJunitCase } from '~/types'

export type MatchProvenance = 'name-file' | 'name-global' | 'line-unique' | 'group-order' | 'heuristic'

type MatchEntry = { metrics: ParsedCommandMetric[]; matchedBy: MatchProvenance }
export type MatchResult = Map<string, MatchEntry>

export type HistoricalLookup = {
  durationById: Map<string, number>
  processingTimeById: Map<string, number>
}

export type ServiceModelPair = {
  kind: string | null
  service: string
  model: string | null
}

export type MetricContext = {
  metric: ParsedCommandMetric
  kind: string | null
  isPrice: boolean
  pairs: ServiceModelPair[]
}

export type TestContext = {
  testCase: ParsedJunitCase
  kind: string | null
  isPrice: boolean
  serviceHints: Set<string>
  modelHints: Set<string>
}

export type BudgetPreflightSummary = {
  suiteName: string
  budgetHundredthCents: number
  commandsChecked: number
  commandsRunnable: number
  commandsSkipped: number
  commandsFailed: number
  runnableEstimatedCostCents: number
  skipKeys: string[]
  skippedEntries: {
    key: string
    selectedCostCents: number
  }[]
}
