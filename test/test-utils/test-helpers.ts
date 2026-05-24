import { readFileSync } from 'node:fs'
import { mkdir, readdir, rm, appendFile, copyFile, stat } from 'node:fs/promises'
import { basename, dirname, isAbsolute, join, normalize, relative, resolve } from 'node:path'
import { parseCommandEstimatedTotal } from '../test-runner/utils'
import { readOutputMetadataSummary } from './output-metadata-summary'
import { E2E_TEST_TIMEOUT_MS } from './timeouts'
import { LLAMA_PROCESS_LOCK_NAME, stopDefaultLlamaServer } from '~/cli/commands/process-steps/step-3-write/write-local/llama/run-llama'
import { withProcessLock } from '~/utils/process-lock'

const TEST_OUTPUT_ROOT = 'project/test-output'

const sanitizeOutputRootSegment = (value: string): string =>
  value.replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/^-+|-+$/g, '') || 'run'

const resolveTestOutputDir = (): string => {
  const artifactsDir = process.env['AUTOSHOW_TEST_ARTIFACTS_DIR']?.trim()
  if (artifactsDir) {
    return join(artifactsDir, 'outputs', `p${process.pid}`)
  }

  const explicit = process.env['AUTOSHOW_OUTPUT_DIR']?.trim()
  if (explicit) {
    return explicit
  }

  const runId = sanitizeOutputRootSegment(process.env['AUTOSHOW_TEST_RUN_ID'] ?? 'local')
  return join(TEST_OUTPUT_ROOT, runId, `p${process.pid}`)
}

export const OUTPUT_DIR = resolveTestOutputDir()
process.env['AUTOSHOW_OUTPUT_DIR'] = OUTPUT_DIR
export const EXAMPLE_AUDIO_URL = 'https://ajc.pics/autoshow/examples/1-audio.mp3'
export const EXAMPLE_SHORT_AUDIO_URL = 'https://ajc.pics/autoshow/examples/0-audio-short.mp3'
export const EXAMPLE_VIDEO_URL = 'https://ajc.pics/autoshow/examples/2-video.mp4'
export const LOCAL_EXAMPLE_AUDIO_PATH = join('input/examples/audio', '1-audio.mp3')
export const LOCAL_EXAMPLE_SHORT_AUDIO_PATH = join('input/examples/audio', '0-audio-short.mp3')
export const LOCAL_EXAMPLE_VIDEO_PATH = join('input/examples/video', '2-video.mp4')
export const SHORT_LOCAL_AUDIO_PATH = LOCAL_EXAMPLE_SHORT_AUDIO_PATH
export const SHORT_LOCAL_AUDIO_TITLE = basename(SHORT_LOCAL_AUDIO_PATH).replace(/\.[^/.]+$/, '')
export const STABLE_AUDIO_URL = EXAMPLE_AUDIO_URL
export const STABLE_AUDIO_TITLE = new URL(STABLE_AUDIO_URL).pathname.split('/').pop()?.replace(/\.[^/.]+$/, '') ?? ''
export const STABLE_EXAMPLE_AUDIO_URL = EXAMPLE_AUDIO_URL
export const STABLE_EXAMPLE_AUDIO_TITLE = STABLE_EXAMPLE_AUDIO_URL.split('/').pop()?.replace(/\.[^/.]+$/, '') ?? ''
export const STABLE_TTS_MD_PATH = 'input/examples/tts/1-tts.md'
export const STABLE_TTS_MD_TITLE = '1-tts'
const PAGE_IMAGE_PNG_BASE64 = 'iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAIAAAD8GO2jAAAAN0lEQVR4nO3RwQ0AMAjDwJT9d05HMB9+vgGCZF7bXJrT9XhgwR8gEyETIRMhEyETIRMhEyEThXzH8QM9OMM6fAAAAABJRU5ErkJggg=='

const stripAnsi = (text: string): string => text.replace(/\x1b\[[0-9;]*m/g, '')

const shouldPreserveArtifacts = (): boolean => process.env['AUTOSHOW_TEST_PRESERVE_ARTIFACTS'] !== '0'

const sanitizeOutputSuffix = (titleSuffix: string): string =>
  titleSuffix.replace(/\s+/g, '_').replace(/[<>:"/\\|?*]/g, '')

const parseCallerLocation = (): { file: string | null, line: number | null, column: number | null } => {
  const stack = new Error().stack ?? ''
  const lines = stack.split('\n').map(line => line.trim())
  const parsedCandidates: Array<{ file: string, line: number, column: number }> = []

  for (const line of lines) {
    const matchWithParen = line.match(/\((.*):(\d+):(\d+)\)$/)
    const matchNoParen = line.match(/at (.*):(\d+):(\d+)$/)
    const match = matchWithParen ?? matchNoParen
    if (!match) {
      continue
    }

    const rawPath = match[1]
    const lineNo = Number.parseInt(match[2] || '', 10)
    const colNo = Number.parseInt(match[3] || '', 10)

    if (!rawPath || Number.isNaN(lineNo) || Number.isNaN(colNo)) {
      continue
    }

    const normalizedPath = rawPath.replace(/^file:\/\//, '')
    if (!normalizedPath.includes('/test/')) {
      continue
    }
    const absolutePath = isAbsolute(normalizedPath) ? normalizedPath : resolve(process.cwd(), normalizedPath)
    const relativePath = normalize(relative(process.cwd(), absolutePath)).replace(/\\/g, '/')
    parsedCandidates.push({ file: relativePath, line: lineNo, column: colNo })
  }

  const testCaseHit = parsedCandidates.find(candidate => candidate.file.includes('test/test-cases/'))
  if (testCaseHit) {
    return testCaseHit
  }

  const fallback = parsedCandidates.find(candidate => candidate.file !== 'test/test-utils/test-helpers.ts')
  if (fallback) {
    return fallback
  }

  return {
    file: null,
    line: null,
    column: null,
  }
}

const parseOutputDirFromText = (text: string): string | null => {
  const clean = stripAnsi(text)
  const patterns = [
    /(?:^|\n)\s*(?:outputDir|retryOutputDir):\s*([^\n\r]+)/g,
    /(?:^|\n)\s*(?:runManifest|batchManifest):\s*([^\n\r]+\/(?:run|batch)\.json)/g,
    /Locations[\s\S]*?│\s*(?:outputDir|retryOutputDir)\s*│\s*([^\n\r│]+?)\s*│/g,
    /Artifacts[\s\S]*?│\s*run\s*│\s*([^\n\r│]+\/run\.json)\s*│/g,
    /"artifact"\s*:\s*"outputDir"[\s\S]*?"path"\s*:\s*"([^"\n\r]+)"/g,
    /"run"\s*:\s*"([^"\n\r]+\/run\.json)"/g,
  ]

  for (const pattern of patterns) {
    const matches = Array.from(clean.matchAll(pattern))
    const last = matches[matches.length - 1]
    if (!last) {
      continue
    }
    const value = last[1]?.trim()
    if (value && value.length > 0) {
      if (value.endsWith('/run.json') || value.endsWith('/batch.json')) {
        return dirname(value)
      }
      return value
    }
  }

  return null
}

const copyRunManifestToArtifacts = async (outputDir: string | null, outputRoot: string): Promise<void> => {
  const artifactsDir = process.env['AUTOSHOW_TEST_ARTIFACTS_DIR']
  if (!artifactsDir || !outputDir) {
    return
  }

  const absoluteOutputDir = isAbsolute(outputDir) ? outputDir : resolve(process.cwd(), outputDir)
  const absoluteOutputRoot = isAbsolute(outputRoot) ? outputRoot : resolve(process.cwd(), outputRoot)
  const srcPath = `${absoluteOutputDir}/run.json`

  try {
    const exists = await fileExists(srcPath)
    if (!exists) {
      return
    }

    const destDir = `${artifactsDir}/run`
    const destName = [
      sanitizeOutputRootSegment(basename(absoluteOutputRoot)),
      sanitizeOutputRootSegment(basename(absoluteOutputDir)),
    ].join('-')
    await mkdir(destDir, { recursive: true })
    await copyFile(srcPath, `${destDir}/${destName}.json`)
  } catch {
  }
}

const SUBPROCESS_TIMEOUT = E2E_TEST_TIMEOUT_MS
const E2E_CHILD_TIMEOUT_KEYS = [
  'AUTOSHOW_MEDIA_GENERATION_TIMEOUT_MS',
  'AUTOSHOW_LLM_REQUEST_TIMEOUT_MS',
  'AUTOSHOW_OCR_REQUEST_TIMEOUT_MS',
  'AUTOSHOW_OCR_POLL_DEADLINE_MS'
] as const
const TEST_CONFIG_PATH = resolve(import.meta.dir, 'fixtures/empty-autoshow-config.json')
const TEST_CACHE_DIR = resolve(process.cwd(), TEST_OUTPUT_ROOT, '.test-cache')
const PROCESSING_COMMANDS = new Set([
  'metadata',
  'download',
  'extract',
  'resume',
  'write',
  'tts',
  'image',
  'music',
  'video'
])
const HELP_FLAGS = new Set(['--help', '-h'])
let commandOutputCounter = 0
const BASE_CHILD_ENV = Object.entries(process.env).reduce<Record<string, string>>((env, [key, value]) => {
  if (typeof value === 'string') {
    env[key] = value
  }
  return env
}, {})

const resolveE2EChildTimeoutDefaults = (timeoutMs: number): Record<string, string> => {
  const defaults: Record<string, string> = {}
  const value = String(timeoutMs)
  for (const key of E2E_CHILD_TIMEOUT_KEYS) {
    if (!BASE_CHILD_ENV[key]?.trim()) {
      defaults[key] = value
    }
  }
  return defaults
}

const getTestProcessLockRoot = (): string =>
  process.env['AUTOSHOW_PROCESS_LOCK_DIR'] ?? join(TEST_CACHE_DIR, 'process-locks')

const shouldUseEmptyTestConfig = (args: string[]): boolean => {
  if (args[0] !== 'src/cli/create-cli.ts') {
    return false
  }

  if (args.some((arg) => arg === '--config-path' || arg.startsWith('--config-path='))) {
    return false
  }

  if (args.some((arg) => HELP_FLAGS.has(arg))) {
    return false
  }

  const command = args[1]
  return typeof command === 'string' && PROCESSING_COMMANDS.has(command)
}

const withEmptyTestConfig = (args: string[]): string[] =>
  shouldUseEmptyTestConfig(args)
    ? [...args, '--config-path', TEST_CONFIG_PATH]
    : args

const isProcessingCliCommand = (args: string[]): boolean => {
  if (args[0] !== 'src/cli/create-cli.ts') {
    return false
  }
  if (args.some((arg) => HELP_FLAGS.has(arg))) {
    return false
  }
  const command = args[1]
  return typeof command === 'string' && PROCESSING_COMMANDS.has(command)
}

const createCommandOutputRoot = async (args: string[], testName: string | null): Promise<string> => {
  const index = ++commandOutputCounter
  const command = args[1] ?? 'command'
  const label = testName ?? args.slice(1, 5).join('-')
  const segment = [
    String(index).padStart(4, '0'),
    Date.now().toString(36),
    sanitizeOutputRootSegment(command),
    sanitizeOutputRootSegment(label).slice(0, 80),
  ].filter(Boolean).join('-')
  const outputRoot = join(OUTPUT_DIR, segment)
  await mkdir(outputRoot, { recursive: true })
  return outputRoot
}

const resolveCommandOutputRoot = async (
  args: string[],
  testName: string | null,
  env: Record<string, string | undefined> | undefined
): Promise<string> => {
  const explicitOutputRoot = env?.['AUTOSHOW_OUTPUT_DIR']?.trim()
  if (explicitOutputRoot) {
    return explicitOutputRoot
  }

  if (isProcessingCliCommand(args)) {
    return await createCommandOutputRoot(args, testName)
  }

  return OUTPUT_DIR
}

export type RunCommandOptions = {
  testName?: string
  env?: Record<string, string | undefined>
  cwd?: string
  timeoutMs?: number
}

export type RunCommandResult = {
  exitCode: number
  stdout: string
  stderr: string
  outputDir: string | null
  outputRoot: string
}

const readStreamText = async (stream: ReadableStream): Promise<string> => {
  const reader = stream.getReader()
  const decoder = new TextDecoder()
  let full = ''

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      full += decoder.decode(value, { stream: true })
    }

    full += decoder.decode()
  } finally {
    reader.releaseLock()
  }

  return full
}

export const runCommand = async (args: string[], opts?: RunCommandOptions): Promise<RunCommandResult> => {
  const testName = opts?.testName ?? null
  const childArgs = withEmptyTestConfig(args)
  const cmdStr = `bun ${childArgs.join(' ')}`
  const startTime = Date.now()
  const commandLogPath = process.env['AUTOSHOW_TEST_COMMAND_LOG']
  const metricsLogPath = process.env['AUTOSHOW_TEST_METRICS_LOG']
  const timeoutMs = opts?.timeoutMs ?? SUBPROCESS_TIMEOUT
  const outputRoot = await resolveCommandOutputRoot(childArgs, testName, opts?.env)

  const env = {
    ...BASE_CHILD_ENV,
    ...resolveE2EChildTimeoutDefaults(timeoutMs),
    AUTOSHOW_OUTPUT_DIR: outputRoot,
    AUTOSHOW_CACHE_DIR: TEST_CACHE_DIR,
    ...(opts?.env ?? {})
  }

  const proc = Bun.spawn(['bun', ...childArgs], {
    stdout: 'pipe',
    stderr: 'pipe',
    env,
    ...(opts?.cwd ? { cwd: opts.cwd } : {})
  })
  const timer = setTimeout(() => {
    try {
      process.kill(-proc.pid, 'SIGTERM')
    } catch {
      proc.kill()
    }
  }, timeoutMs)

  const [stdout, stderr, exitCode] = await Promise.all([
    readStreamText(proc.stdout),
    readStreamText(proc.stderr),
    proc.exited,
  ])

  clearTimeout(timer)
  const duration = Date.now() - startTime

  const combined = `${stdout}\n${stderr}`
  const outputDir = parseOutputDirFromText(combined)
  const effectiveOutputRoot = env['AUTOSHOW_OUTPUT_DIR']?.trim() || outputRoot
  await copyRunManifestToArtifacts(outputDir, effectiveOutputRoot)
  const absoluteOutputDir = outputDir
    ? (isAbsolute(outputDir) ? outputDir : resolve(process.cwd(), outputDir))
    : null
  const metadataSummary = absoluteOutputDir
    ? await readOutputMetadataSummary(`${absoluteOutputDir}/run.json`)
    : null
  const parsedEstimatedCostCents = parseCommandEstimatedTotal(combined)
  const caller = parseCallerLocation()

  if (metricsLogPath) {
    const record = {
      kind: 'command_metric',
      at: new Date().toISOString(),
      source: 'runCommand',
      command: cmdStr,
      args: childArgs,
      exitCode,
      durationMs: duration,
      outputDir,
      outputRoot: effectiveOutputRoot,
      callerFile: caller.file,
      callerLine: caller.line,
      callerColumn: caller.column,
      testName,
      estimatedCostCents: metadataSummary?.estimatedCostCents ?? parsedEstimatedCostCents,
      actualCostCents: metadataSummary?.actualCostCents ?? null,
      estimatedProcessingTimeMs: metadataSummary?.estimatedProcessingTimeMs ?? null,
      actualProcessingTimeMs: metadataSummary?.actualProcessingTimeMs ?? null,
    }

    try {
      await appendFile(metricsLogPath, `${JSON.stringify(record)}\n`)
    } catch {
    }
  }

  if (commandLogPath) {
    await appendFile(
      commandLogPath,
      `\n=== START cmd: ${cmdStr} ===\nstdout:\n${stdout}\nstderr:\n${stderr}\n=== END cmd: ${cmdStr} (exit=${exitCode}, ${duration}ms) ===\n`
    )
  }
  return { exitCode, stdout, stderr, outputDir, outputRoot: effectiveOutputRoot }
}

export const fileExists = async (path: string): Promise<boolean> => {
  try {
    await stat(path)
    return true
  } catch {
    return false
  }
}

export const ensurePageImageFixture = async (path = 'input/examples/document/1-document.png'): Promise<void> => {
  await Bun.write(path, Buffer.from(PAGE_IMAGE_PNG_BASE64, 'base64'))
}

const listMatchingOutputDirs = async (titleSuffix: string, outputRoot = OUTPUT_DIR): Promise<string[]> => {
  const sanitizedSuffix = sanitizeOutputSuffix(titleSuffix)

  try {
    const entries = await readdir(outputRoot, { withFileTypes: true })
    return entries
      .filter(entry => entry.isDirectory() && entry.name.endsWith(`_${sanitizedSuffix}`))
      .map(entry => join(outputRoot, entry.name))
  } catch {
    return []
  }
}

const listMatchingOutputDirsRecursive = async (titleSuffix: string, outputRoot: string): Promise<string[]> => {
  const direct = await listMatchingOutputDirs(titleSuffix, outputRoot)

  try {
    const entries = await readdir(outputRoot, { withFileTypes: true })
    const nested = await Promise.all(
      entries
        .filter(entry => entry.isDirectory())
        .map(entry => listMatchingOutputDirs(titleSuffix, join(outputRoot, entry.name)))
    )
    return [...direct, ...nested.flat()]
  } catch {
    return direct
  }
}

export const findLatestDirectory = async (
  titleSuffix: string,
  outputRoot?: string | null
): Promise<string | null> => {
  try {
    const directories = outputRoot
      ? await listMatchingOutputDirs(titleSuffix, outputRoot)
      : await listMatchingOutputDirsRecursive(titleSuffix, OUTPUT_DIR)

    if (directories.length === 0) {
      return null
    }

    const stats = await Promise.all(
      directories.map(async (dir) => {
        const s = await stat(dir)
        return { dir, mtimeMs: s.mtimeMs }
      })
    )

    stats.sort((a, b) => {
      if (a.mtimeMs !== b.mtimeMs) return a.mtimeMs - b.mtimeMs
      return a.dir.localeCompare(b.dir)
    })

    return stats[stats.length - 1]?.dir ?? null
  } catch {
    return null
  }
}

export const cleanupOutput = async (): Promise<void> => {
  if (shouldPreserveArtifacts()) {
    return
  }

  try {
    await mkdir(OUTPUT_DIR, { recursive: true })
    const entries = await readdir(OUTPUT_DIR, { withFileTypes: true })
    await Promise.all(
      entries
        .filter(entry => entry.isDirectory())
        .map(entry => rm(`${OUTPUT_DIR}/${entry.name}`, { recursive: true, force: true }))
    )
  } catch {
  }
}

export const cleanupTestOutput = async (titleSuffix: string): Promise<void> => {
  if (shouldPreserveArtifacts()) {
    return
  }

  try {
    const dirs = await listMatchingOutputDirs(titleSuffix)
    await Promise.all(dirs.map(d => rm(d, { recursive: true, force: true })))
  } catch {
  }
}

export const hasConfiguredEnvVar = async (key: string): Promise<boolean> => {
  const direct = process.env[key]
  if (typeof direct === 'string' && direct.trim().length > 0) {
    return true
  }

  try {
    const text = await Bun.file('.env').text()
    for (const line of text.split('\n')) {
      const trimmed = line.trim()
      if (trimmed.length === 0 || trimmed.startsWith('#')) {
        continue
      }
      const idx = trimmed.indexOf('=')
      if (idx <= 0) {
        continue
      }
      const k = trimmed.slice(0, idx).trim()
      if (k !== key) {
        continue
      }
      const value = trimmed.slice(idx + 1).trim().replace(/^['"]|['"]$/g, '')
      return value.length > 0
    }
    return false
  } catch {
    return false
  }
}

export const readConfiguredEnvVar = async (key: string): Promise<string | undefined> => {
  const direct = process.env[key]?.trim()
  if (direct) {
    return direct
  }

  try {
    const text = await Bun.file('.env').text()
    for (const line of text.split('\n')) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) {
        continue
      }
      const idx = trimmed.indexOf('=')
      if (idx <= 0) {
        continue
      }
      const k = trimmed.slice(0, idx).trim()
      if (k !== key) {
        continue
      }
      const value = trimmed.slice(idx + 1).trim().replace(/^['"]|['"]$/g, '')
      if (value.length > 0) {
        return value
      }
    }
  } catch {
  }

  return undefined
}

export const readConfiguredEnvVarSync = (key: string): string | undefined => {
  const direct = process.env[key]?.trim()
  if (direct) {
    return direct
  }

  try {
    const text = readFileSync('.env', 'utf8')
    for (const line of text.split('\n')) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) {
        continue
      }
      const idx = trimmed.indexOf('=')
      if (idx <= 0) {
        continue
      }
      const k = trimmed.slice(0, idx).trim()
      if (k !== key) {
        continue
      }
      const value = trimmed.slice(idx + 1).trim().replace(/^['"]|['"]$/g, '')
      if (value.length > 0) {
        return value
      }
    }
  } catch {
  }

  return undefined
}

export const stopLlamaServer = async (): Promise<void> => {
  const lockRoot = getTestProcessLockRoot()
  await withProcessLock(
    LLAMA_PROCESS_LOCK_NAME,
    async () => {
      await stopDefaultLlamaServer({ lockRoot })
      await Bun.sleep(300)
    },
    { lockRoot }
  )
}

export const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === 'object' && value !== null
}

export const toRecordArray = (value: unknown): Record<string, unknown>[] => {
  if (Array.isArray(value)) {
    return value.filter(isRecord)
  }
  return isRecord(value) ? [value] : []
}
