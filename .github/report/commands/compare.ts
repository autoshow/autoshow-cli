/**
 * Compare command - compares two reports of the same type.
 */

import type { AnyReport } from '../types.ts'
import { formatDuration } from '../lib/formatters.ts'
import { findReportPath } from '../lib/report-files.ts'
import { generateComparisonReport } from '../lib/report-generator.ts'
import { isLegacyRunReport, isRuntimeReport, isSetupReport, normalizeReport } from '../lib/report-type.ts'

export interface CompareOptions {
  json?: boolean
  markdown?: boolean
}

async function loadReport(name: string): Promise<AnyReport | null> {
  const found = await findReportPath(name)

  if (found.matches.length > 0) {
    console.error(`Multiple reports match '${name}':`)
    for (const match of found.matches) {
      console.error(`  ${match}`)
    }
    return null
  }

  if (!found.path) {
    console.error(`Report not found: ${name}`)
    return null
  }

  const raw = await Bun.file(found.path).json()
  return normalizeReport(raw)
}

export async function compareCommand(name1: string, name2: string, options: CompareOptions): Promise<void> {
  const report1 = await loadReport(name1)
  const report2 = await loadReport(name2)

  if (!report1 || !report2) {
    console.error('\nUse "bun .github/report/cli.ts list --reports" to see available reports.')
    process.exit(1)
  }

  if (report1.reportType !== report2.reportType) {
    console.error(`Cannot compare different report types: '${report1.reportType}' vs '${report2.reportType}'.`)
    console.error('Use reports of the same type (setup/setup, runtime/runtime, or run/run).')
    process.exit(1)
  }

  if (options.markdown) {
    console.log(generateComparisonReport(report1, report2))
    return
  }

  if (options.json) {
    if (isSetupReport(report1) && isSetupReport(report2)) {
      console.log(JSON.stringify({
        type: 'setup',
        report1: {
          name: name1,
          command: report1.setupCommand,
          date: report1.startTime,
          success: report1.success,
          durationMs: report1.durationMs,
          modelPreparationMs: report1.modelPreparation.durationMs,
          storageAdded: report1.storage.totalBytesAdded,
          downloads: report1.downloads.length,
          errors: report1.errors.length,
        },
        report2: {
          name: name2,
          command: report2.setupCommand,
          date: report2.startTime,
          success: report2.success,
          durationMs: report2.durationMs,
          modelPreparationMs: report2.modelPreparation.durationMs,
          storageAdded: report2.storage.totalBytesAdded,
          downloads: report2.downloads.length,
          errors: report2.errors.length,
        },
        differences: {
          durationMs: report2.durationMs - report1.durationMs,
          modelPreparationMs: report2.modelPreparation.durationMs - report1.modelPreparation.durationMs,
          storageAdded: report2.storage.totalBytesAdded - report1.storage.totalBytesAdded,
          downloads: report2.downloads.length - report1.downloads.length,
          errors: report2.errors.length - report1.errors.length,
        },
      }, null, 2))
      return
    }

    if (isRuntimeReport(report1) && isRuntimeReport(report2)) {
      console.log(JSON.stringify({
        type: 'runtime',
        report1: {
          name: name1,
          command: report1.setupCommand,
          date: report1.startTime,
          success: report1.success,
          warmupMs: report1.warmupRun.durationMs,
          measuredMs: report1.measuredRun?.durationMs ?? null,
          charactersPerSecond: report1.measuredRun?.charactersPerSecond ?? null,
          realTimeRatio: report1.measuredRun?.realTimeRatio ?? null,
          errors: report1.errors.length,
        },
        report2: {
          name: name2,
          command: report2.setupCommand,
          date: report2.startTime,
          success: report2.success,
          warmupMs: report2.warmupRun.durationMs,
          measuredMs: report2.measuredRun?.durationMs ?? null,
          charactersPerSecond: report2.measuredRun?.charactersPerSecond ?? null,
          realTimeRatio: report2.measuredRun?.realTimeRatio ?? null,
          errors: report2.errors.length,
        },
        differences: {
          warmupMs: report2.warmupRun.durationMs - report1.warmupRun.durationMs,
          measuredMs: (report2.measuredRun?.durationMs ?? 0) - (report1.measuredRun?.durationMs ?? 0),
          charactersPerSecond: (report2.measuredRun?.charactersPerSecond ?? 0) - (report1.measuredRun?.charactersPerSecond ?? 0),
          realTimeRatio: (report2.measuredRun?.realTimeRatio ?? 0) - (report1.measuredRun?.realTimeRatio ?? 0),
          errors: report2.errors.length - report1.errors.length,
        },
      }, null, 2))
      return
    }

    if (isLegacyRunReport(report1) && isLegacyRunReport(report2)) {
      console.log(JSON.stringify({
        type: 'run',
        report1: {
          name: name1,
          command: report1.setupCommand,
          date: report1.startTime,
          success: report1.success,
          durationMs: report1.durationMs,
          storageAdded: report1.storage.totalBytesAdded,
          testRunMs: report1.testRun?.durationMs ?? null,
          errors: report1.errors.length,
        },
        report2: {
          name: name2,
          command: report2.setupCommand,
          date: report2.startTime,
          success: report2.success,
          durationMs: report2.durationMs,
          storageAdded: report2.storage.totalBytesAdded,
          testRunMs: report2.testRun?.durationMs ?? null,
          errors: report2.errors.length,
        },
        differences: {
          durationMs: report2.durationMs - report1.durationMs,
          storageAdded: report2.storage.totalBytesAdded - report1.storage.totalBytesAdded,
          testRunMs: (report2.testRun?.durationMs ?? 0) - (report1.testRun?.durationMs ?? 0),
          errors: report2.errors.length - report1.errors.length,
        },
      }, null, 2))
      return
    }
  }

  console.log(`\n${'='.repeat(70)}`)
  console.log('Report Comparison')
  console.log(`${'='.repeat(70)}\n`)
  console.log(`Type: ${report1.reportType}`)
  console.log(`Report 1: ${name1} (${report1.setupCommand}, ${formatDuration(report1.durationMs)})`)
  console.log(`Report 2: ${name2} (${report2.setupCommand}, ${formatDuration(report2.durationMs)})`)
  console.log('')
  console.log(generateComparisonReport(report1, report2))
}
