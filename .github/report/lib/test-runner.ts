/**
 * Test runner for post-setup verification
 */

import { readdir, stat } from 'node:fs/promises'
import { join } from 'node:path'
import type { TestRunResult } from '../types.ts'
import { TEST_CONFIGS } from '../constants.ts'
import { formatBytes, formatDuration } from './formatters.ts'
import { getFileSize } from './utils.ts'

export async function getAudioDuration(filePath: string): Promise<number | undefined> {
  try {
    const proc = Bun.spawn(['ffprobe', '-v', 'quiet', '-show_entries', 'format=duration', '-of', 'csv=p=0', filePath], {
      stdout: 'pipe',
      stderr: 'pipe',
    })
    const output = await new Response(proc.stdout).text()
    await proc.exited
    const duration = parseFloat(output.trim())
    return isNaN(duration) ? undefined : duration
  } catch {
    return undefined
  }
}

export async function findOutputFile(
  inputFile: string,
  type: 'tts' | 'transcription',
  minMtimeMs?: number
): Promise<string | undefined> {
  const baseName = inputFile.split('/').pop()?.replace(/\.[^.]+$/, '') || ''
  const outputDir = 'output'

  try {
    const entries = await readdir(outputDir, { withFileTypes: true })

    const isFreshEnough = async (path: string): Promise<boolean> => {
      if (!minMtimeMs) return true
      try {
        const fileStat = await stat(path)
        return fileStat.mtimeMs >= minMtimeMs
      } catch {
        return false
      }
    }

    if (type === 'tts') {
      // Look for .wav or .mp3 files matching the input name
      for (const entry of entries) {
        if (!entry.isFile()) continue
        if (!entry.name.startsWith(baseName) || !/\.(wav|mp3)$/.test(entry.name)) continue
        const candidate = join(outputDir, entry.name)
        if (await isFreshEnough(candidate)) {
          return candidate
        }
      }
      // Also check for most recent audio file
      const audioFiles = entries
        .filter((e) => e.isFile() && /\.(wav|mp3)$/.test(e.name))
        .map((e) => join(outputDir, e.name))

      if (audioFiles.length > 0) {
        let mostRecent = audioFiles[0]
        let mostRecentTime = 0
        for (const f of audioFiles) {
          const s = await stat(f)
          if (s.mtimeMs > mostRecentTime && s.mtimeMs >= (minMtimeMs || 0)) {
            mostRecentTime = s.mtimeMs
            mostRecent = f
          }
        }
        if (mostRecentTime > 0) {
          return mostRecent
        }
      }
    } else {
      // Transcription: look for .txt or .md files
      for (const entry of entries) {
        if (!entry.isFile()) continue
        if (!entry.name.startsWith(baseName) || !/\.(txt|md)$/.test(entry.name)) continue
        const candidate = join(outputDir, entry.name)
        if (await isFreshEnough(candidate)) {
          return candidate
        }
      }
    }
  } catch {
    // Output directory might not exist
  }

  return undefined
}

// Map setup commands to their model flags
const MODEL_FLAGS: Record<string, string> = {
  'setup:tts:qwen3': '--qwen3-model',
  'setup:tts:chatterbox': '--chatterbox-model',
  'setup:tts:fish': '--fish-model',
  'setup:tts:cosyvoice': '--cosyvoice-model',
  'setup:transcription': '--whisper',
  'setup:text': '--whisper',
}

export interface RunTestOptions {
  label?: string
}

export async function runTestCommand(
  setupCommand: string,
  customInputFile?: string,
  model?: string,
  options: RunTestOptions = {}
): Promise<TestRunResult | undefined> {
  const config = TEST_CONFIGS[setupCommand]
  if (!config) {
    console.log(`\nNo test configuration for ${setupCommand}, skipping test run.`)
    return undefined
  }
  const label = options.label || 'Test Run'

  // Override input file if custom one provided
  const inputFile = customInputFile || config.inputFile
  let commandArgs = customInputFile
    ? config.commandArgs.map((arg) => (arg === config.inputFile ? customInputFile : arg))
    : [...config.commandArgs]

  // Add model flag if specified
  if (model) {
    const modelFlag = MODEL_FLAGS[setupCommand]
    if (modelFlag) {
      // For transcription, replace the existing model arg (e.g., --whisper base -> --whisper turbo)
      if (setupCommand.includes('transcription') || setupCommand.includes('text')) {
        const whisperIndex = commandArgs.indexOf('--whisper')
        if (whisperIndex !== -1 && whisperIndex + 1 < commandArgs.length) {
          commandArgs[whisperIndex + 1] = model
        } else {
          commandArgs.push(modelFlag, model)
        }
      } else {
        commandArgs.push(modelFlag, model)
      }
    }
  }

  console.log(`\n${'='.repeat(60)}`)
  console.log(`Running ${label}: ${config.type.toUpperCase()}`)
  console.log(`Input: ${inputFile}`)
  if (model) {
    console.log(`Model: ${model}`)
  }
  console.log(`Command: bun as -- ${commandArgs.join(' ')}`)
  console.log(`${'='.repeat(60)}\n`)

  // Read input file to get character/word counts
  let inputContent = ''
  let inputSize = 0
  try {
    const inputFileHandle = Bun.file(inputFile)
    inputContent = await inputFileHandle.text()
    inputSize = inputFileHandle.size
  } catch (err) {
    console.error(`Warning: Could not read input file ${inputFile}:`, err)
  }

  const inputCharacters = inputContent.length
  const inputWords = inputContent.split(/\s+/).filter((w) => w.length > 0).length

  const startTime = new Date()
  const startNanos = Bun.nanoseconds()
  const startedAtMs = startTime.getTime()

  let stdout = ''
  let stderr = ''
  let exitCode = 0
  let error: string | undefined

  try {
    const proc = Bun.spawn(['bun', 'as', '--', ...commandArgs], {
      cwd: process.cwd(),
      stdout: 'pipe',
      stderr: 'pipe',
      env: {
        ...process.env,
        FORCE_COLOR: '1',
      },
    })

    const decoder = new TextDecoder()
    const stdoutReader = proc.stdout.getReader()
    const stderrReader = proc.stderr.getReader()

    const readStdout = async () => {
      while (true) {
        const { done, value } = await stdoutReader.read()
        if (done) break
        const text = decoder.decode(value)
        stdout += text
        process.stdout.write(text)
      }
    }

    const readStderr = async () => {
      while (true) {
        const { done, value } = await stderrReader.read()
        if (done) break
        const text = decoder.decode(value)
        stderr += text
        process.stderr.write(text)
      }
    }

    await Promise.all([readStdout(), readStderr()])
    exitCode = await proc.exited
  } catch (err) {
    console.error('Error running test command:', err)
    exitCode = 1
    error = String(err)
  }

  const endTime = new Date()
  const durationMs = (Bun.nanoseconds() - startNanos) / 1_000_000
  const durationSeconds = durationMs / 1000

  // Find the output file
  const outputFile = exitCode === 0
    ? await findOutputFile(inputFile, config.type, startedAtMs)
    : undefined
  let outputSize: number | undefined
  let outputDurationSeconds: number | undefined

  if (outputFile) {
    outputSize = await getFileSize(outputFile)
    if (config.type === 'tts') {
      outputDurationSeconds = await getAudioDuration(outputFile)
    }
  }

  // Calculate performance metrics
  const charactersPerSecond = exitCode === 0 && durationSeconds > 0 ? inputCharacters / durationSeconds : undefined
  const wordsPerSecond = exitCode === 0 && durationSeconds > 0 ? inputWords / durationSeconds : undefined
  const realTimeRatio = exitCode === 0 && outputDurationSeconds && durationSeconds > 0
    ? outputDurationSeconds / durationSeconds
    : undefined

  const result: TestRunResult = {
    command: `bun as -- ${commandArgs.join(' ')}`,
    inputFile,
    inputSize,
    inputCharacters,
    inputWords,
    model,
    outputFile,
    outputSize,
    outputDurationSeconds,
    startTime: startTime.toISOString(),
    endTime: endTime.toISOString(),
    durationMs,
    success: exitCode === 0,
    exitCode,
    error,
    stdout,
    stderr,
    charactersPerSecond,
    wordsPerSecond,
    realTimeRatio,
  }

  // Print test summary
  console.log(`\n${'='.repeat(60)}`)
  console.log(`${label} Complete`)
  console.log(`${'='.repeat(60)}`)
  console.log(`Status: ${result.success ? 'Success' : 'Failed'}`)
  console.log(`Duration: ${formatDuration(result.durationMs)}`)
  console.log(`Input: ${inputCharacters} chars, ${inputWords} words`)
  if (outputFile) {
    console.log(`Output: ${outputFile} (${formatBytes(outputSize || 0)})`)
  }
  if (outputDurationSeconds) {
    console.log(`Audio Duration: ${outputDurationSeconds.toFixed(2)}s`)
  }
  if (charactersPerSecond) {
    console.log(`Speed: ${charactersPerSecond.toFixed(1)} chars/sec, ${wordsPerSecond?.toFixed(1)} words/sec`)
  }
  if (realTimeRatio) {
    console.log(`Real-time Ratio: ${realTimeRatio.toFixed(2)}x (${realTimeRatio >= 1 ? 'faster' : 'slower'} than real-time)`)
  }
  console.log('')

  return result
}
