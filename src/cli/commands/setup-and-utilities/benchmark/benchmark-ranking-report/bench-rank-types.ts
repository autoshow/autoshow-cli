export type JsonObject = Record<string, unknown>

export type SourceKind = 'raw' | 'dashboard'

export type StepKey =
  | 'download'
  | 'documentOcr'
  | 'urlExtraction'
  | 'transcription'
  | 'llm'
  | 'tts'
  | 'image'
  | 'video'
  | 'music'

export interface StepDefinition {
  key: StepKey
  title: string
  noQualityNote: string
}

export interface SourceSample {
  step: StepKey
  key: string
  sourcePath: string
  sourceKind: SourceKind
  priceUsd?: number
  speedMs?: number
  qualityScore?: number
  qualityMetric?: string
}

export interface ProviderAggregate {
  key: string
  priceValues: number[]
  speedValues: number[]
  qualityValues: number[]
  qualityMetrics: Set<string>
  sources: Set<string>
  sourceKinds: Set<SourceKind>
}

export interface DashboardFile {
  fileName: string
  absPath: string
  relPath: string
  mode: string
}

export interface RawReportFile {
  absPath: string
  relPath: string
  rawType: string
  runId: string
}

export interface RankingRow {
  rank: number
  key: string
  average: number
  count: number
  metricName?: string
}

export type TopPickBucket = 'Fastest' | 'Cheapest' | 'Best'

export type TopPickMetric = 'speed' | 'price' | 'quality'

export interface TopBenchmarkPick {
  bucket: TopPickBucket
  key: string
  metric: TopPickMetric
  metricName: string
  metricValue: number
  originalRank: number
  samples: number
  selectionNote: string
}

export interface TopBenchmarkPickSelection {
  rows: TopBenchmarkPick[]
  note?: string
}

export interface ReportStats {
  indexFiles: number
  benchmarkDashboardsSkipped: number
  dashboardReportsRead: number
  rawReportsRead: number
  totalRowsSeen: number
  includedRows: number
  excludedNonThirdPartyRows: number
  omittedFailedRows: number
  unsupportedCategoryRows: number
  noMetricRows: number
  priceRowsFilledFromRunEstimates: number
  missingPriceRows: number
  missingSpeedRows: number
  missingQualityRows: number
  contributedSources: Set<string>
  skippedBenchmarkDashboards: string[]
}
