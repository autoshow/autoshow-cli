/**
 * Compare command - compares two reports
 */

import { readdir } from 'node:fs/promises'
import { join } from 'node:path'
import type { SetupReport } from '../types.ts'
import { REPORTS_DIR } from '../constants.ts'
import { fileExists } from '../lib/utils.ts'
import { formatBytes, formatDuration, formatDate } from '../lib/formatters.ts'
import { generateComparisonReport } from '../lib/report-generator.ts'

export interface CompareOptions {
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

async function loadReport(name: string): Promise<SetupReport | null> {
  const path = await findReport(name)
  if (!path) {
    console.error(`Report not found: ${name}`)
    return null
  }
  return (await Bun.file(path).json()) as SetupReport
}

export async function compareCommand(name1: string, name2: string, options: CompareOptions): Promise<void> {
  const report1 = await loadReport(name1)
  const report2 = await loadReport(name2)

  if (!report1 || !report2) {
    console.error('\nUse "bun .github/report/cli.ts list --reports" to see available reports.')
    process.exit(1)
  }

  if (options.markdown) {
    console.log(generateComparisonReport(report1, report2))
    return
  }

  if (options.json) {
    const comparison = {
      report1: {
        name: name1,
        command: report1.setupCommand,
        date: report1.startTime,
        success: report1.success,
        durationMs: report1.durationMs,
        storageAdded: report1.storage.totalBytesAdded,
        phases: report1.phases.length,
        downloads: report1.downloads.length,
        errors: report1.errors.length,
        testRun: report1.testRun
          ? {
              durationMs: report1.testRun.durationMs,
              success: report1.testRun.success,
              charactersPerSecond: report1.testRun.charactersPerSecond,
              realTimeRatio: report1.testRun.realTimeRatio,
            }
          : null,
      },
      report2: {
        name: name2,
        command: report2.setupCommand,
        date: report2.startTime,
        success: report2.success,
        durationMs: report2.durationMs,
        storageAdded: report2.storage.totalBytesAdded,
        phases: report2.phases.length,
        downloads: report2.downloads.length,
        errors: report2.errors.length,
        testRun: report2.testRun
          ? {
              durationMs: report2.testRun.durationMs,
              success: report2.testRun.success,
              charactersPerSecond: report2.testRun.charactersPerSecond,
              realTimeRatio: report2.testRun.realTimeRatio,
            }
          : null,
      },
      differences: {
        durationMs: report2.durationMs - report1.durationMs,
        storageAdded: report2.storage.totalBytesAdded - report1.storage.totalBytesAdded,
        phases: report2.phases.length - report1.phases.length,
        downloads: report2.downloads.length - report1.downloads.length,
        errors: report2.errors.length - report1.errors.length,
      },
    }
    console.log(JSON.stringify(comparison, null, 2))
    return
  }

  // Text output
  console.log(`\n${'='.repeat(70)}`)
  console.log('Report Comparison')
  console.log(`${'='.repeat(70)}\n`)

  const col1 = 20
  const col2 = 25
  const col3 = 25

  const pad = (s: string, len: number) => s.padEnd(len)

  console.log(pad('Metric', col1) + pad('Report 1', col2) + pad('Report 2', col3) + 'Difference')
  console.log('-'.repeat(70))

  // Command
  console.log(pad('Command', col1) + pad(report1.setupCommand, col2) + pad(report2.setupCommand, col3))

  // Date
  console.log(pad('Date', col1) + pad(formatDate(report1.startTime), col2) + pad(formatDate(report2.startTime), col3))

  // Status
  const status1 = report1.success ? 'Success' : 'Failed'
  const status2 = report2.success ? 'Success' : 'Failed'
  console.log(pad('Status', col1) + pad(status1, col2) + pad(status2, col3))

  // Duration
  const durationDiff = report2.durationMs - report1.durationMs
  const durationSign = durationDiff > 0 ? '+' : ''
  console.log(
    pad('Duration', col1) +
      pad(formatDuration(report1.durationMs), col2) +
      pad(formatDuration(report2.durationMs), col3) +
      `${durationSign}${formatDuration(Math.abs(durationDiff))}`
  )

  // Storage
  const storageDiff = report2.storage.totalBytesAdded - report1.storage.totalBytesAdded
  const storageSign = storageDiff > 0 ? '+' : '-'
  console.log(
    pad('Storage Added', col1) +
      pad(formatBytes(report1.storage.totalBytesAdded), col2) +
      pad(formatBytes(report2.storage.totalBytesAdded), col3) +
      `${storageSign}${formatBytes(Math.abs(storageDiff))}`
  )

  // Phases
  const phasesDiff = report2.phases.length - report1.phases.length
  const phasesSign = phasesDiff > 0 ? '+' : ''
  console.log(
    pad('Phases', col1) +
      pad(String(report1.phases.length), col2) +
      pad(String(report2.phases.length), col3) +
      `${phasesSign}${phasesDiff}`
  )

  // Downloads
  const downloadsDiff = report2.downloads.length - report1.downloads.length
  const downloadsSign = downloadsDiff > 0 ? '+' : ''
  console.log(
    pad('Downloads', col1) +
      pad(String(report1.downloads.length), col2) +
      pad(String(report2.downloads.length), col3) +
      `${downloadsSign}${downloadsDiff}`
  )

  // Errors
  const errorsDiff = report2.errors.length - report1.errors.length
  const errorsSign = errorsDiff > 0 ? '+' : ''
  console.log(
    pad('Errors', col1) +
      pad(String(report1.errors.length), col2) +
      pad(String(report2.errors.length), col3) +
      `${errorsSign}${errorsDiff}`
  )

  // Test run comparison
  if (report1.testRun && report2.testRun) {
    console.log('')
    console.log('-'.repeat(70))
    console.log('Test Run Comparison')
    console.log('-'.repeat(70))

    // Test duration
    const testDurationDiff = report2.testRun.durationMs - report1.testRun.durationMs
    const testDurationSign = testDurationDiff > 0 ? '+' : ''
    console.log(
      pad('Generation Time', col1) +
        pad(formatDuration(report1.testRun.durationMs), col2) +
        pad(formatDuration(report2.testRun.durationMs), col3) +
        `${testDurationSign}${formatDuration(Math.abs(testDurationDiff))}`
    )

    // Characters per second
    if (report1.testRun.charactersPerSecond && report2.testRun.charactersPerSecond) {
      const cpsDiff = report2.testRun.charactersPerSecond - report1.testRun.charactersPerSecond
      const cpsSign = cpsDiff > 0 ? '+' : ''
      console.log(
        pad('Chars/Second', col1) +
          pad(report1.testRun.charactersPerSecond.toFixed(1), col2) +
          pad(report2.testRun.charactersPerSecond.toFixed(1), col3) +
          `${cpsSign}${cpsDiff.toFixed(1)}`
      )
    }

    // Real-time ratio
    if (report1.testRun.realTimeRatio && report2.testRun.realTimeRatio) {
      const rtrDiff = report2.testRun.realTimeRatio - report1.testRun.realTimeRatio
      const rtrSign = rtrDiff > 0 ? '+' : ''
      console.log(
        pad('Real-time Ratio', col1) +
          pad(`${report1.testRun.realTimeRatio.toFixed(2)}x`, col2) +
          pad(`${report2.testRun.realTimeRatio.toFixed(2)}x`, col3) +
          `${rtrSign}${rtrDiff.toFixed(2)}x`
      )
    }
  } else if (report1.testRun || report2.testRun) {
    console.log('')
    console.log('Note: Only one report has test run data.')
  }

  console.log('')
}
