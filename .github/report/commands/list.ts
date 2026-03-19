/**
 * List command - lists available report types or existing reports.
 */

import { relative } from 'node:path'
import type { ReportSummary } from '../types.ts'
import { AVAILABLE_SETUP_COMMANDS, REPORTS_DIR, TEST_CONFIGS, TTS_SETUP_COMMANDS } from '../constants.ts'
import { formatBytes, formatDuration, formatDateShort } from '../lib/formatters.ts'
import { listJsonReportFiles } from '../lib/report-files.ts'
import { normalizeReport } from '../lib/report-type.ts'

export interface ListOptions {
  reports?: boolean
  json?: boolean
}

async function listReportTypes(options: ListOptions): Promise<void> {
  const commands = Array.from(new Set([...AVAILABLE_SETUP_COMMANDS, ...Object.keys(TEST_CONFIGS)]))
  const types = commands.map((command) => {
    const config = TEST_CONFIGS[command]
    const isTts = (TTS_SETUP_COMMANDS as readonly string[]).includes(command)
    return {
      command,
      type: config?.type || (command.includes('transcription') || command.includes('text') ? 'transcription' : 'tts'),
      profileSupport: isTts ? 'setup + runtime + run(legacy)' : 'run(legacy)',
      inputFile: config?.inputFile || '-',
      testCommand: config ? `bun as -- ${config.commandArgs.join(' ')}` : 'N/A',
    }
  })

  if (options.json) {
    console.log(JSON.stringify(types, null, 2))
    return
  }

  console.log('Available Setup Commands:\n')
  console.log('| Command | Type | Reporting Modes | Default Input |')
  console.log('|---------|------|-----------------|---------------|')
  for (const type of types) {
    console.log(`| ${type.command} | ${type.type} | ${type.profileSupport} | ${type.inputFile} |`)
  }

  console.log('')
  console.log('Usage:')
  console.log('  bun .github/report/cli.ts setup <tts-command> [--fresh] [--model <model>]')
  console.log('  bun .github/report/cli.ts runtime <tts-command> [--input <file>] [--model <model>]')
  console.log('  bun .github/report/cli.ts run <command> [--input <file>] [--fresh] [--skip-test]  # legacy')
  console.log('')
  console.log('Legacy-compatible commands:')
  for (const cmd of AVAILABLE_SETUP_COMMANDS.slice(0, 3)) {
    console.log(`  bun .github/report/cli.ts run ${cmd}`)
  }
}

async function listExistingReports(options: ListOptions): Promise<void> {
  const jsonFiles = await listJsonReportFiles(REPORTS_DIR)

  if (jsonFiles.length === 0) {
    if (options.json) {
      console.log(JSON.stringify([], null, 2))
    } else {
      console.log('No reports found. Run a report command first:')
      console.log('  bun .github/report/cli.ts setup setup:tts:qwen3 --fresh')
    }
    return
  }

  const summaries: ReportSummary[] = []
  for (const filePath of jsonFiles) {
    try {
      const raw = await Bun.file(filePath).json()
      const report = normalizeReport(raw)
      const storageAdded = 'storage' in report ? report.storage.totalBytesAdded : 0
      const hasTestRun = report.reportType === 'run' && !!report.testRun
      const hasWarmupRun = report.reportType === 'runtime' && !!report.warmupRun
      const hasMeasuredRun = report.reportType === 'runtime' && !!report.measuredRun

      summaries.push({
        name: relative(REPORTS_DIR, filePath).replace(/\\/g, '/').replace(/\.json$/, ''),
        path: filePath,
        reportType: report.reportType,
        command: report.setupCommand || report.command,
        date: report.startTime,
        success: report.success,
        durationMs: report.durationMs,
        storageAdded,
        hasTestRun,
        hasWarmupRun,
        hasMeasuredRun,
      })
    } catch {
      // Skip malformed report files.
    }
  }

  summaries.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

  if (options.json) {
    console.log(JSON.stringify(summaries, null, 2))
    return
  }

  console.log('Existing Reports:\n')
  console.log('| Name | Type | Command | Date | Status | Duration | Storage | Benchmark Data |')
  console.log('|------|------|---------|------|--------|----------|---------|----------------|')

  for (const summary of summaries) {
    const status = summary.success ? 'OK' : 'FAIL'
    let benchmark = 'No'
    if (summary.reportType === 'runtime') {
      benchmark = summary.hasMeasuredRun ? 'Warm+Measured' : summary.hasWarmupRun ? 'Warm only' : 'No'
    } else if (summary.reportType === 'run') {
      benchmark = summary.hasTestRun ? 'Legacy Test' : 'No'
    }

    console.log(
      `| ${summary.name} | ${summary.reportType} | ${summary.command} | ${formatDateShort(summary.date)} | ${status} | ${formatDuration(summary.durationMs)} | ${formatBytes(summary.storageAdded)} | ${benchmark} |`
    )
  }

  console.log('')
  console.log(`Total: ${summaries.length} report(s)`)
  console.log('')
  console.log('To view a report:')
  console.log('  bun .github/report/cli.ts view <name>')
  console.log('')
  console.log('To compare reports:')
  console.log('  bun .github/report/cli.ts compare <name1> <name2>')
}

export async function listCommand(options: ListOptions): Promise<void> {
  if (options.reports) {
    await listExistingReports(options)
  } else {
    await listReportTypes(options)
  }
}
