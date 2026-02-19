/**
 * Shared setup command execution and filesystem/output tracking.
 */

import { join } from 'node:path'
import type { SetupExecutionReport } from '../types.ts'
import { BUILD_DIR, WATCH_DIRS } from '../constants.ts'
import { FileSystemTracker } from './filesystem-tracker.ts'
import { removeMarkers } from './marker-manager.ts'
import { OutputParser } from './output-parser.ts'
import { ensureDir } from './utils.ts'

const MODEL_ENV_MAP: Record<string, string> = {
  'setup:tts:cosyvoice': 'COSYVOICE_MODEL',
  'setup:tts:fish': 'FISHAUDIO_MODEL',
  'setup:tts:chatterbox': 'CHATTERBOX_MODEL',
  'setup:tts:qwen3': 'QWEN3_MODEL',
}

export interface SetupExecutionOptions {
  fresh?: boolean
  model?: string
  bannerLabel?: string
}

export async function executeSetupCommand(setupCommand: string, options: SetupExecutionOptions = {}): Promise<SetupExecutionReport> {
  const { fresh = false, model, bannerLabel = 'Setup Report' } = options
  const startTime = new Date()
  const startNanos = Bun.nanoseconds()

  console.log(`\n${'='.repeat(60)}`)
  console.log(`${bannerLabel}: ${setupCommand}`)
  console.log(`Started: ${startTime.toISOString()}`)
  console.log(`Fresh run: ${fresh}`)
  console.log(`${'='.repeat(60)}\n`)

  if (fresh) {
    const removed = await removeMarkers(setupCommand)
    if (removed.length > 0) {
      console.log(`Removed ${removed.length} marker file(s) for fresh run:`)
      for (const marker of removed) {
        console.log(`  - ${marker}`)
      }
      console.log('')
    }
  }

  const cwd = process.cwd()
  const tracker = new FileSystemTracker(cwd)
  const parser = new OutputParser()

  await ensureDir(BUILD_DIR)
  for (const dir of WATCH_DIRS) {
    await ensureDir(join(cwd, dir))
  }

  await tracker.snapshotInitialState()
  await tracker.startWatching()

  let stdout = ''
  let stderr = ''
  let exitCode = 0

  try {
    const setupEnv: Record<string, string> = {
      ...process.env,
      FORCE_COLOR: '1',
    }

    if (model) {
      const modelEnvVar = MODEL_ENV_MAP[setupCommand]
      if (modelEnvVar) {
        setupEnv[modelEnvVar] = model
      }
    }

    const proc = Bun.spawn(['bun', 'run', setupCommand], {
      cwd,
      stdout: 'pipe',
      stderr: 'pipe',
      env: setupEnv,
    })

    const stdoutReader = proc.stdout.getReader()
    const stderrReader = proc.stderr.getReader()
    const decoder = new TextDecoder()

    const readStdout = async () => {
      let buffer = ''
      while (true) {
        const { done, value } = await stdoutReader.read()
        if (done) break

        const text = decoder.decode(value)
        stdout += text
        buffer += text

        const lines = buffer.split('\n')
        buffer = lines.pop() || ''
        for (const line of lines) {
          process.stdout.write(line + '\n')
          parser.parseLine(line)
        }
      }

      if (buffer) {
        process.stdout.write(buffer + '\n')
        parser.parseLine(buffer)
      }
    }

    const readStderr = async () => {
      let buffer = ''
      while (true) {
        const { done, value } = await stderrReader.read()
        if (done) break

        const text = decoder.decode(value)
        stderr += text
        buffer += text

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
  } catch (error) {
    console.error('Error running setup command:', error)
    exitCode = 1
    stderr += `\nRunner error: ${error}\n`
  }

  tracker.stopWatching()
  parser.finalize()

  await new Promise((resolve) => setTimeout(resolve, 500))

  const storage = await tracker.calculateStorageMetrics()
  const endTime = new Date()
  const durationMs = (Bun.nanoseconds() - startNanos) / 1_000_000

  return {
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
}
