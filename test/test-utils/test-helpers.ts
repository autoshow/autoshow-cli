import { mkdir, readdir, rm, appendFile, copyFile, stat } from 'node:fs/promises'
import { basename, isAbsolute, join, normalize, relative, resolve } from 'node:path'
import { parseCommandEstimatedTotal } from '../test-runner/utils'
import { readOutputMetadataSummary } from './output-metadata-summary'

export const OUTPUT_DIR = './output'
export const STABLE_AUDIO_URL = 'https://ajc.pics/autoshow/1-audio.mp3'
export const STABLE_AUDIO_TITLE = new URL(STABLE_AUDIO_URL).pathname.split('/').pop()?.replace(/\.[^/.]+$/, '') ?? ''
export const STABLE_LOCAL_AUDIO_PATH = 'input/examples/audio/1-audio.mp3'
export const STABLE_LOCAL_AUDIO_TITLE = STABLE_LOCAL_AUDIO_PATH.split('/').pop()?.replace(/\.[^/.]+$/, '') ?? ''
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
    /Locations[\s\S]*?│\s*outputDir\s*│\s*([^\n\r│]+?)\s*│/g,
    /"artifact"\s*:\s*"outputDir"[\s\S]*?"path"\s*:\s*"([^"\n\r]+)"/g,
    /Output directory:\s*([^\n\r]+)/g,
    /Extraction complete:\s*([^\n\r]+)/g,
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
      if (value.endsWith('/run.json')) {
        return value.slice(0, -'/run.json'.length)
      }
      return value
    }
  }

  return null
}

const copyRunManifestToArtifacts = async (outputDir: string | null): Promise<void> => {
  const artifactsDir = process.env['AUTOSHOW_TEST_ARTIFACTS_DIR']
  if (!artifactsDir || !outputDir) {
    return
  }

  const absoluteOutputDir = isAbsolute(outputDir) ? outputDir : resolve(process.cwd(), outputDir)
  const srcPath = `${absoluteOutputDir}/run.json`

  try {
    const exists = await fileExists(srcPath)
    if (!exists) {
      return
    }

      const destDir = `${artifactsDir}/run`
    await mkdir(destDir, { recursive: true })
    await copyFile(srcPath, `${destDir}/${basename(absoluteOutputDir)}.json`)
  } catch {
  }
}

const SUBPROCESS_TIMEOUT = 900000
const BASE_CHILD_ENV = Object.entries(process.env).reduce<Record<string, string>>((env, [key, value]) => {
  if (typeof value === 'string') {
    env[key] = value
  }
  return env
}, {})

export type RunCommandOptions = {
  testName?: string
  env?: Record<string, string | undefined>
  cwd?: string
}

export type RunCommandResult = {
  exitCode: number
  stdout: string
  stderr: string
  outputDir: string | null
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
  const cmdStr = `bun ${args.join(' ')}`
  const startTime = Date.now()
  const commandLogPath = process.env['AUTOSHOW_TEST_COMMAND_LOG'] || 'test_debug.log'
  const metricsLogPath = process.env['AUTOSHOW_TEST_METRICS_LOG']

  const env = {
    ...BASE_CHILD_ENV,
    ...(opts?.env ?? {})
  }

  const proc = Bun.spawn(['bun', ...args], {
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
  }, SUBPROCESS_TIMEOUT)

  const [stdout, stderr, exitCode] = await Promise.all([
    readStreamText(proc.stdout),
    readStreamText(proc.stderr),
    proc.exited,
  ])

  clearTimeout(timer)
  const duration = Date.now() - startTime

  const combined = `${stdout}\n${stderr}`
  const outputDir = parseOutputDirFromText(combined)
  await copyRunManifestToArtifacts(outputDir)
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
      args,
      exitCode,
      durationMs: duration,
      outputDir,
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

  await appendFile(
    commandLogPath,
    `\n=== START cmd: ${cmdStr} ===\nstdout:\n${stdout}\nstderr:\n${stderr}\n=== END cmd: ${cmdStr} (exit=${exitCode}, ${duration}ms) ===\n`
  )
  return { exitCode, stdout, stderr, outputDir }
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

const listMatchingOutputDirs = async (titleSuffix: string): Promise<string[]> => {
  const sanitizedSuffix = sanitizeOutputSuffix(titleSuffix)

  try {
    const entries = await readdir(OUTPUT_DIR, { withFileTypes: true })
    return entries
      .filter(entry => entry.isDirectory() && entry.name.endsWith(`_${sanitizedSuffix}`))
      .map(entry => join(OUTPUT_DIR, entry.name))
  } catch {
    return []
  }
}

export const findLatestDirectory = async (titleSuffix: string): Promise<string | null> => {
  try {
    const directories = await listMatchingOutputDirs(titleSuffix)

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

export const stopLlamaServer = async (): Promise<void> => {
  await Bun.$`pkill -f llama-server`.quiet().nothrow()
  await Bun.sleep(300)
}
