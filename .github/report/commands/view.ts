/**
 * View command - displays a specific report.
 */

import type { AnyReport } from '../types.ts'
import { formatBytes, formatDuration, formatDate } from '../lib/formatters.ts'
import { findReportPath } from '../lib/report-files.ts'
import { isLegacyRunReport, isRuntimeReport, isSetupReport, normalizeReport } from '../lib/report-type.ts'

export interface ViewOptions {
  json?: boolean
  markdown?: boolean
}

async function loadReport(name: string): Promise<{ path: string; report: AnyReport } | null> {
  const found = await findReportPath(name)

  if (found.matches.length > 0) {
    console.error(`Multiple reports match '${name}':`)
    for (const match of found.matches) {
      console.error(`  ${match}`)
    }
    return null
  }

  if (!found.path) {
    return null
  }

  const raw = await Bun.file(found.path).json()
  return {
    path: found.path,
    report: normalizeReport(raw),
  }
}

export async function viewCommand(name: string, options: ViewOptions): Promise<void> {
  const loaded = await loadReport(name)
  if (!loaded) {
    console.error(`Report not found: ${name}`)
    console.error('\nUse "bun .github/report/cli.ts list --reports" to see available reports.')
    process.exit(1)
  }

  const { path: reportPath, report } = loaded

  if (options.markdown) {
    const mdPath = reportPath.replace(/\.json$/, '.md')
    const exists = await Bun.file(mdPath).exists()
    if (exists) {
      const content = await Bun.file(mdPath).text()
      console.log(content)
      return
    }
    console.error('Markdown report not found, showing summary instead.')
  }

  if (options.json) {
    console.log(JSON.stringify(report, null, 2))
    return
  }

  console.log(`\n${'='.repeat(60)}`)
  console.log(`Report: ${report.command}`)
  console.log(`${'='.repeat(60)}\n`)

  console.log('Overview:')
  console.log(`  Type:        ${report.reportType}`)
  console.log(`  Command:     ${report.setupCommand}`)
  console.log(`  Date:        ${formatDate(report.startTime)}`)
  console.log(`  Duration:    ${formatDuration(report.durationMs)}`)
  console.log(`  Status:      ${report.success ? 'Success' : 'Failed'}`)
  console.log(`  Exit Code:   ${report.exitCode}`)
  console.log('')

  console.log('Environment:')
  console.log(`  Platform:    ${report.environment.platform}`)
  console.log(`  Arch:        ${report.environment.arch}`)
  console.log(`  Bun:         ${report.environment.bunVersion}`)
  console.log('')

  if (!isRuntimeReport(report)) {
    console.log('Storage:')
    console.log(`  Added:       ${formatBytes(report.storage.totalBytesAdded)}`)
    if (report.storage.totalBytesModified > 0) {
      console.log(`  Modified:    ${formatBytes(report.storage.totalBytesModified)}`)
    }
    console.log('')

    if (report.phases.length > 0) {
      console.log(`Phases: ${report.phases.length}`)
      for (const phase of report.phases.slice(0, 10)) {
        const duration = phase.durationMs ? formatDuration(phase.durationMs) : '-'
        const status = phase.success ? 'OK' : 'FAIL'
        console.log(`  [${status}] ${phase.name} (${duration})`)
      }
      if (report.phases.length > 10) {
        console.log(`  ... and ${report.phases.length - 10} more phases`)
      }
      console.log('')
    }

    if (report.downloads.length > 0) {
      console.log(`Downloads: ${report.downloads.length}`)
      for (const dl of report.downloads.slice(0, 5)) {
        const displayUrl = dl.url.replace(/^(pypi|huggingface):\/\/\//, '')
        console.log(`  ${displayUrl}`)
      }
      if (report.downloads.length > 5) {
        console.log(`  ... and ${report.downloads.length - 5} more`)
      }
      console.log('')
    }
  }

  if (isSetupReport(report)) {
    console.log('Model Preparation:')
    console.log(`  Model:       ${report.modelPreparation.model}`)
    console.log(`  Method:      ${report.modelPreparation.method}`)
    console.log(`  Duration:    ${formatDuration(report.modelPreparation.durationMs)}`)
    console.log(`  Status:      ${report.modelPreparation.success ? 'Success' : 'Failed'}`)
    if (report.modelPreparation.details) {
      console.log(`  Details:     ${report.modelPreparation.details}`)
    }
    if (report.modelPreparation.error) {
      console.log(`  Error:       ${report.modelPreparation.error}`)
    }
    console.log(`  Ready Key:   ${report.readinessKey}`)
    console.log(`  Marker:      ${report.readinessMarkerPath}`)
    console.log('')
  }

  if (isRuntimeReport(report)) {
    console.log('Runtime Benchmark:')
    console.log(`  Input:       ${report.inputFile}`)
    if (report.model) {
      console.log(`  Model:       ${report.model}`)
    }
    console.log(`  Warm-up:     ${formatDuration(report.warmupRun.durationMs)} (${report.warmupRun.success ? 'Success' : 'Failed'})`)
    if (report.measuredRun) {
      console.log(`  Measured:    ${formatDuration(report.measuredRun.durationMs)} (${report.measuredRun.success ? 'Success' : 'Failed'})`)
      if (report.measuredRun.charactersPerSecond) {
        console.log(`  Speed:       ${report.measuredRun.charactersPerSecond.toFixed(1)} chars/sec`)
      }
      if (report.measuredRun.realTimeRatio) {
        console.log(`  RT Ratio:    ${report.measuredRun.realTimeRatio.toFixed(2)}x`)
      }
    } else {
      console.log('  Measured:    Missing')
    }
    console.log('')
  }

  if (isLegacyRunReport(report) && report.testRun) {
    console.log('Legacy Test Run:')
    console.log(`  Command:     ${report.testRun.command}`)
    console.log(`  Status:      ${report.testRun.success ? 'Success' : 'Failed'}`)
    console.log(`  Duration:    ${formatDuration(report.testRun.durationMs)}`)
    if (report.testRun.charactersPerSecond) {
      console.log(`  Speed:       ${report.testRun.charactersPerSecond.toFixed(1)} chars/sec`)
    }
    if (report.testRun.realTimeRatio) {
      console.log(`  RT Ratio:    ${report.testRun.realTimeRatio.toFixed(2)}x`)
    }
    console.log('')
  }

  if (report.errors.length > 0) {
    console.log(`Errors: ${report.errors.length}`)
    for (const error of report.errors.slice(0, 3)) {
      console.log(`  ${error.message.slice(0, 100)}${error.message.length > 100 ? '...' : ''}`)
    }
    if (report.errors.length > 3) {
      console.log(`  ... and ${report.errors.length - 3} more`)
    }
    console.log('')
  }

  console.log('Report files:')
  console.log(`  JSON:     ${reportPath}`)
  console.log(`  Markdown: ${reportPath.replace(/\.json$/, '.md')}`)
  console.log('')
}
