#!/usr/bin/env bun
/**
 * Setup Report Generator
 *
 * A wrapper script that runs setup commands and generates detailed reports about:
 * - What files were created/modified/deleted
 * - Where files came from (downloads, git clones, pip installs)
 * - How long each phase took
 * - Any errors that occurred
 * - Total storage used
 *
 * Usage:
 *   bun .github/setup/setup-report.ts <setup-command> [--fresh]
 *
 * Examples:
 *   bun .github/setup/setup-report.ts setup:reverb
 *   bun .github/setup/setup-report.ts setup:tts:qwen3 --fresh
 *
 * The --fresh flag removes marker files before running to force a complete setup.
 */

import { watch, type FSWatcher } from 'node:fs'
import { readdir, stat, rm, mkdir } from 'node:fs/promises'
import { join, relative, dirname } from 'node:path'

// ============================================================================
// Types
// ============================================================================

interface FileOperation {
  type: 'created' | 'modified' | 'deleted'
  path: string
  relativePath: string
  timestamp: string
  size: number
  source?: string
}

interface Phase {
  name: string
  startTime: string
  endTime?: string
  durationMs?: number
  success: boolean
  details?: string
}

interface Download {
  url: string
  destination?: string
  size?: number
  durationMs?: number
  success: boolean
  error?: string
}

interface ErrorInfo {
  timestamp: string
  message: string
  context?: string
  line?: string
}

interface StorageMetrics {
  totalBytesAdded: number
  totalBytesModified: number
  largestFiles: Array<{ path: string; size: number }>
  byDirectory: Record<string, number>
}

interface TestRunResult {
  command: string
  inputFile: string
  inputSize: number
  inputCharacters: number
  inputWords: number
  outputFile?: string
  outputSize?: number
  outputDurationSeconds?: number // For audio: duration of generated audio
  startTime: string
  endTime: string
  durationMs: number
  success: boolean
  exitCode: number
  error?: string
  stdout: string
  stderr: string
  // Performance metrics
  charactersPerSecond?: number
  wordsPerSecond?: number
  realTimeRatio?: number // For audio: output duration / generation time
}

interface SetupReport {
  command: string
  setupCommand: string
  startTime: string
  endTime: string
  durationMs: number
  success: boolean
  exitCode: number
  freshRun: boolean

  phases: Phase[]
  fileOperations: FileOperation[]
  downloads: Download[]
  errors: ErrorInfo[]
  storage: StorageMetrics

  // Post-setup test run results
  testRun?: TestRunResult

  environment: {
    platform: string
    arch: string
    bunVersion: string
    cwd: string
  }

  stdout: string
  stderr: string
}

// ============================================================================
// Constants
// ============================================================================

const BUILD_DIR = 'build'
const REPORTS_DIR = 'build/reports'
const WATCH_DIRS = ['build/bin', 'build/models', 'build/config', 'build/pyenv', 'build/src']
const CONFIG_DIR = 'build/config'

// Marker file patterns for different setup commands
const MARKER_PATTERNS: Record<string, string[]> = {
  'setup:reverb': ['.reverb-installed'],
  'setup:tts:qwen3': ['.qwen3-installed', '.tts-env-installed'],
  'setup:tts:chatterbox': ['.chatterbox-installed', '.tts-env-installed'],
  'setup:tts:fish': ['.fish-audio-installed', '.tts-env-installed'],
  'setup:tts:cosyvoice': ['.cosyvoice-installed', '.tts-env-installed'],
  'setup:tts': ['.tts-env-installed'],
  'setup:transcription': ['.whisper-installed', '.models-downloaded'],
  'setup:text': ['.whisper-installed', '.models-downloaded'],
}

// Test command configuration: maps setup commands to test commands
interface TestConfig {
  type: 'tts' | 'transcription'
  inputFile: string
  commandArgs: string[]
}

const TEST_CONFIGS: Record<string, TestConfig> = {
  'setup:tts:qwen3': {
    type: 'tts',
    inputFile: 'input/sample.md',
    commandArgs: ['tts', 'input/sample.md', '--qwen3'],
  },
  'setup:tts:chatterbox': {
    type: 'tts',
    inputFile: 'input/sample.md',
    commandArgs: ['tts', 'input/sample.md', '--chatterbox'],
  },
  'setup:tts:fish': {
    type: 'tts',
    inputFile: 'input/sample.md',
    commandArgs: ['tts', 'input/sample.md', '--fish-audio'],
  },
  'setup:tts:cosyvoice': {
    type: 'tts',
    inputFile: 'input/sample.md',
    commandArgs: ['tts', 'input/sample.md', '--cosyvoice'],
  },
  'setup:reverb': {
    type: 'transcription',
    inputFile: 'input/audio.mp3',
    commandArgs: ['text', '--file', 'input/audio.mp3', '--reverb'],
  },
  'setup:transcription': {
    type: 'transcription',
    inputFile: 'input/audio.mp3',
    commandArgs: ['text', '--file', 'input/audio.mp3', '--whisper', 'base'],
  },
  'setup:text': {
    type: 'transcription',
    inputFile: 'input/audio.mp3',
    commandArgs: ['text', '--file', 'input/audio.mp3', '--whisper', 'base'],
  },
}

// Patterns to detect phases from log output
const PHASE_PATTERNS = [
  { pattern: /\[[\d:\.]+\]\s*(.+?)(\.{3}|…)?\s*$/, extract: 1 },
  { pattern: /^(Installing|Cloning|Downloading|Building|Compiling|Creating|Setting up|Updating)\s+(.+)/i, extract: 0 },
  { pattern: /^(#+\s*)?(.+?)\s*(completed|done|finished|success|failed|error)/i, extract: 2 },
]

// Patterns to detect downloads
const DOWNLOAD_PATTERNS = [
  // wget/curl URLs
  /(?:wget|curl)\s+.*?(https?:\/\/[^\s'"]+)/gi,
  // Git clone
  /git\s+clone\s+.*?(https?:\/\/[^\s'"]+|git@[^\s'"]+)/gi,
  // HuggingFace downloads
  /(?:huggingface|hf).*?(https?:\/\/huggingface\.co[^\s'"]*)/gi,
  // ModelScope downloads
  /modelscope.*?(https?:\/\/[^\s'"]+)/gi,
  // pip install (PyPI)
  /pip\s+install\s+(?!-)[^\s]+/gi,
  // General URL pattern in output
  /Downloading\s+(https?:\/\/[^\s]+)/gi,
]

// ============================================================================
// Utility Functions
// ============================================================================

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms.toFixed(0)}ms`
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`
  const minutes = Math.floor(ms / 60000)
  const seconds = ((ms % 60000) / 1000).toFixed(1)
  return `${minutes}m ${seconds}s`
}

function sanitizeForFilename(str: string): string {
  return str.replace(/[^a-zA-Z0-9-]/g, '-').replace(/-+/g, '-')
}

async function getFileSize(path: string): Promise<number> {
  try {
    const s = await stat(path)
    return s.size
  } catch {
    return 0
  }
}

async function fileExists(path: string): Promise<boolean> {
  try {
    await stat(path)
    return true
  } catch {
    return false
  }
}

async function ensureDir(dir: string): Promise<void> {
  try {
    await mkdir(dir, { recursive: true })
  } catch {
    // Directory might already exist
  }
}

async function getDirectorySize(dir: string): Promise<number> {
  let total = 0
  try {
    const entries = await readdir(dir, { withFileTypes: true, recursive: true })
    for (const entry of entries) {
      if (entry.isFile()) {
        const fullPath = join(entry.parentPath || dir, entry.name)
        total += await getFileSize(fullPath)
      }
    }
  } catch {
    // Directory might not exist
  }
  return total
}

// ============================================================================
// Filesystem Watcher
// ============================================================================

class FileSystemTracker {
  private watchers: FSWatcher[] = []
  private operations: FileOperation[] = []
  private baseDir: string
  private initialSizes: Map<string, number> = new Map()
  private seenPaths: Set<string> = new Set()

  constructor(baseDir: string) {
    this.baseDir = baseDir
  }

  async snapshotInitialState(): Promise<void> {
    for (const dir of WATCH_DIRS) {
      const fullDir = join(this.baseDir, dir)
      if (await fileExists(fullDir)) {
        const size = await getDirectorySize(fullDir)
        this.initialSizes.set(dir, size)
      } else {
        this.initialSizes.set(dir, 0)
      }
    }
  }

  async startWatching(): Promise<void> {
    for (const dir of WATCH_DIRS) {
      const fullDir = join(this.baseDir, dir)
      await ensureDir(fullDir)

      try {
        const watcher = watch(fullDir, { recursive: true }, (eventType, filename) => {
          if (filename) {
            this.handleFileEvent(eventType, join(dir, filename))
          }
        })
        this.watchers.push(watcher)
      } catch (err) {
        // Directory might not be watchable, continue
        console.error(`Warning: Could not watch ${fullDir}:`, err)
      }
    }
  }

  private async handleFileEvent(eventType: string, relativePath: string): Promise<void> {
    const fullPath = join(this.baseDir, relativePath)
    const timestamp = new Date().toISOString()

    // Debounce: skip if we've seen this path very recently
    const key = `${eventType}:${relativePath}`
    if (this.seenPaths.has(key)) return
    this.seenPaths.add(key)
    setTimeout(() => this.seenPaths.delete(key), 100)

    const size = await getFileSize(fullPath)
    const exists = await fileExists(fullPath)

    let type: 'created' | 'modified' | 'deleted'
    if (!exists) {
      type = 'deleted'
    } else if (eventType === 'rename') {
      type = 'created'
    } else {
      type = 'modified'
    }

    this.operations.push({
      type,
      path: fullPath,
      relativePath,
      timestamp,
      size,
    })
  }

  stopWatching(): void {
    for (const watcher of this.watchers) {
      watcher.close()
    }
    this.watchers = []
  }

  getOperations(): FileOperation[] {
    return this.operations
  }

  async calculateStorageMetrics(): Promise<StorageMetrics> {
    const byDirectory: Record<string, number> = {}
    let totalBytesAdded = 0
    let totalBytesModified = 0
    const fileSizes: Array<{ path: string; size: number }> = []

    for (const dir of WATCH_DIRS) {
      const fullDir = join(this.baseDir, dir)
      const currentSize = await getDirectorySize(fullDir)
      const initialSize = this.initialSizes.get(dir) || 0
      const diff = currentSize - initialSize

      byDirectory[dir] = diff > 0 ? diff : 0
      if (diff > 0) {
        totalBytesAdded += diff
      }
    }

    // Get all files created during this run
    for (const op of this.operations) {
      if (op.type === 'created' && op.size > 0) {
        fileSizes.push({ path: op.relativePath, size: op.size })
      } else if (op.type === 'modified' && op.size > 0) {
        totalBytesModified += op.size
      }
    }

    // Sort by size and take top 10
    fileSizes.sort((a, b) => b.size - a.size)
    const largestFiles = fileSizes.slice(0, 10)

    return {
      totalBytesAdded,
      totalBytesModified,
      largestFiles,
      byDirectory,
    }
  }
}

// ============================================================================
// Output Parser
// ============================================================================

class OutputParser {
  private phases: Phase[] = []
  private downloads: Download[] = []
  private errors: ErrorInfo[] = []
  private currentPhase: Phase | null = null
  private lineBuffer: string[] = []

  parseLine(line: string, isStderr: boolean = false): void {
    this.lineBuffer.push(line)
    if (this.lineBuffer.length > 20) {
      this.lineBuffer.shift()
    }

    // Check for errors
    if (isStderr || /error|fail|exception/i.test(line)) {
      if (/error|fail|exception/i.test(line) && !/warning/i.test(line)) {
        this.errors.push({
          timestamp: new Date().toISOString(),
          message: line.trim(),
          context: this.lineBuffer.slice(-5).join('\n'),
        })
      }
    }

    // Check for phase transitions
    this.detectPhase(line)

    // Check for downloads
    this.detectDownloads(line)
  }

  private detectPhase(line: string): void {
    // Look for timestamped log lines (from common.sh log function)
    const timestampMatch = line.match(/^\[(\d{2}:\d{2}:\d{2}\.\d{3})\]\s*(.+)$/)
    if (timestampMatch) {
      const message = timestampMatch[2]

      // End current phase if we see completion markers
      if (/completed|success|done|finished|installed/i.test(message)) {
        if (this.currentPhase) {
          this.currentPhase.endTime = new Date().toISOString()
          this.currentPhase.durationMs = Date.now() - new Date(this.currentPhase.startTime).getTime()
          this.currentPhase.success = !/fail|error/i.test(message)
          this.phases.push(this.currentPhase)
          this.currentPhase = null
        }
        return
      }

      // Start new phase for action verbs
      if (/^(Installing|Cloning|Downloading|Building|Compiling|Creating|Setting up|Updating|Checking)/i.test(message)) {
        // End previous phase if exists
        if (this.currentPhase) {
          this.currentPhase.endTime = new Date().toISOString()
          this.currentPhase.durationMs = Date.now() - new Date(this.currentPhase.startTime).getTime()
          this.currentPhase.success = true
          this.phases.push(this.currentPhase)
        }

        this.currentPhase = {
          name: message.replace(/\.{3}$/, '').trim(),
          startTime: new Date().toISOString(),
          success: true,
        }
      }
    }
  }

  private detectDownloads(line: string): void {
    // Git clone
    const gitMatch = line.match(/git\s+clone\s+(?:--[^\s]+\s+)*([^\s]+)/i)
    if (gitMatch) {
      this.downloads.push({
        url: gitMatch[1],
        success: true,
      })
    }

    // wget/curl
    const wgetMatch = line.match(/(?:wget|curl)\s+.*?(https?:\/\/[^\s'"]+)/i)
    if (wgetMatch) {
      this.downloads.push({
        url: wgetMatch[1],
        success: true,
      })
    }

    // pip install
    const pipMatch = line.match(/pip\s+install\s+(?!-)([^\s><=]+)/gi)
    if (pipMatch) {
      for (const match of pipMatch) {
        const pkg = match.replace(/pip\s+install\s+/i, '').trim()
        if (pkg && !pkg.startsWith('-')) {
          this.downloads.push({
            url: `pypi:///${pkg}`,
            success: true,
          })
        }
      }
    }

    // Downloading messages
    const downloadingMatch = line.match(/Downloading\s+(https?:\/\/[^\s]+)/i)
    if (downloadingMatch) {
      this.downloads.push({
        url: downloadingMatch[1],
        success: true,
      })
    }

    // HuggingFace hub downloads
    if (/huggingface_hub|from_pretrained|snapshot_download/i.test(line)) {
      const hfMatch = line.match(/([\w\-]+\/[\w\-\.]+)/g)
      if (hfMatch) {
        for (const repo of hfMatch) {
          if (repo.includes('/') && !repo.startsWith('http')) {
            this.downloads.push({
              url: `huggingface:///${repo}`,
              success: true,
            })
          }
        }
      }
    }
  }

  finalize(): void {
    // Close any open phase
    if (this.currentPhase) {
      this.currentPhase.endTime = new Date().toISOString()
      this.currentPhase.durationMs = Date.now() - new Date(this.currentPhase.startTime).getTime()
      this.phases.push(this.currentPhase)
      this.currentPhase = null
    }
  }

  getPhases(): Phase[] {
    return this.phases
  }

  getDownloads(): Download[] {
    // Deduplicate downloads
    const seen = new Set<string>()
    return this.downloads.filter((d) => {
      if (seen.has(d.url)) return false
      seen.add(d.url)
      return true
    })
  }

  getErrors(): ErrorInfo[] {
    return this.errors
  }
}

// ============================================================================
// Test Runner
// ============================================================================

async function getAudioDuration(filePath: string): Promise<number | undefined> {
  try {
    // Use ffprobe to get audio duration
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

async function findOutputFile(inputFile: string, type: 'tts' | 'transcription'): Promise<string | undefined> {
  // Output files are typically in output/ directory with same base name
  const baseName = inputFile.split('/').pop()?.replace(/\.[^.]+$/, '') || ''
  const outputDir = 'output'

  try {
    const entries = await readdir(outputDir, { withFileTypes: true })

    if (type === 'tts') {
      // Look for .wav or .mp3 files matching the input name
      for (const entry of entries) {
        if (entry.isFile() && entry.name.startsWith(baseName) && /\.(wav|mp3)$/.test(entry.name)) {
          return join(outputDir, entry.name)
        }
      }
      // Also check for most recent audio file
      const audioFiles = entries
        .filter((e) => e.isFile() && /\.(wav|mp3)$/.test(e.name))
        .map((e) => join(outputDir, e.name))

      if (audioFiles.length > 0) {
        // Return the most recently modified one
        let mostRecent = audioFiles[0]
        let mostRecentTime = 0
        for (const f of audioFiles) {
          const s = await stat(f)
          if (s.mtimeMs > mostRecentTime) {
            mostRecentTime = s.mtimeMs
            mostRecent = f
          }
        }
        return mostRecent
      }
    } else {
      // Transcription: look for .txt or .md files
      for (const entry of entries) {
        if (entry.isFile() && entry.name.startsWith(baseName) && /\.(txt|md)$/.test(entry.name)) {
          return join(outputDir, entry.name)
        }
      }
    }
  } catch {
    // Output directory might not exist
  }

  return undefined
}

async function runTestCommand(setupCommand: string): Promise<TestRunResult | undefined> {
  const config = TEST_CONFIGS[setupCommand]
  if (!config) {
    console.log(`\nNo test configuration for ${setupCommand}, skipping test run.`)
    return undefined
  }

  console.log(`\n${'='.repeat(60)}`)
  console.log(`Running Test: ${config.type.toUpperCase()}`)
  console.log(`Input: ${config.inputFile}`)
  console.log(`Command: bun as -- ${config.commandArgs.join(' ')}`)
  console.log(`${'='.repeat(60)}\n`)

  // Read input file to get character/word counts
  let inputContent = ''
  let inputSize = 0
  try {
    const inputFile = Bun.file(config.inputFile)
    inputContent = await inputFile.text()
    inputSize = inputFile.size
  } catch (err) {
    console.error(`Warning: Could not read input file ${config.inputFile}:`, err)
  }

  const inputCharacters = inputContent.length
  const inputWords = inputContent.split(/\s+/).filter((w) => w.length > 0).length

  const startTime = new Date()
  const startNanos = Bun.nanoseconds()

  let stdout = ''
  let stderr = ''
  let exitCode = 0
  let error: string | undefined

  try {
    const proc = Bun.spawn(['bun', 'as', '--', ...config.commandArgs], {
      cwd: process.cwd(),
      stdout: 'pipe',
      stderr: 'pipe',
      env: {
        ...process.env,
        FORCE_COLOR: '1',
      },
    })

    // Stream output using getReader()
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
  const outputFile = await findOutputFile(config.inputFile, config.type)
  let outputSize: number | undefined
  let outputDurationSeconds: number | undefined

  if (outputFile) {
    outputSize = await getFileSize(outputFile)
    if (config.type === 'tts') {
      outputDurationSeconds = await getAudioDuration(outputFile)
    }
  }

  // Calculate performance metrics
  const charactersPerSecond = durationSeconds > 0 ? inputCharacters / durationSeconds : undefined
  const wordsPerSecond = durationSeconds > 0 ? inputWords / durationSeconds : undefined
  const realTimeRatio = outputDurationSeconds && durationSeconds > 0 ? outputDurationSeconds / durationSeconds : undefined

  const result: TestRunResult = {
    command: `bun as -- ${config.commandArgs.join(' ')}`,
    inputFile: config.inputFile,
    inputSize,
    inputCharacters,
    inputWords,
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
  console.log('Test Run Complete')
  console.log(`${'='.repeat(60)}`)
  console.log(`Status: ${result.success ? '✅ Success' : '❌ Failed'}`)
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

// ============================================================================
// Report Generator
// ============================================================================

function generateMarkdownReport(report: SetupReport): string {
  const lines: string[] = []

  // Header
  lines.push(`# Setup Report: ${report.command}`)
  lines.push('')
  lines.push(`**Date:** ${new Date(report.startTime).toLocaleString()}`)
  lines.push(`**Duration:** ${formatDuration(report.durationMs)}`)
  lines.push(`**Status:** ${report.success ? '✅ Success' : '❌ Failed'}`)
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
      const status = phase.success ? '✅' : '❌'
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
    lines.push(`**Status:** ${test.success ? '✅ Success' : '❌ Failed'}`)
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

// ============================================================================
// Marker File Management
// ============================================================================

async function removeMarkers(setupCommand: string): Promise<string[]> {
  const removed: string[] = []
  const markers = MARKER_PATTERNS[setupCommand] || []

  for (const marker of markers) {
    const markerPath = join(CONFIG_DIR, marker)
    if (await fileExists(markerPath)) {
      try {
        await rm(markerPath)
        removed.push(markerPath)
      } catch (err) {
        console.error(`Warning: Could not remove marker ${markerPath}:`, err)
      }
    }
  }

  return removed
}

// ============================================================================
// Main Runner
// ============================================================================

async function runSetupWithReport(setupCommand: string, fresh: boolean, runTest: boolean): Promise<SetupReport> {
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
    const proc = Bun.spawn(['bun', 'run', setupCommand], {
      cwd,
      stdout: 'pipe',
      stderr: 'pipe',
      env: {
        ...process.env,
        FORCE_COLOR: '1',
      },
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
    report.testRun = await runTestCommand(setupCommand)
  } else if (runTest && exitCode !== 0) {
    console.log('\nSkipping test run because setup failed.')
  }

  return report
}

// ============================================================================
// CLI Entry Point
// ============================================================================

async function main(): Promise<void> {
  const args = process.argv.slice(2)

  // Parse arguments
  const fresh = args.includes('--fresh')
  const skipTest = args.includes('--skip-test')
  const setupCommand = args.find((a) => !a.startsWith('-'))

  if (!setupCommand) {
    console.error(`
Usage: bun .github/setup/setup-report.ts <setup-command> [options]

Options:
  --fresh      Remove marker files before running to force a complete setup
  --skip-test  Skip the post-setup test run

Examples:
  bun .github/setup/setup-report.ts setup:reverb
  bun .github/setup/setup-report.ts setup:tts:qwen3 --fresh
  bun .github/setup/setup-report.ts setup:tts:chatterbox --skip-test

Available setup commands:
  setup:reverb
  setup:tts:qwen3
  setup:tts:chatterbox
  setup:tts:fish
  setup:tts:cosyvoice
  setup:transcription
  setup:tts
`)
    process.exit(1)
  }

  // Run setup and generate report
  const runTest = !skipTest
  const report = await runSetupWithReport(setupCommand, fresh, runTest)

  // Generate filenames
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
  const commandSlug = sanitizeForFilename(report.command)
  const jsonPath = join(REPORTS_DIR, `${commandSlug}-${timestamp}.json`)
  const mdPath = join(REPORTS_DIR, `${commandSlug}-${timestamp}.md`)

  // Write reports
  await Bun.write(jsonPath, JSON.stringify(report, null, 2))
  await Bun.write(mdPath, generateMarkdownReport(report))

  // Print summary
  console.log(`\n${'='.repeat(60)}`)
  console.log('Setup Report Complete')
  console.log(`${'='.repeat(60)}`)
  console.log(`Status: ${report.success ? '✅ Success' : '❌ Failed'}`)
  console.log(`Duration: ${formatDuration(report.durationMs)}`)
  console.log(`Storage Added: ${formatBytes(report.storage.totalBytesAdded)}`)
  console.log(`Files Created: ${report.fileOperations.filter((f) => f.type === 'created').length}`)
  console.log(`Phases Detected: ${report.phases.length}`)
  console.log(`Downloads Detected: ${report.downloads.length}`)
  console.log(`Errors: ${report.errors.length}`)

  if (report.testRun) {
    console.log('')
    console.log('Test Run:')
    console.log(`  Status: ${report.testRun.success ? '✅ Success' : '❌ Failed'}`)
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

  // Exit with setup exit code (test failures don't affect exit)
  process.exit(report.exitCode)
}

main().catch((err) => {
  console.error('Fatal error:', err)
  process.exit(1)
})
