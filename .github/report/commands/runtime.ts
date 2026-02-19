/**
 * Runtime report command - measures warm-up and measured TTS generation only.
 */

import { TTS_SETUP_COMMANDS } from '../constants.ts'
import { REPORT_SCHEMA_VERSION } from '../types.ts'
import type { ErrorInfo, RuntimeReport, TestRunResult } from '../types.ts'
import { formatDuration } from '../lib/formatters.ts'
import { isFishRuntimeReady } from '../lib/model-preparation.ts'
import { saveReportArtifacts } from '../lib/report-files.ts'
import { generateRuntimeMarkdownReport } from '../lib/report-generator.ts'
import { readReadinessMarker } from '../lib/readiness-marker.ts'
import { runTestCommand } from '../lib/test-runner.ts'

export interface RuntimeCommandOptions {
  input?: string
  model?: string
}

function isTtsSetupCommand(command: string): boolean {
  return (TTS_SETUP_COMMANDS as readonly string[]).includes(command)
}

function buildError(message: string, context?: string): ErrorInfo {
  return {
    timestamp: new Date().toISOString(),
    message,
    context,
  }
}

export async function runtimeCommand(setupCommand: string, options: RuntimeCommandOptions): Promise<void> {
  if (!isTtsSetupCommand(setupCommand)) {
    console.error(`Error: runtime report is currently limited to TTS setup commands.`)
    console.error('Supported commands:')
    for (const cmd of TTS_SETUP_COMMANDS) {
      console.error(`  ${cmd}`)
    }
    process.exit(1)
  }

  const readiness = await readReadinessMarker(setupCommand, options.model)
  if (!readiness) {
    console.error(`Runtime precondition failed: readiness marker not found for ${setupCommand}${options.model ? ` model=${options.model}` : ''}.`)
    console.error(`Run setup timing first:`)
    console.error(`  bun .github/report/cli.ts setup ${setupCommand}${options.model ? ` --model ${options.model}` : ''}`)
    process.exit(1)
  }

  if (setupCommand === 'setup:tts:fish') {
    const fishReady = await isFishRuntimeReady(options.model)
    if (!fishReady.ready) {
      console.error(`Runtime precondition failed for FishAudio: ${fishReady.error || 'FishAudio runtime is not ready.'}`)
      console.error('Run setup timing (or start Docker) before runtime timing:')
      console.error(`  bun .github/report/cli.ts setup ${setupCommand}${options.model ? ` --model ${options.model}` : ''}`)
      process.exit(1)
    }
  }

  const startTime = new Date()
  const startNanos = Bun.nanoseconds()
  const errors: ErrorInfo[] = []

  console.log(`\n${'='.repeat(60)}`)
  console.log(`Runtime Timing Report: ${setupCommand}`)
  console.log(`Started: ${startTime.toISOString()}`)
  if (options.model) {
    console.log(`Model: ${options.model}`)
  }
  console.log(`${'='.repeat(60)}\n`)

  const warmupRun = await runTestCommand(setupCommand, options.input, options.model, { label: 'Warm-up Run' })
  if (!warmupRun) {
    errors.push(buildError('Warm-up run could not be executed due to missing test configuration.'))
  } else if (!warmupRun.success) {
    errors.push(buildError('Warm-up run failed.', warmupRun.error || warmupRun.stderr || warmupRun.stdout))
  }

  let measuredRun: TestRunResult | undefined = undefined
  if (warmupRun?.success) {
    measuredRun = await runTestCommand(setupCommand, options.input, options.model, { label: 'Measured Run' })
    if (!measuredRun) {
      errors.push(buildError('Measured run could not be executed due to missing test configuration.'))
    } else if (!measuredRun.success) {
      errors.push(buildError('Measured run failed.', measuredRun.error || measuredRun.stderr || measuredRun.stdout))
    }
  }

  const endTime = new Date()
  const durationMs = (Bun.nanoseconds() - startNanos) / 1_000_000
  const runtimeSuccess = Boolean(warmupRun?.success && measuredRun?.success)
  const runtimeExitCode = measuredRun?.exitCode || warmupRun?.exitCode || (runtimeSuccess ? 0 : 1)

  const report: RuntimeReport = {
    schemaVersion: REPORT_SCHEMA_VERSION,
    reportType: 'runtime',
    command: setupCommand.replace('setup:', ''),
    setupCommand,
    startTime: startTime.toISOString(),
    endTime: endTime.toISOString(),
    durationMs,
    success: runtimeSuccess,
    exitCode: runtimeExitCode,
    model: options.model,
    inputFile: options.input || warmupRun?.inputFile || 'unknown',
    benchmarkRun: 'measured',
    warmupRun: warmupRun || {
      command: `bun as -- (missing test config for ${setupCommand})`,
      inputFile: options.input || 'unknown',
      inputSize: 0,
      inputCharacters: 0,
      inputWords: 0,
      model: options.model,
      startTime: startTime.toISOString(),
      endTime: endTime.toISOString(),
      durationMs: 0,
      success: false,
      exitCode: 1,
      error: 'Missing test configuration',
      stdout: '',
      stderr: '',
    },
    measuredRun,
    errors,
    environment: {
      platform: process.platform,
      arch: process.arch,
      bunVersion: Bun.version,
      cwd: process.cwd(),
    },
    stdout: [warmupRun?.stdout, measuredRun?.stdout].filter(Boolean).join('\n\n'),
    stderr: [warmupRun?.stderr, measuredRun?.stderr].filter(Boolean).join('\n\n'),
  }

  const saved = await saveReportArtifacts({
    reportType: 'runtime',
    status: report.success ? 'success' : 'failed',
    command: report.command,
    model: options.model,
    input: options.input,
    jsonContent: JSON.stringify(report, null, 2),
    markdownContent: generateRuntimeMarkdownReport(report),
  })

  console.log(`\n${'='.repeat(60)}`)
  console.log('Runtime Timing Report Complete')
  console.log(`${'='.repeat(60)}`)
  console.log(`Status: ${report.success ? 'Success' : 'Failed'}`)
  console.log(`Total Runtime Flow: ${formatDuration(report.durationMs)}`)
  console.log(`Warm-up Time: ${formatDuration(report.warmupRun.durationMs)}`)
  if (report.measuredRun) {
    console.log(`Measured Time: ${formatDuration(report.measuredRun.durationMs)}`)
    if (report.measuredRun.charactersPerSecond) {
      console.log(`Measured Speed: ${report.measuredRun.charactersPerSecond.toFixed(1)} chars/sec`)
    }
    if (report.measuredRun.realTimeRatio) {
      console.log(`Measured Real-time Ratio: ${report.measuredRun.realTimeRatio.toFixed(2)}x`)
    }
  }

  if (report.errors.length > 0) {
    console.log(`Errors: ${report.errors.length}`)
    for (const error of report.errors) {
      console.log(`  - ${error.message}`)
    }
  }

  console.log(`\nReports saved:`)
  console.log(`  JSON: ${saved.jsonPath}`)
  console.log(`  Markdown: ${saved.mdPath}`)
  console.log('')

  process.exit(report.success ? 0 : report.exitCode)
}
