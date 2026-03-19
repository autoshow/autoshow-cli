/**
 * Type definitions for the Report CLI
 */

export type ReportType = 'run' | 'setup' | 'runtime'

export const REPORT_SCHEMA_VERSION = 2

export interface FileOperation {
  type: 'created' | 'modified' | 'deleted'
  path: string
  relativePath: string
  timestamp: string
  size: number
  source?: string
}

export interface Phase {
  name: string
  startTime: string
  endTime?: string
  durationMs?: number
  success: boolean
  details?: string
}

export interface Download {
  url: string
  destination?: string
  size?: number
  durationMs?: number
  success: boolean
  error?: string
}

export interface ErrorInfo {
  timestamp: string
  message: string
  context?: string
  line?: string
}

export interface StorageMetrics {
  totalBytesAdded: number
  totalBytesModified: number
  largestFiles: Array<{ path: string; size: number }>
  byDirectory: Record<string, number>
}

export interface TestRunResult {
  command: string
  inputFile: string
  inputSize: number
  inputCharacters: number
  inputWords: number
  model?: string
  outputFile?: string
  outputSize?: number
  outputDurationSeconds?: number
  startTime: string
  endTime: string
  durationMs: number
  success: boolean
  exitCode: number
  error?: string
  stdout: string
  stderr: string
  charactersPerSecond?: number
  wordsPerSecond?: number
  realTimeRatio?: number
}

export interface ReportEnvironment {
  platform: string
  arch: string
  bunVersion: string
  cwd: string
}

export interface SetupExecutionReport {
  command: string
  setupCommand: string
  startTime: string
  endTime: string
  durationMs: number
  success: boolean
  exitCode: number
  freshRun: boolean

  phases: Phase[]
  fileOperations: FileOperation[]
  downloads: Download[]
  errors: ErrorInfo[]
  storage: StorageMetrics

  environment: ReportEnvironment

  stdout: string
  stderr: string
}

export interface ModelPreparationResult {
  model: string
  method: 'python-prefetch' | 'asset-check' | 'docker-health-check'
  startTime: string
  endTime: string
  durationMs: number
  success: boolean
  details?: string
  error?: string
}

export interface LegacyRunReport extends SetupExecutionReport {
  schemaVersion: number
  reportType: 'run'
  testRun?: TestRunResult
}

export interface SetupOnlyReport extends SetupExecutionReport {
  schemaVersion: number
  reportType: 'setup'
  model?: string
  modelPreparation: ModelPreparationResult
  readinessKey: string
  readinessMarkerPath: string
}

export interface RuntimeReport {
  schemaVersion: number
  reportType: 'runtime'
  command: string
  setupCommand: string
  startTime: string
  endTime: string
  durationMs: number
  success: boolean
  exitCode: number

  model?: string
  inputFile: string
  benchmarkRun: 'measured'

  warmupRun: TestRunResult
  measuredRun?: TestRunResult
  errors: ErrorInfo[]

  environment: ReportEnvironment
  stdout: string
  stderr: string
}

// Backward-compatible alias used by legacy run command paths
export type SetupReport = LegacyRunReport

export type AnyReport = LegacyRunReport | SetupOnlyReport | RuntimeReport

export interface TestConfig {
  type: 'tts' | 'transcription'
  inputFile: string
  commandArgs: string[]
}

export interface ReportSummary {
  name: string
  path: string
  reportType: ReportType
  command: string
  date: string
  success: boolean
  durationMs: number
  storageAdded: number
  hasTestRun: boolean
  hasWarmupRun?: boolean
  hasMeasuredRun?: boolean
}
