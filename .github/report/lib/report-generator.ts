/**
 * Report generation functions for Markdown output and comparisons.
 */

import type { AnyReport, LegacyRunReport, RuntimeReport, SetupOnlyReport, TestRunResult } from '../types.ts'
import { formatBytes, formatDuration } from './formatters.ts'
import { isLegacyRunReport, isRuntimeReport, isSetupReport } from './report-type.ts'

function pushEnvironment(lines: string[], report: { environment: { platform: string; arch: string; bunVersion: string; cwd: string } }): void {
  lines.push('## Environment')
  lines.push('')
  lines.push(`- **Platform:** ${report.environment.platform}`)
  lines.push(`- **Architecture:** ${report.environment.arch}`)
  lines.push(`- **Bun Version:** ${report.environment.bunVersion}`)
  lines.push(`- **Working Directory:** ${report.environment.cwd}`)
  lines.push('')
}

function pushTimeline(lines: string[], report: SetupOnlyReport | LegacyRunReport): void {
  if (report.phases.length === 0) {
    return
  }
  lines.push('## Timeline')
  lines.push('')
  lines.push('| Time | Phase | Duration | Status |')
  lines.push('|------|-------|----------|--------|')
  for (const phase of report.phases) {
    const time = new Date(phase.startTime).toLocaleTimeString()
    const duration = phase.durationMs ? formatDuration(phase.durationMs) : '-'
    const status = phase.success ? 'OK' : 'FAIL'
    lines.push(`| ${time} | ${phase.name} | ${duration} | ${status} |`)
  }
  lines.push('')
}

function pushStorageSummary(lines: string[], report: SetupOnlyReport | LegacyRunReport): void {
  lines.push('## Storage Summary')
  lines.push('')
  lines.push(`**Total Storage Added:** ${formatBytes(report.storage.totalBytesAdded)}`)
  if (report.storage.totalBytesModified > 0) {
    lines.push(`**Total Storage Modified:** ${formatBytes(report.storage.totalBytesModified)}`)
  }
  lines.push('')

  const nonZeroDirs = Object.entries(report.storage.byDirectory).filter(([_, size]) => size > 0)
  if (nonZeroDirs.length > 0) {
    lines.push('### By Directory')
    lines.push('')
    lines.push('| Directory | Size Added |')
    lines.push('|-----------|------------|')
    for (const [dir, size] of nonZeroDirs.sort((a, b) => b[1] - a[1])) {
      lines.push(`| ${dir} | ${formatBytes(size)} |`)
    }
    lines.push('')
  }

  if (report.storage.largestFiles.length > 0) {
    lines.push('### Largest Files')
    lines.push('')
    lines.push('| File | Size |')
    lines.push('|------|------|')
    for (const file of report.storage.largestFiles) {
      lines.push(`| ${file.path} | ${formatBytes(file.size)} |`)
    }
    lines.push('')
  }
}

function pushDownloads(lines: string[], report: SetupOnlyReport | LegacyRunReport): void {
  if (report.downloads.length === 0) {
    return
  }

  lines.push('## Downloads & Sources')
  lines.push('')
  lines.push('| Source | Type |')
  lines.push('|--------|------|')
  for (const download of report.downloads) {
    let type = 'download'
    if (download.url.startsWith('pypi://')) {
      type = 'pip install'
    } else if (download.url.startsWith('huggingface://')) {
      type = 'HuggingFace model'
    } else if (download.url.includes('github.com') || download.url.startsWith('git@')) {
      type = 'git clone'
    }
    const displayUrl = download.url.replace(/^(pypi|huggingface):\/\/\//, '')
    lines.push(`| ${displayUrl} | ${type} |`)
  }
  lines.push('')
}

function pushFilesCreated(lines: string[], report: SetupOnlyReport | LegacyRunReport): void {
  const createdFiles = report.fileOperations.filter((file) => file.type === 'created' && file.size > 0)
  if (createdFiles.length === 0) {
    return
  }

  lines.push('## Files Created')
  lines.push('')
  lines.push(`Total: ${createdFiles.length} files`)
  lines.push('')
  lines.push('| File | Size |')
  lines.push('|------|------|')
  for (const file of createdFiles.sort((a, b) => b.size - a.size).slice(0, 20)) {
    lines.push(`| ${file.relativePath} | ${formatBytes(file.size)} |`)
  }
  if (createdFiles.length > 20) {
    lines.push(`| ... and ${createdFiles.length - 20} more files | |`)
  }
  lines.push('')
}

function pushErrors(lines: string[], errors: Array<{ timestamp: string; message: string; context?: string }>): void {
  lines.push('## Errors')
  lines.push('')
  if (errors.length === 0) {
    lines.push('No errors detected.')
    lines.push('')
    return
  }

  for (const error of errors) {
    lines.push(`### ${new Date(error.timestamp).toLocaleTimeString()}`)
    lines.push('')
    lines.push('```')
    lines.push(error.message)
    lines.push('```')
    if (error.context) {
      lines.push('')
      lines.push('<details><summary>Context</summary>')
      lines.push('')
      lines.push('```')
      lines.push(error.context)
      lines.push('```')
      lines.push('')
      lines.push('</details>')
    }
    lines.push('')
  }
}

function pushTestRun(lines: string[], testRun: TestRunResult, title: string): void {
  lines.push(`## ${title}`)
  lines.push('')
  lines.push(`**Command:** \`${testRun.command}\``)
  lines.push(`**Status:** ${testRun.success ? 'Success' : 'Failed'}`)
  if (testRun.model) {
    lines.push(`**Model:** ${testRun.model}`)
  }
  lines.push(`**Generation Time:** ${formatDuration(testRun.durationMs)}`)
  lines.push('')
  lines.push('| Metric | Value |')
  lines.push('|--------|-------|')
  lines.push(`| Input File | ${testRun.inputFile} |`)
  lines.push(`| Input Size | ${formatBytes(testRun.inputSize)} |`)
  lines.push(`| Characters | ${testRun.inputCharacters.toLocaleString()} |`)
  lines.push(`| Words | ${testRun.inputWords.toLocaleString()} |`)
  if (testRun.outputFile) {
    lines.push(`| Output File | ${testRun.outputFile} |`)
  }
  if (testRun.outputSize) {
    lines.push(`| Output Size | ${formatBytes(testRun.outputSize)} |`)
  }
  if (testRun.outputDurationSeconds) {
    lines.push(`| Audio Duration | ${testRun.outputDurationSeconds.toFixed(2)}s |`)
  }
  if (testRun.charactersPerSecond) {
    lines.push(`| Characters/Second | ${testRun.charactersPerSecond.toFixed(1)} |`)
  }
  if (testRun.wordsPerSecond) {
    lines.push(`| Words/Second | ${testRun.wordsPerSecond.toFixed(1)} |`)
  }
  if (testRun.realTimeRatio) {
    const description = testRun.realTimeRatio >= 1 ? 'faster than real-time' : 'slower than real-time'
    lines.push(`| Real-time Ratio | ${testRun.realTimeRatio.toFixed(2)}x (${description}) |`)
  }
  lines.push('')
}

function pushRawOutput(lines: string[], stdout: string, stderr: string): void {
  lines.push('## Raw Output')
  lines.push('')
  lines.push('<details><summary>stdout (click to expand)</summary>')
  lines.push('')
  lines.push('```')
  const stdoutLines = stdout.split('\n')
  if (stdoutLines.length > 200) {
    lines.push(stdoutLines.slice(0, 100).join('\n'))
    lines.push(`\n... (${stdoutLines.length - 200} lines omitted) ...\n`)
    lines.push(stdoutLines.slice(-100).join('\n'))
  } else {
    lines.push(stdout)
  }
  lines.push('```')
  lines.push('')
  lines.push('</details>')
  lines.push('')

  if (stderr.trim()) {
    lines.push('<details><summary>stderr (click to expand)</summary>')
    lines.push('')
    lines.push('```')
    lines.push(stderr)
    lines.push('```')
    lines.push('')
    lines.push('</details>')
    lines.push('')
  }
}

export function generateLegacyRunMarkdownReport(report: LegacyRunReport): string {
  const lines: string[] = []
  lines.push(`# Setup Report: ${report.command}`)
  lines.push('')
  lines.push(`**Date:** ${new Date(report.startTime).toLocaleString()}`)
  lines.push(`**Duration:** ${formatDuration(report.durationMs)}`)
  lines.push(`**Status:** ${report.success ? 'Success' : 'Failed'}`)
  lines.push(`**Exit Code:** ${report.exitCode}`)
  lines.push(`**Fresh Run:** ${report.freshRun ? 'Yes (markers removed)' : 'No'}`)
  lines.push(`**Report Type:** run (legacy combined setup + test)`)
  lines.push('')

  pushEnvironment(lines, report)
  pushTimeline(lines, report)
  pushStorageSummary(lines, report)
  pushDownloads(lines, report)
  pushFilesCreated(lines, report)
  pushErrors(lines, report.errors)

  if (report.testRun) {
    pushTestRun(lines, report.testRun, 'Test Run Results')
  }

  pushRawOutput(lines, report.stdout, report.stderr)
  return lines.join('\n')
}

export function generateSetupMarkdownReport(report: SetupOnlyReport): string {
  const lines: string[] = []
  lines.push(`# Setup Report: ${report.command}`)
  lines.push('')
  lines.push(`**Date:** ${new Date(report.startTime).toLocaleString()}`)
  lines.push(`**Duration:** ${formatDuration(report.durationMs)}`)
  lines.push(`**Status:** ${report.success ? 'Success' : 'Failed'}`)
  lines.push(`**Exit Code:** ${report.exitCode}`)
  lines.push(`**Fresh Run:** ${report.freshRun ? 'Yes (markers removed)' : 'No'}`)
  lines.push(`**Report Type:** setup`)
  if (report.model) {
    lines.push(`**Model:** ${report.model}`)
  }
  lines.push('')

  lines.push('## Model Preparation')
  lines.push('')
  lines.push('| Metric | Value |')
  lines.push('|--------|-------|')
  lines.push(`| Method | ${report.modelPreparation.method} |`)
  lines.push(`| Model | ${report.modelPreparation.model} |`)
  lines.push(`| Duration | ${formatDuration(report.modelPreparation.durationMs)} |`)
  lines.push(`| Status | ${report.modelPreparation.success ? 'Success' : 'Failed'} |`)
  if (report.modelPreparation.details) {
    lines.push(`| Details | ${report.modelPreparation.details} |`)
  }
  if (report.modelPreparation.error) {
    lines.push(`| Error | ${report.modelPreparation.error} |`)
  }
  lines.push(`| Readiness Key | ${report.readinessKey} |`)
  lines.push(`| Readiness Marker | ${report.readinessMarkerPath} |`)
  lines.push('')

  pushEnvironment(lines, report)
  pushTimeline(lines, report)
  pushStorageSummary(lines, report)
  pushDownloads(lines, report)
  pushFilesCreated(lines, report)
  pushErrors(lines, report.errors)
  pushRawOutput(lines, report.stdout, report.stderr)
  return lines.join('\n')
}

export function generateRuntimeMarkdownReport(report: RuntimeReport): string {
  const lines: string[] = []
  lines.push(`# Runtime Report: ${report.command}`)
  lines.push('')
  lines.push(`**Date:** ${new Date(report.startTime).toLocaleString()}`)
  lines.push(`**Duration:** ${formatDuration(report.durationMs)}`)
  lines.push(`**Status:** ${report.success ? 'Success' : 'Failed'}`)
  lines.push(`**Exit Code:** ${report.exitCode}`)
  lines.push(`**Report Type:** runtime`)
  lines.push(`**Benchmark Run:** ${report.benchmarkRun}`)
  lines.push(`**Input File:** ${report.inputFile}`)
  if (report.model) {
    lines.push(`**Model:** ${report.model}`)
  }
  lines.push('')

  pushEnvironment(lines, report)
  pushTestRun(lines, report.warmupRun, 'Warm-up Run')
  if (report.measuredRun) {
    pushTestRun(lines, report.measuredRun, 'Measured Run')
  } else {
    lines.push('## Measured Run')
    lines.push('')
    lines.push('Measured run did not complete.')
    lines.push('')
  }

  if (report.measuredRun) {
    lines.push('## Benchmark Summary')
    lines.push('')
    lines.push('| Metric | Value |')
    lines.push('|--------|-------|')
    lines.push(`| Generation Time | ${formatDuration(report.measuredRun.durationMs)} |`)
    if (report.measuredRun.charactersPerSecond) {
      lines.push(`| Characters/Second | ${report.measuredRun.charactersPerSecond.toFixed(1)} |`)
    }
    if (report.measuredRun.wordsPerSecond) {
      lines.push(`| Words/Second | ${report.measuredRun.wordsPerSecond.toFixed(1)} |`)
    }
    if (report.measuredRun.realTimeRatio) {
      const description = report.measuredRun.realTimeRatio >= 1 ? 'faster than real-time' : 'slower than real-time'
      lines.push(`| Real-time Ratio | ${report.measuredRun.realTimeRatio.toFixed(2)}x (${description}) |`)
    }
    lines.push('')
  }

  pushErrors(lines, report.errors)
  pushRawOutput(lines, report.stdout, report.stderr)
  return lines.join('\n')
}

// Backward-compatible export used by legacy run command.
export function generateMarkdownReport(report: LegacyRunReport): string {
  return generateLegacyRunMarkdownReport(report)
}

function generateSetupComparison(report1: SetupOnlyReport, report2: SetupOnlyReport): string {
  const lines: string[] = []
  lines.push('# Setup Report Comparison')
  lines.push('')
  lines.push(`Comparing: **${report1.command}** vs **${report2.command}**`)
  lines.push('')
  lines.push('| Metric | Report 1 | Report 2 | Difference |')
  lines.push('|--------|----------|----------|------------|')

  const durationDiff = report2.durationMs - report1.durationMs
  const durationSign = durationDiff > 0 ? '+' : ''
  lines.push(`| Setup Duration | ${formatDuration(report1.durationMs)} | ${formatDuration(report2.durationMs)} | ${durationSign}${formatDuration(Math.abs(durationDiff))} |`)

  const prepDiff = report2.modelPreparation.durationMs - report1.modelPreparation.durationMs
  const prepSign = prepDiff > 0 ? '+' : ''
  lines.push(`| Model Prep Duration | ${formatDuration(report1.modelPreparation.durationMs)} | ${formatDuration(report2.modelPreparation.durationMs)} | ${prepSign}${formatDuration(Math.abs(prepDiff))} |`)

  const storageDiff = report2.storage.totalBytesAdded - report1.storage.totalBytesAdded
  const storageSign = storageDiff > 0 ? '+' : '-'
  lines.push(`| Storage Added | ${formatBytes(report1.storage.totalBytesAdded)} | ${formatBytes(report2.storage.totalBytesAdded)} | ${storageSign}${formatBytes(Math.abs(storageDiff))} |`)

  lines.push(`| Downloads | ${report1.downloads.length} | ${report2.downloads.length} | ${report2.downloads.length - report1.downloads.length} |`)
  lines.push(`| Errors | ${report1.errors.length} | ${report2.errors.length} | ${report2.errors.length - report1.errors.length} |`)
  lines.push('')
  return lines.join('\n')
}

function generateRuntimeComparison(report1: RuntimeReport, report2: RuntimeReport): string {
  const lines: string[] = []
  lines.push('# Runtime Report Comparison')
  lines.push('')
  lines.push(`Comparing: **${report1.command}** vs **${report2.command}**`)
  lines.push('')
  lines.push('| Metric | Report 1 | Report 2 | Difference |')
  lines.push('|--------|----------|----------|------------|')

  const warmupDiff = report2.warmupRun.durationMs - report1.warmupRun.durationMs
  const warmupSign = warmupDiff > 0 ? '+' : ''
  lines.push(`| Warm-up Time | ${formatDuration(report1.warmupRun.durationMs)} | ${formatDuration(report2.warmupRun.durationMs)} | ${warmupSign}${formatDuration(Math.abs(warmupDiff))} |`)

  if (report1.measuredRun && report2.measuredRun) {
    const measuredDiff = report2.measuredRun.durationMs - report1.measuredRun.durationMs
    const measuredSign = measuredDiff > 0 ? '+' : ''
    lines.push(`| Measured Time | ${formatDuration(report1.measuredRun.durationMs)} | ${formatDuration(report2.measuredRun.durationMs)} | ${measuredSign}${formatDuration(Math.abs(measuredDiff))} |`)

    if (report1.measuredRun.charactersPerSecond && report2.measuredRun.charactersPerSecond) {
      const cpsDiff = report2.measuredRun.charactersPerSecond - report1.measuredRun.charactersPerSecond
      const cpsSign = cpsDiff > 0 ? '+' : ''
      lines.push(`| Chars/Second | ${report1.measuredRun.charactersPerSecond.toFixed(1)} | ${report2.measuredRun.charactersPerSecond.toFixed(1)} | ${cpsSign}${cpsDiff.toFixed(1)} |`)
    }

    if (report1.measuredRun.realTimeRatio && report2.measuredRun.realTimeRatio) {
      const ratioDiff = report2.measuredRun.realTimeRatio - report1.measuredRun.realTimeRatio
      const ratioSign = ratioDiff > 0 ? '+' : ''
      lines.push(`| Real-time Ratio | ${report1.measuredRun.realTimeRatio.toFixed(2)}x | ${report2.measuredRun.realTimeRatio.toFixed(2)}x | ${ratioSign}${ratioDiff.toFixed(2)}x |`)
    }
  } else {
    lines.push('| Measured Run | Missing in one or both reports | Missing in one or both reports | - |')
  }

  lines.push(`| Errors | ${report1.errors.length} | ${report2.errors.length} | ${report2.errors.length - report1.errors.length} |`)
  lines.push('')
  return lines.join('\n')
}

function generateLegacyComparison(report1: LegacyRunReport, report2: LegacyRunReport): string {
  const lines: string[] = []
  lines.push('# Legacy Run Report Comparison')
  lines.push('')
  lines.push(`Comparing: **${report1.command}** vs **${report2.command}**`)
  lines.push('')
  lines.push('| Metric | Report 1 | Report 2 | Difference |')
  lines.push('|--------|----------|----------|------------|')

  const durationDiff = report2.durationMs - report1.durationMs
  const durationSign = durationDiff > 0 ? '+' : ''
  lines.push(`| Duration | ${formatDuration(report1.durationMs)} | ${formatDuration(report2.durationMs)} | ${durationSign}${formatDuration(Math.abs(durationDiff))} |`)

  const storageDiff = report2.storage.totalBytesAdded - report1.storage.totalBytesAdded
  const storageSign = storageDiff > 0 ? '+' : '-'
  lines.push(`| Storage Added | ${formatBytes(report1.storage.totalBytesAdded)} | ${formatBytes(report2.storage.totalBytesAdded)} | ${storageSign}${formatBytes(Math.abs(storageDiff))} |`)

  lines.push(`| Downloads | ${report1.downloads.length} | ${report2.downloads.length} | ${report2.downloads.length - report1.downloads.length} |`)
  lines.push(`| Phases | ${report1.phases.length} | ${report2.phases.length} | ${report2.phases.length - report1.phases.length} |`)
  lines.push(`| Errors | ${report1.errors.length} | ${report2.errors.length} | ${report2.errors.length - report1.errors.length} |`)
  lines.push('')

  if (report1.testRun && report2.testRun) {
    const testDurationDiff = report2.testRun.durationMs - report1.testRun.durationMs
    const testDurationSign = testDurationDiff > 0 ? '+' : ''
    lines.push('## Test Run Comparison')
    lines.push('')
    lines.push('| Metric | Report 1 | Report 2 | Difference |')
    lines.push('|--------|----------|----------|------------|')
    lines.push(`| Generation Time | ${formatDuration(report1.testRun.durationMs)} | ${formatDuration(report2.testRun.durationMs)} | ${testDurationSign}${formatDuration(Math.abs(testDurationDiff))} |`)
    lines.push('')
  }

  return lines.join('\n')
}

export function generateComparisonReport(report1: AnyReport, report2: AnyReport): string {
  if (report1.reportType !== report2.reportType) {
    return [
      '# Report Comparison',
      '',
      `Cannot compare different report types: \`${report1.reportType}\` vs \`${report2.reportType}\`.`,
      '',
      'Use reports of the same type for accurate comparisons.',
      '',
    ].join('\n')
  }

  if (isRuntimeReport(report1) && isRuntimeReport(report2)) {
    return generateRuntimeComparison(report1, report2)
  }

  if (isSetupReport(report1) && isSetupReport(report2)) {
    return generateSetupComparison(report1, report2)
  }

  if (isLegacyRunReport(report1) && isLegacyRunReport(report2)) {
    return generateLegacyComparison(report1, report2)
  }

  return '# Report Comparison\n\nUnsupported report type.'
}
