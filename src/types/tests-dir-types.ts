import type { VideoProvider } from './provider-types'

export type ApiCheapPriceCommand = {
  name: string
  args: string[]
}

export type PriceCommandSpec = {
  name: string
  key: string
  args: string[]
  budgetSkippable: boolean
}

export type PriceSelectionEntry = PriceCommandSpec & {
  selector: string
  selectorKind: 'file' | 'prefix'
}

export type VideoSelection = {
  provider: VideoProvider
  model: string
  duration: number
  size?: string
  resolution?: string
  totalCost: number
}

export type TestStatus = 'passed' | 'failed' | 'skipped'

export type TestRunArtifacts = {
  rootDir: string
  runId: string
  runDir: string
  runnerLogPath: string
  commandLogPath: string
  metricsLogPath: string
  activeRunPath: string
  junitPath: string
  reportJsonPath: string
  e2eReportJsonPath: string
  calibrationReportJsonPath: string
  metadataDirPath: string
  startedAtMs: number
  startedAtIso: string
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
  key: string
  args: string[]
  status: TestStatus
  exitCode: number
  durationMs: number
  costCents: number | null
  failureMessage: string | null
}
