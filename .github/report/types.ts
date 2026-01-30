/**
 * Type definitions for the Report CLI
 */

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

export interface SetupReport {
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

  testRun?: TestRunResult

  environment: {
    platform: string
    arch: string
    bunVersion: string
    cwd: string
  }

  stdout: string
  stderr: string
}

export interface TestConfig {
  type: 'tts' | 'transcription'
  inputFile: string
  commandArgs: string[]
}

export interface ReportSummary {
  name: string
  path: string
  command: string
  date: string
  success: boolean
  durationMs: number
  storageAdded: number
  hasTestRun: boolean
}
