/**
 * Run command - executes setup and generates report
 */

import { join } from 'node:path'
import type { SetupReport } from '../types.ts'
import { BUILD_DIR, REPORTS_DIR, WATCH_DIRS, AVAILABLE_SETUP_COMMANDS } from '../constants.ts'
import { FileSystemTracker } from '../lib/filesystem-tracker.ts'
import { OutputParser } from '../lib/output-parser.ts'
import { runTestCommand } from '../lib/test-runner.ts'
import { generateMarkdownReport } from '../lib/report-generator.ts'
import { removeMarkers } from '../lib/marker-manager.ts'
import { ensureDir } from '../lib/utils.ts'
import { formatBytes, formatDuration, sanitizeForFilename } from '../lib/formatters.ts'

export interface RunOptions {
  fresh?: boolean
  skipTest?: boolean
  input?: string
  model?: string
}

export async function runSetupWithReport(
  setupCommand: string,
  options: RunOptions
): Promise<SetupReport> {
  const { fresh = false, skipTest = false, input: customInputFile } = options
  const runTest = !skipTest

  const startTime = new Date()
  const startNanos = Bun.nanoseconds()

  console.log(`\n${'='.repeat(60)}`)
  console.log(`Setup Report: ${setupCommand}`)
  console.log(`Started: ${startTime.toISOString()}`)
  console.log(`Fresh run: ${fresh}`)
  console.log(`${'='.repeat(60)}\n`)

  // Handle fresh run - remove markers
  if (fresh) {
    const removed = await removeMarkers(setupCommand)
    if (removed.length > 0) {
      console.log(`Removed ${removed.length} marker file(s) for fresh run:`)
      for (const m of removed) {
        console.log(`  - ${m}`)
      }
      console.log('')
    }
  }

  // Initialize tracking
  const cwd = process.cwd()
  const tracker = new FileSystemTracker(cwd)
  const parser = new OutputParser()

  // Ensure directories exist
  await ensureDir(REPORTS_DIR)
  await ensureDir(BUILD_DIR)
  for (const dir of WATCH_DIRS) {
    await ensureDir(join(cwd, dir))
  }

  // Snapshot initial state and start watching
  await tracker.snapshotInitialState()
  await tracker.startWatching()

  // Run the setup command
  let stdout = ''
  let stderr = ''
  let exitCode = 0

  try {
    // Build environment with model-specific variables
    const setupEnv: Record<string, string> = {
      ...process.env,
      FORCE_COLOR: '1',
    }

    // Map model option to environment variable for setup scripts
    if (options.model) {
      const modelEnvMap: Record<string, string> = {
        'setup:tts:cosyvoice': 'COSYVOICE_MODEL',
        'setup:tts:fish': 'FISHAUDIO_MODEL',
        'setup:tts:chatterbox': 'CHATTERBOX_MODEL',
        'setup:tts:qwen3': 'QWEN3_MODEL',
      }
      const envVar = modelEnvMap[setupCommand]
      if (envVar) {
        setupEnv[envVar] = options.model
      }
    }

    const proc = Bun.spawn(['bun', 'run', setupCommand], {
      cwd,
      stdout: 'pipe',
      stderr: 'pipe',
      env: setupEnv,
    })

    // Stream stdout
    const stdoutReader = proc.stdout.getReader()
    const stderrReader = proc.stderr.getReader()
    const decoder = new TextDecoder()

    // Read stdout
    const readStdout = async () => {
      let buffer = ''
      while (true) {
        const { done, value } = await stdoutReader.read()
        if (done) break
        const text = decoder.decode(value)
        stdout += text
        buffer += text

        // Process complete lines
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''
        for (const line of lines) {
          process.stdout.write(line + '\n')
          parser.parseLine(line)
        }
      }
      // Process remaining buffer
      if (buffer) {
        process.stdout.write(buffer + '\n')
        parser.parseLine(buffer)
      }
    }

    // Read stderr
    const readStderr = async () => {
      let buffer = ''
      while (true) {
        const { done, value } = await stderrReader.read()
        if (done) break
        const text = decoder.decode(value)
        stderr += text
        buffer += text

        // Process complete lines
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''
        for (const line of lines) {
          process.stderr.write(line + '\n')
          parser.parseLine(line, true)
        }
      }
      if (buffer) {
        process.stderr.write(buffer + '\n')
        parser.parseLine(buffer, true)
      }
    }

    await Promise.all([readStdout(), readStderr()])
    exitCode = await proc.exited
  } catch (err) {
    console.error('Error running setup command:', err)
    exitCode = 1
    stderr += `\nRunner error: ${err}\n`
  }

  // Stop watching and finalize
  tracker.stopWatching()
  parser.finalize()

  // Give filesystem a moment to settle
  await new Promise((resolve) => setTimeout(resolve, 500))

  // Calculate metrics
  const storage = await tracker.calculateStorageMetrics()
  const endTime = new Date()
  const durationMs = (Bun.nanoseconds() - startNanos) / 1_000_000

  // Build report
  const report: SetupReport = {
    command: setupCommand.replace('setup:', ''),
    setupCommand,
    startTime: startTime.toISOString(),
    endTime: endTime.toISOString(),
    durationMs,
    success: exitCode === 0,
    exitCode,
    freshRun: fresh,

    phases: parser.getPhases(),
    fileOperations: tracker.getOperations(),
    downloads: parser.getDownloads(),
    errors: parser.getErrors(),
    storage,

    environment: {
      platform: process.platform,
      arch: process.arch,
      bunVersion: Bun.version,
      cwd,
    },

    stdout,
    stderr,
  }

  // Run post-setup test if enabled and setup succeeded
  if (runTest && exitCode === 0) {
    report.testRun = await runTestCommand(setupCommand, customInputFile, options.model)
  } else if (runTest && exitCode !== 0) {
    console.log('\nSkipping test run because setup failed.')
  }

  return report
}

export async function runCommand(setupCommand: string, options: RunOptions): Promise<void> {
  // Validate setup command
  if (!AVAILABLE_SETUP_COMMANDS.includes(setupCommand) && !setupCommand.startsWith('setup:')) {
    console.error(`Error: Unknown setup command '${setupCommand}'`)
    console.error(`\nAvailable setup commands:`)
    for (const cmd of AVAILABLE_SETUP_COMMANDS) {
      console.error(`  ${cmd}`)
    }
    process.exit(1)
  }

  const report = await runSetupWithReport(setupCommand, options)

  // Generate filenames
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
  const commandSlug = sanitizeForFilename(report.command)
  const modelSlug = options.model ? `-${sanitizeForFilename(options.model)}` : ''
  const inputSlug = options.input
    ? `-${sanitizeForFilename(options.input.split('/').pop()?.replace(/\.[^.]+$/, '') || 'custom')}`
    : ''
  // Consider both setup success and test run success when categorizing the report
  const overallSuccess = report.success && (!report.testRun || report.testRun.success)
  const statusDir = overallSuccess ? 'success' : 'failed'
  const outputDir = join(REPORTS_DIR, statusDir)
  await ensureDir(outputDir)
  const jsonPath = join(outputDir, `${timestamp}-${commandSlug}${modelSlug}${inputSlug}.json`)
  const mdPath = join(outputDir, `${timestamp}-${commandSlug}${modelSlug}${inputSlug}.md`)

  // Write reports (exclude fileOperations from JSON to avoid bloat)
  const { fileOperations: _, ...jsonReport } = report
  await Bun.write(jsonPath, JSON.stringify(jsonReport, null, 2))
  await Bun.write(mdPath, generateMarkdownReport(report))

  // Print summary
  console.log(`\n${'='.repeat(60)}`)
  console.log('Setup Report Complete')
  console.log(`${'='.repeat(60)}`)
  console.log(`Status: ${overallSuccess ? 'Success' : 'Failed'}${!report.success ? ' (Setup Failed)' : report.testRun && !report.testRun.success ? ' (Test Failed)' : ''}`)
  console.log(`Duration: ${formatDuration(report.durationMs)}`)
  console.log(`Storage Added: ${formatBytes(report.storage.totalBytesAdded)}`)
  console.log(`Files Created: ${report.fileOperations.filter((f) => f.type === 'created').length}`)
  console.log(`Phases Detected: ${report.phases.length}`)
  console.log(`Downloads Detected: ${report.downloads.length}`)
  console.log(`Errors: ${report.errors.length}`)

  if (report.testRun) {
    console.log('')
    console.log('Test Run:')
    console.log(`  Status: ${report.testRun.success ? 'Success' : 'Failed'}`)
    if (report.testRun.model) {
      console.log(`  Model: ${report.testRun.model}`)
    }
    console.log(`  Generation Time: ${formatDuration(report.testRun.durationMs)}`)
    console.log(`  Input: ${report.testRun.inputCharacters} chars, ${report.testRun.inputWords} words`)
    if (report.testRun.outputDurationSeconds) {
      console.log(`  Audio Duration: ${report.testRun.outputDurationSeconds.toFixed(2)}s`)
    }
    if (report.testRun.charactersPerSecond) {
      console.log(`  Speed: ${report.testRun.charactersPerSecond.toFixed(1)} chars/sec`)
    }
    if (report.testRun.realTimeRatio) {
      console.log(`  Real-time Ratio: ${report.testRun.realTimeRatio.toFixed(2)}x`)
    }
  }

  console.log(`\nReports saved:`)
  console.log(`  JSON: ${jsonPath}`)
  console.log(`  Markdown: ${mdPath}`)
  console.log('')

  // Exit with non-zero code if either setup or test failed
  const exitCode = overallSuccess ? 0 : (report.exitCode || 1)
  process.exit(exitCode)
}
