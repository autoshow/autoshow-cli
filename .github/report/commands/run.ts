/**
 * Legacy run command - executes setup and optional test in a single report.
 */

import { AVAILABLE_SETUP_COMMANDS, TTS_SETUP_COMMANDS } from '../constants.ts'
import { REPORT_SCHEMA_VERSION } from '../types.ts'
import type { SetupReport } from '../types.ts'
import { formatBytes, formatDuration } from '../lib/formatters.ts'
import { saveReportArtifacts } from '../lib/report-files.ts'
import { generateLegacyRunMarkdownReport } from '../lib/report-generator.ts'
import { executeSetupCommand } from '../lib/setup-execution.ts'
import { runTestCommand } from '../lib/test-runner.ts'

export interface RunOptions {
  fresh?: boolean
  skipTest?: boolean
  input?: string
  model?: string
}

export async function runSetupWithReport(setupCommand: string, options: RunOptions): Promise<SetupReport> {
  const { fresh = false, skipTest = false, input: customInputFile } = options
  const shouldRunTest = !skipTest

  const setupExecution = await executeSetupCommand(setupCommand, {
    fresh,
    model: options.model,
    bannerLabel: 'Legacy Setup Report',
  })

  const report: SetupReport = {
    ...setupExecution,
    schemaVersion: REPORT_SCHEMA_VERSION,
    reportType: 'run',
  }

  if (shouldRunTest && report.exitCode === 0) {
    report.testRun = await runTestCommand(setupCommand, customInputFile, options.model)
  } else if (shouldRunTest && report.exitCode !== 0) {
    console.log('\nSkipping test run because setup failed.')
  }

  return report
}

export async function runCommand(setupCommand: string, options: RunOptions): Promise<void> {
  if (!AVAILABLE_SETUP_COMMANDS.includes(setupCommand) && !setupCommand.startsWith('setup:')) {
    console.error(`Error: Unknown setup command '${setupCommand}'`)
    console.error(`\nAvailable setup commands:`)
    for (const cmd of AVAILABLE_SETUP_COMMANDS) {
      console.error(`  ${cmd}`)
    }
    process.exit(1)
  }

  if ((TTS_SETUP_COMMANDS as readonly string[]).includes(setupCommand)) {
    console.warn('Warning: `report run` is legacy for TTS. Use `report setup` and `report runtime` for split metrics.')
  }

  const report = await runSetupWithReport(setupCommand, options)
  const overallSuccess = report.success && (!report.testRun || report.testRun.success)
  const status = overallSuccess ? 'success' : 'failed'
  const { fileOperations: _fileOperations, ...jsonReport } = report
  const saved = await saveReportArtifacts({
    reportType: 'run',
    status,
    command: report.command,
    model: options.model,
    input: options.input,
    jsonContent: JSON.stringify(jsonReport, null, 2),
    markdownContent: generateLegacyRunMarkdownReport(report),
  })

  console.log(`\n${'='.repeat(60)}`)
  console.log('Legacy Setup Report Complete')
  console.log(`${'='.repeat(60)}`)
  console.log(`Status: ${overallSuccess ? 'Success' : 'Failed'}${!report.success ? ' (Setup Failed)' : report.testRun && !report.testRun.success ? ' (Test Failed)' : ''}`)
  console.log(`Duration: ${formatDuration(report.durationMs)}`)
  console.log(`Storage Added: ${formatBytes(report.storage.totalBytesAdded)}`)
  console.log(`Files Created: ${report.fileOperations.filter((file) => file.type === 'created').length}`)
  console.log(`Phases Detected: ${report.phases.length}`)
  console.log(`Downloads Detected: ${report.downloads.length}`)
  console.log(`Errors: ${report.errors.length}`)

  if (report.testRun) {
    console.log('')
    console.log('Test Run:')
    console.log(`  Status: ${report.testRun.success ? 'Success' : 'Failed'}`)
    if (report.testRun.model) {
      console.log(`  Model: ${report.testRun.model}`)
    }
    console.log(`  Generation Time: ${formatDuration(report.testRun.durationMs)}`)
    console.log(`  Input: ${report.testRun.inputCharacters} chars, ${report.testRun.inputWords} words`)
    if (report.testRun.outputDurationSeconds) {
      console.log(`  Audio Duration: ${report.testRun.outputDurationSeconds.toFixed(2)}s`)
    }
    if (report.testRun.charactersPerSecond) {
      console.log(`  Speed: ${report.testRun.charactersPerSecond.toFixed(1)} chars/sec`)
    }
    if (report.testRun.realTimeRatio) {
      console.log(`  Real-time Ratio: ${report.testRun.realTimeRatio.toFixed(2)}x`)
    }
  }

  console.log(`\nReports saved:`)
  console.log(`  JSON: ${saved.jsonPath}`)
  console.log(`  Markdown: ${saved.mdPath}`)
  console.log('')

  const exitCode = overallSuccess ? 0 : (report.exitCode || 1)
  process.exit(exitCode)
}
