/**
 * View command - displays a specific report
 */

import { readdir } from 'node:fs/promises'
import { join } from 'node:path'
import type { SetupReport } from '../types.ts'
import { REPORTS_DIR } from '../constants.ts'
import { fileExists } from '../lib/utils.ts'
import { formatBytes, formatDuration, formatDate } from '../lib/formatters.ts'

export interface ViewOptions {
  json?: boolean
  markdown?: boolean
}

async function findReport(name: string): Promise<string | null> {
  // Try exact match first
  const exactJson = join(REPORTS_DIR, `${name}.json`)
  if (await fileExists(exactJson)) {
    return exactJson
  }

  // Try partial match
  if (await fileExists(REPORTS_DIR)) {
    const entries = await readdir(REPORTS_DIR, { withFileTypes: true })
    const matches = entries.filter(
      (e) => e.isFile() && e.name.endsWith('.json') && e.name.toLowerCase().includes(name.toLowerCase())
    )

    if (matches.length === 1) {
      return join(REPORTS_DIR, matches[0].name)
    } else if (matches.length > 1) {
      console.error(`Multiple reports match '${name}':`)
      for (const m of matches) {
        console.error(`  ${m.name.replace('.json', '')}`)
      }
      return null
    }
  }

  return null
}

export async function viewCommand(name: string, options: ViewOptions): Promise<void> {
  const reportPath = await findReport(name)

  if (!reportPath) {
    console.error(`Report not found: ${name}`)
    console.error('\nUse "bun .github/report/cli.ts list --reports" to see available reports.')
    process.exit(1)
  }

  // Check if markdown version exists
  if (options.markdown) {
    const mdPath = reportPath.replace('.json', '.md')
    if (await fileExists(mdPath)) {
      const content = await Bun.file(mdPath).text()
      console.log(content)
      return
    }
    console.error('Markdown report not found, showing summary instead.')
  }

  const report = (await Bun.file(reportPath).json()) as SetupReport

  if (options.json) {
    console.log(JSON.stringify(report, null, 2))
    return
  }

  // Display summary
  console.log(`\n${'='.repeat(60)}`)
  console.log(`Report: ${report.command}`)
  console.log(`${'='.repeat(60)}\n`)

  console.log('Overview:')
  console.log(`  Command:     ${report.setupCommand}`)
  console.log(`  Date:        ${formatDate(report.startTime)}`)
  console.log(`  Duration:    ${formatDuration(report.durationMs)}`)
  console.log(`  Status:      ${report.success ? 'Success' : 'Failed'}`)
  console.log(`  Exit Code:   ${report.exitCode}`)
  console.log(`  Fresh Run:   ${report.freshRun ? 'Yes' : 'No'}`)
  console.log('')

  console.log('Environment:')
  console.log(`  Platform:    ${report.environment.platform}`)
  console.log(`  Arch:        ${report.environment.arch}`)
  console.log(`  Bun:         ${report.environment.bunVersion}`)
  console.log('')

  console.log('Storage:')
  console.log(`  Added:       ${formatBytes(report.storage.totalBytesAdded)}`)
  if (report.storage.totalBytesModified > 0) {
    console.log(`  Modified:    ${formatBytes(report.storage.totalBytesModified)}`)
  }

  const nonZeroDirs = Object.entries(report.storage.byDirectory).filter(([_, size]) => size > 0)
  if (nonZeroDirs.length > 0) {
    console.log('  By Directory:')
    for (const [dir, size] of nonZeroDirs.sort((a, b) => b[1] - a[1])) {
      console.log(`    ${dir}: ${formatBytes(size)}`)
    }
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

  if (report.errors.length > 0) {
    console.log(`Errors: ${report.errors.length}`)
    for (const err of report.errors.slice(0, 3)) {
      console.log(`  ${err.message.slice(0, 80)}${err.message.length > 80 ? '...' : ''}`)
    }
    if (report.errors.length > 3) {
      console.log(`  ... and ${report.errors.length - 3} more`)
    }
    console.log('')
  }

  if (report.testRun) {
    console.log('Test Run:')
    console.log(`  Command:     ${report.testRun.command}`)
    console.log(`  Status:      ${report.testRun.success ? 'Success' : 'Failed'}`)
    console.log(`  Duration:    ${formatDuration(report.testRun.durationMs)}`)
    console.log(`  Input:       ${report.testRun.inputCharacters} chars, ${report.testRun.inputWords} words`)
    if (report.testRun.outputFile) {
      console.log(`  Output:      ${report.testRun.outputFile} (${formatBytes(report.testRun.outputSize || 0)})`)
    }
    if (report.testRun.outputDurationSeconds) {
      console.log(`  Audio:       ${report.testRun.outputDurationSeconds.toFixed(2)}s`)
    }
    if (report.testRun.charactersPerSecond) {
      console.log(`  Speed:       ${report.testRun.charactersPerSecond.toFixed(1)} chars/sec`)
    }
    if (report.testRun.realTimeRatio) {
      console.log(`  RT Ratio:    ${report.testRun.realTimeRatio.toFixed(2)}x`)
    }
    console.log('')
  }

  console.log(`Report files:`)
  console.log(`  JSON:     ${reportPath}`)
  console.log(`  Markdown: ${reportPath.replace('.json', '.md')}`)
  console.log('')
}
