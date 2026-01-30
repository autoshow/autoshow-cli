/**
 * List command - lists available report types or existing reports
 */

import { readdir } from 'node:fs/promises'
import { join } from 'node:path'
import type { SetupReport, ReportSummary } from '../types.ts'
import { REPORTS_DIR, AVAILABLE_SETUP_COMMANDS, TEST_CONFIGS } from '../constants.ts'
import { fileExists, getFileMtime } from '../lib/utils.ts'
import { formatBytes, formatDuration, formatDateShort } from '../lib/formatters.ts'

export interface ListOptions {
  reports?: boolean
  json?: boolean
}

async function listReportTypes(options: ListOptions): Promise<void> {
  const types = Object.entries(TEST_CONFIGS).map(([command, config]) => ({
    command,
    type: config.type,
    inputFile: config.inputFile,
    testCommand: `bun as -- ${config.commandArgs.join(' ')}`,
  }))

  if (options.json) {
    console.log(JSON.stringify(types, null, 2))
    return
  }

  console.log('Available Setup Commands:\n')
  console.log('| Command | Type | Default Input |')
  console.log('|---------|------|---------------|')
  for (const t of types) {
    console.log(`| ${t.command} | ${t.type} | ${t.inputFile} |`)
  }
  console.log('')
  console.log('Usage:')
  console.log('  bun .github/report/cli.ts run <command> [--input <file>] [--fresh] [--skip-test]')
  console.log('')
  console.log('Examples:')
  for (const cmd of AVAILABLE_SETUP_COMMANDS.slice(0, 3)) {
    console.log(`  bun .github/report/cli.ts run ${cmd}`)
  }
}

async function listExistingReports(options: ListOptions): Promise<void> {
  if (!(await fileExists(REPORTS_DIR))) {
    if (options.json) {
      console.log(JSON.stringify([], null, 2))
    } else {
      console.log('No reports found. Run a setup command first:')
      console.log('  bun .github/report/cli.ts run setup:tts:fish --input input/sample.md')
    }
    return
  }

  const entries = await readdir(REPORTS_DIR, { withFileTypes: true })
  const jsonFiles = entries.filter((e) => e.isFile() && e.name.endsWith('.json'))

  if (jsonFiles.length === 0) {
    if (options.json) {
      console.log(JSON.stringify([], null, 2))
    } else {
      console.log('No reports found. Run a setup command first:')
      console.log('  bun .github/report/cli.ts run setup:tts:fish --input input/sample.md')
    }
    return
  }

  const summaries: ReportSummary[] = []

  for (const file of jsonFiles) {
    const filePath = join(REPORTS_DIR, file.name)
    try {
      const content = await Bun.file(filePath).json() as SetupReport
      const mtime = await getFileMtime(filePath)

      summaries.push({
        name: file.name.replace('.json', ''),
        path: filePath,
        command: content.setupCommand || content.command,
        date: content.startTime,
        success: content.success,
        durationMs: content.durationMs,
        storageAdded: content.storage?.totalBytesAdded || 0,
        hasTestRun: !!content.testRun,
      })
    } catch {
      // Skip invalid JSON files
    }
  }

  // Sort by date descending
  summaries.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

  if (options.json) {
    console.log(JSON.stringify(summaries, null, 2))
    return
  }

  console.log('Existing Reports:\n')
  console.log('| Name | Command | Date | Status | Duration | Storage | Test |')
  console.log('|------|---------|------|--------|----------|---------|------|')

  for (const summary of summaries) {
    const status = summary.success ? 'OK' : 'FAIL'
    const test = summary.hasTestRun ? 'Yes' : 'No'
    console.log(
      `| ${summary.name} | ${summary.command} | ${formatDateShort(summary.date)} | ${status} | ${formatDuration(summary.durationMs)} | ${formatBytes(summary.storageAdded)} | ${test} |`
    )
  }

  console.log('')
  console.log(`Total: ${summaries.length} report(s)`)
  console.log('')
  console.log('To view a report:')
  console.log(`  bun .github/report/cli.ts view <name>`)
  console.log('')
  console.log('To compare reports:')
  console.log(`  bun .github/report/cli.ts compare <name1> <name2>`)
}

export async function listCommand(options: ListOptions): Promise<void> {
  if (options.reports) {
    await listExistingReports(options)
  } else {
    await listReportTypes(options)
  }
}
