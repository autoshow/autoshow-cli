/**
 * Setup report command - measures setup + model preparation only.
 */

import { TTS_SETUP_COMMANDS } from '../constants.ts'
import { REPORT_SCHEMA_VERSION } from '../types.ts'
import type { SetupOnlyReport } from '../types.ts'
import { formatBytes, formatDuration } from '../lib/formatters.ts'
import { prepareTtsModel } from '../lib/model-preparation.ts'
import { saveReportArtifacts } from '../lib/report-files.ts'
import { generateSetupMarkdownReport } from '../lib/report-generator.ts'
import { getReadinessKey, getReadinessMarkerPath, writeReadinessMarker } from '../lib/readiness-marker.ts'
import { executeSetupCommand } from '../lib/setup-execution.ts'

export interface SetupCommandOptions {
  fresh?: boolean
  model?: string
}

function isTtsSetupCommand(command: string): boolean {
  return (TTS_SETUP_COMMANDS as readonly string[]).includes(command)
}

export async function setupCommand(setupCommandName: string, options: SetupCommandOptions): Promise<void> {
  if (!isTtsSetupCommand(setupCommandName)) {
    console.error(`Error: setup report is currently limited to TTS setup commands.`)
    console.error('Supported commands:')
    for (const cmd of TTS_SETUP_COMMANDS) {
      console.error(`  ${cmd}`)
    }
    process.exit(1)
  }

  const setupExecution = await executeSetupCommand(setupCommandName, {
    fresh: options.fresh,
    model: options.model,
    bannerLabel: 'Setup Timing Report',
  })

  let modelPreparation = await prepareTtsModel(setupCommandName, options.model)
  if (setupExecution.exitCode !== 0) {
    modelPreparation = {
      ...modelPreparation,
      success: false,
      error: modelPreparation.error || 'Setup failed before model preparation could complete.',
    }
  }

  const readinessKey = getReadinessKey(setupCommandName, options.model)
  const readinessMarkerPath = getReadinessMarkerPath(setupCommandName, options.model)
  const reportSuccess = setupExecution.success && modelPreparation.success
  const reportExitCode = reportSuccess ? 0 : (setupExecution.exitCode || 1)
  const totalDurationMs = setupExecution.durationMs + modelPreparation.durationMs

  const report: SetupOnlyReport = {
    ...setupExecution,
    schemaVersion: REPORT_SCHEMA_VERSION,
    reportType: 'setup',
    endTime: modelPreparation.endTime,
    durationMs: totalDurationMs,
    success: reportSuccess,
    exitCode: reportExitCode,
    model: options.model || modelPreparation.model,
    modelPreparation,
    readinessKey,
    readinessMarkerPath,
  }

  const { fileOperations: _fileOperations, ...jsonReport } = report
  const saved = await saveReportArtifacts({
    reportType: 'setup',
    status: report.success ? 'success' : 'failed',
    command: report.command,
    model: options.model,
    jsonContent: JSON.stringify(jsonReport, null, 2),
    markdownContent: generateSetupMarkdownReport(report),
  })

  if (report.success) {
    await writeReadinessMarker(setupCommandName, options.model, {
      setupReportPath: saved.jsonPath,
    })
  }

  console.log(`\n${'='.repeat(60)}`)
  console.log('Setup Timing Report Complete')
  console.log(`${'='.repeat(60)}`)
  console.log(`Status: ${report.success ? 'Success' : 'Failed'}`)
  console.log(`Setup Duration: ${formatDuration(setupExecution.durationMs)}`)
  console.log(`Model Prep Duration: ${formatDuration(report.modelPreparation.durationMs)}`)
  console.log(`Total Duration: ${formatDuration(totalDurationMs)}`)
  console.log(`Storage Added: ${formatBytes(report.storage.totalBytesAdded)}`)
  console.log(`Downloads Detected: ${report.downloads.length}`)
  console.log(`Model Prep Method: ${report.modelPreparation.method}`)
  if (report.modelPreparation.error) {
    console.log(`Model Prep Error: ${report.modelPreparation.error}`)
  }
  console.log(`Readiness Key: ${report.readinessKey}`)
  console.log(`Readiness Marker: ${report.readinessMarkerPath}`)

  console.log(`\nReports saved:`)
  console.log(`  JSON: ${saved.jsonPath}`)
  console.log(`  Markdown: ${saved.mdPath}`)
  console.log('')

  process.exit(report.success ? 0 : report.exitCode)
}
