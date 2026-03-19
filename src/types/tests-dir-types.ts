import type { VideoProvider } from '~/types/provider-types'

export type ApiCheapPriceCommand = {
  name: string
  args: string[]
}

export type VideoSelection = {
  provider: VideoProvider
  model: string
  duration: number
  size?: string
  resolution?: string
  totalCost: number
}

export type Tier = 'smoke' | 'local' | 'api' | 'slow-local' | 'slow-api'

export type TestStatus = 'passed' | 'failed' | 'skipped'

export type TestRunArtifacts = {
  rootDir: string
  runId: string
  runDir: string
  runnerLogPath: string
  commandLogPath: string
  metricsLogPath: string
  junitPath: string
  reportJsonPath: string
  e2eReportJsonPath: string
  calibrationReportJsonPath: string
  metadataDirPath: string
  startedAtMs: number
  startedAtIso: string
}

export type CommandMetricRecord = {
  kind?: string
  source?: string
  command?: string
  args?: string[]
  exitCode?: number
  durationMs?: number
  outputDir?: string | null
  callerFile?: string | null
  callerLine?: number | null
  callerColumn?: number | null
  at?: string | null
  testName?: string | null
  estimatedCostCents?: number | null
  actualCostCents?: number | null
  estimatedProcessingTimeMs?: number | null
  actualProcessingTimeMs?: number | null
}

export type ParsedCommandMetric = {
  source: string
  command: string
  args: string[]
  exitCode: number
  durationMs: number
  outputDir: string | null
  callerFile: string | null
  callerLine: number | null
  callerColumn: number | null
  at: string | null
  testName: string | null
  estimatedCostCents: number | null
  actualCostCents: number | null
  estimatedProcessingTimeMs: number | null
  actualProcessingTimeMs: number | null
}

export type ParsedJunitCase = {
  id: string
  file: string
  name: string
  line: number | null
  durationMs: number
  status: TestStatus
  failureMessage: string | null
}

export type PriceCommandResult = {
  name: string
  args: string[]
  status: TestStatus
  exitCode: number
  durationMs: number
  costCents: number | null
  failureMessage: string | null
}

export type DocsCommand = {
  name: string
  description: string
  command: string
}
