import { appendFile, mkdir, readdir, readFile, rm } from 'node:fs/promises'
import { resolve } from 'node:path'
import type { TestRunArtifacts } from '~/types'
import { formatTimestampForDir } from './utils'

const LATEST_LOG_FILE = 'latest.log'

export const TEST_OUTPUT_ROOT = resolve(process.cwd(), 'project/test-output')
export const LATEST_TEST_LOG_PATH = resolve(TEST_OUTPUT_ROOT, LATEST_LOG_FILE)

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null

const readTextIfExists = async (path: string): Promise<string> => {
  try {
    return await readFile(path, 'utf8')
  } catch {
    return ''
  }
}

const readJsonIfExists = async (path: string): Promise<Record<string, unknown> | null> => {
  const text = await readTextIfExists(path)
  if (!text.trim()) {
    return null
  }

  try {
    const parsed = JSON.parse(text) as unknown
    return isRecord(parsed) ? parsed : null
  } catch {
    return null
  }
}

const formatUnknown = (value: unknown): string | null => {
  if (typeof value === 'string' && value.length > 0) return value
  if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  return null
}

const appendRunSummary = (
  lines: string[],
  report: Record<string, unknown> | null,
  artifacts: TestRunArtifacts,
  exitCode: number
): void => {
  const runRaw = report?.['run']
  const summaryRaw = report?.['summary']
  const run = isRecord(runRaw) ? runRaw : {}
  const summary = isRecord(summaryRaw) ? summaryRaw : {}

  lines.push('AutoShow test runner latest log')
  lines.push(`Run ID: ${formatUnknown(run['id']) ?? artifacts.runId}`)
  lines.push(`Mode: ${formatUnknown(run['mode']) ?? 'unknown'}`)
  lines.push(`Exit code: ${exitCode}`)
  lines.push(`Started: ${formatUnknown(run['startedAt']) ?? artifacts.startedAtIso}`)
  lines.push(`Ended: ${formatUnknown(run['endedAt']) ?? 'unknown'}`)
  lines.push(`Duration ms: ${formatUnknown(run['durationMs']) ?? 'unknown'}`)

  const argv = Array.isArray(run['argv'])
    ? run['argv'].filter((value): value is string => typeof value === 'string')
    : []
  lines.push(`Args: ${argv.join(' ')}`)
  lines.push('')
  lines.push('Summary')
  lines.push(`Total: ${formatUnknown(summary['total']) ?? 'unknown'}`)
  lines.push(`Passed: ${formatUnknown(summary['passed']) ?? 'unknown'}`)
  lines.push(`Failed: ${formatUnknown(summary['failed']) ?? 'unknown'}`)
  lines.push(`Skipped: ${formatUnknown(summary['skipped']) ?? 'unknown'}`)
}

const appendFailures = (lines: string[], report: Record<string, unknown> | null): void => {
  lines.push('')
  lines.push('Failures')

  const testsRaw = report?.['tests']
  const commandsRaw = report?.['commands']
  const failedTests = Array.isArray(testsRaw)
    ? testsRaw.filter((entry): entry is Record<string, unknown> =>
        isRecord(entry) && entry['status'] === 'failed')
    : []
  const failedCommands = Array.isArray(commandsRaw)
    ? commandsRaw.filter((entry): entry is Record<string, unknown> =>
        isRecord(entry) && entry['status'] === 'failed')
    : []

  if (failedTests.length === 0 && failedCommands.length === 0 && !report?.['error']) {
    lines.push('None recorded')
    return
  }

  for (const entry of failedTests) {
    const file = formatUnknown(entry['file']) ?? 'unknown file'
    const name = formatUnknown(entry['name']) ?? 'unknown test'
    const message = formatUnknown(entry['failureMessage'])
    lines.push(`- ${file} :: ${name}${message ? `: ${message}` : ''}`)
  }

  for (const entry of failedCommands) {
    const name = formatUnknown(entry['name']) ?? 'unknown command'
    const message = formatUnknown(entry['failureMessage'])
    lines.push(`- ${name}${message ? `: ${message}` : ''}`)
  }

  const error = formatUnknown(report?.['error'])
  if (error) {
    lines.push(`- runner error: ${error}`)
  }
}

export const cleanupTestOutputRoot = async (rootDir = TEST_OUTPUT_ROOT): Promise<void> => {
  await mkdir(rootDir, { recursive: true })

  const entries = await readdir(rootDir, { withFileTypes: true })
  await Promise.all(
    entries
      .filter(entry => entry.name !== LATEST_LOG_FILE)
      .map(entry => rm(resolve(rootDir, entry.name), { recursive: true, force: true }))
  )
}

export const createRunArtifacts = async (rootDir = TEST_OUTPUT_ROOT): Promise<TestRunArtifacts> => {
  const started = new Date()
  const startedAtMs = started.getTime()
  const startedAtIso = started.toISOString()
  await mkdir(rootDir, { recursive: true })

  const base = `${formatTimestampForDir(started)}_test-run`
  let runId = base
  let runDir = resolve(rootDir, runId)

  for (let i = 1; i < 1000; i++) {
    try {
      await mkdir(runDir, { recursive: false })
      break
    } catch {
      runId = `${base}_${i}`
      runDir = resolve(rootDir, runId)
    }
  }

  const runnerLogPath = resolve(runDir, 'runner.log')
  const commandLogPath = resolve(runDir, 'commands.log')
  const metricsLogPath = resolve(runDir, 'metrics.ndjson')
  const metadataDirPath = resolve(runDir, 'metadata')
  await Bun.write(runnerLogPath, '')
  await Bun.write(commandLogPath, '')
  await Bun.write(metricsLogPath, '')
  await mkdir(metadataDirPath, { recursive: true })

  return {
    rootDir,
    runId,
    runDir,
    runnerLogPath,
    commandLogPath,
    metricsLogPath,
    junitPath: resolve(runDir, 'junit.xml'),
    reportJsonPath: resolve(runDir, 'report.json'),
    e2eReportJsonPath: resolve(runDir, 'e2e-report.json'),
    calibrationReportJsonPath: resolve(runDir, 'model-calibration.json'),
    metadataDirPath,
    startedAtMs,
    startedAtIso,
  }
}

export const appendRunnerLog = async (artifacts: TestRunArtifacts, text: string): Promise<void> => {
  await appendFile(artifacts.runnerLogPath, text)
}

export const appendCommandLog = async (artifacts: TestRunArtifacts, text: string): Promise<void> => {
  await appendFile(artifacts.commandLogPath, text)
}

export const writeReportJson = async (
  artifacts: TestRunArtifacts,
  json: Record<string, unknown>
): Promise<void> => {
  await Bun.write(artifacts.reportJsonPath, JSON.stringify(json, null, 2))
}

export const writeJsonFile = async (
  path: string,
  json: Record<string, unknown>
): Promise<void> => {
  await Bun.write(path, JSON.stringify(json, null, 2))
}

export const writeLatestRunLog = async (
  artifacts: TestRunArtifacts,
  exitCode: number
): Promise<string> => {
  const latestLogPath = resolve(artifacts.rootDir, LATEST_LOG_FILE)
  const report = await readJsonIfExists(artifacts.reportJsonPath)
  const reportText = await readTextIfExists(artifacts.reportJsonPath)
  const runnerLog = await readTextIfExists(artifacts.runnerLogPath)
  const commandLog = await readTextIfExists(artifacts.commandLogPath)
  const lines: string[] = []

  appendRunSummary(lines, report, artifacts, exitCode)
  appendFailures(lines, report)

  lines.push('')
  lines.push('=== report.json ===')
  lines.push(reportText.trim() || '<missing>')
  lines.push('')
  lines.push('=== runner.log ===')
  lines.push(runnerLog.trim() || '<missing>')
  lines.push('')
  lines.push('=== commands.log ===')
  lines.push(commandLog.trim() || '<missing>')

  await mkdir(artifacts.rootDir, { recursive: true })
  await Bun.write(latestLogPath, `${lines.join('\n')}\n`)
  return latestLogPath
}
