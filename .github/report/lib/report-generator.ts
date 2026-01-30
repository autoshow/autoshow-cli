/**
 * Report generation functions for JSON and Markdown output
 */

import type { SetupReport } from '../types.ts'
import { formatBytes, formatDuration } from './formatters.ts'

export function generateMarkdownReport(report: SetupReport): string {
  const lines: string[] = []

  // Header
  lines.push(`# Setup Report: ${report.command}`)
  lines.push('')
  lines.push(`**Date:** ${new Date(report.startTime).toLocaleString()}`)
  lines.push(`**Duration:** ${formatDuration(report.durationMs)}`)
  lines.push(`**Status:** ${report.success ? 'Success' : 'Failed'}`)
  lines.push(`**Exit Code:** ${report.exitCode}`)
  lines.push(`**Fresh Run:** ${report.freshRun ? 'Yes (markers removed)' : 'No'}`)
  lines.push('')

  // Environment
  lines.push('## Environment')
  lines.push('')
  lines.push(`- **Platform:** ${report.environment.platform}`)
  lines.push(`- **Architecture:** ${report.environment.arch}`)
  lines.push(`- **Bun Version:** ${report.environment.bunVersion}`)
  lines.push(`- **Working Directory:** ${report.environment.cwd}`)
  lines.push('')

  // Timeline
  if (report.phases.length > 0) {
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

  // Storage Summary
  lines.push('## Storage Summary')
  lines.push('')
  lines.push(`**Total Storage Added:** ${formatBytes(report.storage.totalBytesAdded)}`)
  if (report.storage.totalBytesModified > 0) {
    lines.push(`**Total Storage Modified:** ${formatBytes(report.storage.totalBytesModified)}`)
  }
  lines.push('')

  // By directory breakdown
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

  // Largest files
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

  // Downloads
  if (report.downloads.length > 0) {
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

  // File Operations
  const createdFiles = report.fileOperations.filter((f) => f.type === 'created' && f.size > 0)
  if (createdFiles.length > 0) {
    lines.push('## Files Created')
    lines.push('')
    lines.push(`Total: ${createdFiles.length} files`)
    lines.push('')

    // Show top 20 largest created files
    const topFiles = createdFiles.sort((a, b) => b.size - a.size).slice(0, 20)
    lines.push('| File | Size |')
    lines.push('|------|------|')
    for (const file of topFiles) {
      lines.push(`| ${file.relativePath} | ${formatBytes(file.size)} |`)
    }
    if (createdFiles.length > 20) {
      lines.push(`| ... and ${createdFiles.length - 20} more files | |`)
    }
    lines.push('')
  }

  // Errors
  if (report.errors.length > 0) {
    lines.push('## Errors')
    lines.push('')
    for (const error of report.errors) {
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
  } else {
    lines.push('## Errors')
    lines.push('')
    lines.push('No errors detected.')
    lines.push('')
  }

  // Test Run Results
  if (report.testRun) {
    const test = report.testRun
    lines.push('## Test Run Results')
    lines.push('')
    lines.push(`**Command:** \`${test.command}\``)
    lines.push(`**Status:** ${test.success ? 'Success' : 'Failed'}`)
    lines.push(`**Generation Time:** ${formatDuration(test.durationMs)}`)
    lines.push('')

    lines.push('### Input')
    lines.push('')
    lines.push(`| Metric | Value |`)
    lines.push(`|--------|-------|`)
    lines.push(`| File | ${test.inputFile} |`)
    lines.push(`| Size | ${formatBytes(test.inputSize)} |`)
    lines.push(`| Characters | ${test.inputCharacters.toLocaleString()} |`)
    lines.push(`| Words | ${test.inputWords.toLocaleString()} |`)
    lines.push('')

    if (test.outputFile) {
      lines.push('### Output')
      lines.push('')
      lines.push(`| Metric | Value |`)
      lines.push(`|--------|-------|`)
      lines.push(`| File | ${test.outputFile} |`)
      if (test.outputSize) {
        lines.push(`| Size | ${formatBytes(test.outputSize)} |`)
      }
      if (test.outputDurationSeconds) {
        lines.push(`| Audio Duration | ${test.outputDurationSeconds.toFixed(2)}s |`)
      }
      lines.push('')
    }

    lines.push('### Performance Metrics')
    lines.push('')
    lines.push(`| Metric | Value |`)
    lines.push(`|--------|-------|`)
    lines.push(`| Generation Time | ${formatDuration(test.durationMs)} |`)
    if (test.charactersPerSecond) {
      lines.push(`| Characters/Second | ${test.charactersPerSecond.toFixed(1)} |`)
    }
    if (test.wordsPerSecond) {
      lines.push(`| Words/Second | ${test.wordsPerSecond.toFixed(1)} |`)
    }
    if (test.realTimeRatio) {
      const rtDescription = test.realTimeRatio >= 1 ? 'faster than real-time' : 'slower than real-time'
      lines.push(`| Real-time Ratio | ${test.realTimeRatio.toFixed(2)}x (${rtDescription}) |`)
    }
    lines.push('')

    if (test.error) {
      lines.push('### Test Error')
      lines.push('')
      lines.push('```')
      lines.push(test.error)
      lines.push('```')
      lines.push('')
    }

    // Test stdout/stderr (truncated)
    lines.push('<details><summary>Test stdout (click to expand)</summary>')
    lines.push('')
    lines.push('```')
    const testStdoutLines = test.stdout.split('\n')
    if (testStdoutLines.length > 100) {
      lines.push(testStdoutLines.slice(0, 50).join('\n'))
      lines.push(`\n... (${testStdoutLines.length - 100} lines omitted) ...\n`)
      lines.push(testStdoutLines.slice(-50).join('\n'))
    } else {
      lines.push(test.stdout)
    }
    lines.push('```')
    lines.push('')
    lines.push('</details>')
    lines.push('')

    if (test.stderr.trim()) {
      lines.push('<details><summary>Test stderr (click to expand)</summary>')
      lines.push('')
      lines.push('```')
      lines.push(test.stderr)
      lines.push('```')
      lines.push('')
      lines.push('</details>')
      lines.push('')
    }
  }

  // Raw Output (truncated)
  lines.push('## Raw Output')
  lines.push('')
  lines.push('<details><summary>stdout (click to expand)</summary>')
  lines.push('')
  lines.push('```')
  const stdoutLines = report.stdout.split('\n')
  if (stdoutLines.length > 200) {
    lines.push(stdoutLines.slice(0, 100).join('\n'))
    lines.push(`\n... (${stdoutLines.length - 200} lines omitted) ...\n`)
    lines.push(stdoutLines.slice(-100).join('\n'))
  } else {
    lines.push(report.stdout)
  }
  lines.push('```')
  lines.push('')
  lines.push('</details>')
  lines.push('')

  if (report.stderr.trim()) {
    lines.push('<details><summary>stderr (click to expand)</summary>')
    lines.push('')
    lines.push('```')
    lines.push(report.stderr)
    lines.push('```')
    lines.push('')
    lines.push('</details>')
    lines.push('')
  }

  return lines.join('\n')
}

export function generateComparisonReport(report1: SetupReport, report2: SetupReport): string {
  const lines: string[] = []

  lines.push(`# Report Comparison`)
  lines.push('')
  lines.push(`Comparing: **${report1.command}** vs **${report2.command}**`)
  lines.push('')

  // Overview table
  lines.push('## Overview')
  lines.push('')
  lines.push('| Metric | Report 1 | Report 2 | Difference |')
  lines.push('|--------|----------|----------|------------|')

  // Duration
  const durationDiff = report2.durationMs - report1.durationMs
  const durationSign = durationDiff > 0 ? '+' : ''
  lines.push(`| Duration | ${formatDuration(report1.durationMs)} | ${formatDuration(report2.durationMs)} | ${durationSign}${formatDuration(Math.abs(durationDiff))} |`)

  // Storage
  const storageDiff = report2.storage.totalBytesAdded - report1.storage.totalBytesAdded
  const storageSign = storageDiff > 0 ? '+' : '-'
  lines.push(`| Storage Added | ${formatBytes(report1.storage.totalBytesAdded)} | ${formatBytes(report2.storage.totalBytesAdded)} | ${storageSign}${formatBytes(Math.abs(storageDiff))} |`)

  // Downloads
  lines.push(`| Downloads | ${report1.downloads.length} | ${report2.downloads.length} | ${report2.downloads.length - report1.downloads.length} |`)

  // Phases
  lines.push(`| Phases | ${report1.phases.length} | ${report2.phases.length} | ${report2.phases.length - report1.phases.length} |`)

  // Errors
  lines.push(`| Errors | ${report1.errors.length} | ${report2.errors.length} | ${report2.errors.length - report1.errors.length} |`)

  lines.push('')

  // Test run comparison if both have tests
  if (report1.testRun && report2.testRun) {
    lines.push('## Test Run Comparison')
    lines.push('')
    lines.push('| Metric | Report 1 | Report 2 | Difference |')
    lines.push('|--------|----------|----------|------------|')

    const testDurationDiff = report2.testRun.durationMs - report1.testRun.durationMs
    const testDurationSign = testDurationDiff > 0 ? '+' : ''
    lines.push(`| Generation Time | ${formatDuration(report1.testRun.durationMs)} | ${formatDuration(report2.testRun.durationMs)} | ${testDurationSign}${formatDuration(Math.abs(testDurationDiff))} |`)

    if (report1.testRun.charactersPerSecond && report2.testRun.charactersPerSecond) {
      const cpsDiff = report2.testRun.charactersPerSecond - report1.testRun.charactersPerSecond
      const cpsSign = cpsDiff > 0 ? '+' : ''
      lines.push(`| Chars/Second | ${report1.testRun.charactersPerSecond.toFixed(1)} | ${report2.testRun.charactersPerSecond.toFixed(1)} | ${cpsSign}${cpsDiff.toFixed(1)} |`)
    }

    if (report1.testRun.realTimeRatio && report2.testRun.realTimeRatio) {
      const rtrDiff = report2.testRun.realTimeRatio - report1.testRun.realTimeRatio
      const rtrSign = rtrDiff > 0 ? '+' : ''
      lines.push(`| Real-time Ratio | ${report1.testRun.realTimeRatio.toFixed(2)}x | ${report2.testRun.realTimeRatio.toFixed(2)}x | ${rtrSign}${rtrDiff.toFixed(2)}x |`)
    }

    lines.push('')
  }

  return lines.join('\n')
}
