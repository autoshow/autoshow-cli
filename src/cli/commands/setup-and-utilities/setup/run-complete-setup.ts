import { stat, mkdir, rm } from 'node:fs/promises'
import { join } from 'node:path'
import type { RunResult, RunOptions, SetupPlatform } from '~/types'
import type { SetupStepId } from '~/types'
import * as l from '~/utils/logger'
import { createHumanTable, logKeyValueTable, logSingleRowTable } from '~/utils/logger/human-table'
import { SUPPORTED_LLAMA_MODELS, SUPPORTED_KITTEN_TTS_MODELS } from '~/cli/commands/setup-and-utilities/models/model-options'
import { withRetry } from '~/utils/retries'
import { setupYtDependencies } from '~/cli/commands/setup-and-utilities/setup/setup-download/dl-audio/audio'
import { setupWhisper, downloadWhisperModel } from '~/cli/commands/process-steps/step-2-extract/step-2-stt/stt-local/whisper/whisper'
import { checkLlamaInstalled, runLlamaSetup } from '~/cli/commands/process-steps/step-3-write/write-local/llama/llama'
import { setupReverb } from '~/cli/commands/process-steps/step-2-extract/step-2-stt/stt-local/reverb/reverb'
import { defuddleRuntimeDir, setupDefuddleCli } from '~/cli/commands/process-steps/step-2-extract/step-2-url/url-local/defuddle/defuddle-cli'
import { setupCalibreDocumentTools } from '~/cli/commands/setup-and-utilities/setup/setup-download/dl-document/calibre'
import { setupTesseractOcr } from '~/cli/commands/process-steps/step-2-extract/step-2-ocr/ocr-local/tesseract-setup'
import { setupKittenTts } from '~/cli/commands/process-steps/step-4-tts/tts-local/kitten/kitten-tts'
import { ensureLlamaModelDownloaded } from '~/cli/commands/process-steps/step-3-write/write-local/llama/run-llama'
import { ensureKittenTtsSetup } from '~/cli/commands/process-steps/step-4-tts/tts-local/kitten/kitten-tts'
import { logSetupToolStatus } from '~/cli/commands/setup-and-utilities/setup/setup-logging'
import { RUNTIME_BIN_DIR, RUNTIME_DIR, ytDlpManagedBinaryPath } from '~/utils/runtime-paths'
import { installManagedUv, managedUvxPath, resolveUvCommand } from './setup-download/managed-uv'
import { readDependencyMetadata } from './dependency-metadata'
import { isJsonResultActive, l as globalLogger } from '~/utils/logger'
import {
  HOSTED_PROVIDER_ENV_CHECKS,
  logHostedProviderConfiguration,
  type HostedProviderConfigurationSummary
} from './hosted-provider-config'
import {
  checkReverbAsrAssets,
  reverbConfigPath as reverbConfigPathFromAssets,
  reverbDiarizationDir as reverbDiarizationDirFromAssets,
  reverbDiarizationEmbeddingDir as reverbDiarizationEmbeddingDirFromAssets,
  reverbModelDir as reverbModelDirFromAssets,
  reverbModelPath as reverbModelPathFromAssets
} from '~/cli/commands/process-steps/step-2-extract/step-2-stt/stt-local/reverb/reverb-assets'

const RUNTIME = RUNTIME_DIR

export const whisperBinaryPath = join(RUNTIME, 'bin/whisper-cli')
export const llamaBinaryPath = join(RUNTIME, 'bin/llama-server')
export const whisperLibDir = join(RUNTIME, 'bin/lib')
export const whisperCoremlEnvDir = join(RUNTIME, 'bin/whisper-coreml-env')
export const reverbUvEnvDir = join(RUNTIME, 'bin/reverb')
export const kittenTtsUvEnvDir = join(RUNTIME, 'bin/kitten-tts')
export const paddleOcrUvEnvDir = join(RUNTIME, 'bin/paddle-ocr')
export const whisperBuildDir = join(RUNTIME, 'build/whisper.cpp')
export const whisperModelsDir = join(RUNTIME, 'models/whisper')
export const llamaModelsDir = join(RUNTIME, 'models/llama')
export const reverbModelDir = reverbModelDirFromAssets
export const reverbModelPath = reverbModelPathFromAssets
export const reverbConfigPath = reverbConfigPathFromAssets
export const reverbDiarizationDir = reverbDiarizationDirFromAssets
export const reverbDiarizationEmbeddingDir = reverbDiarizationEmbeddingDirFromAssets
const mergeEnv = (env?: Record<string, string | undefined>): Record<string, string | undefined> =>
  env ? { ...(process.env as Record<string, string | undefined>), ...env } : process.env as Record<string, string | undefined>

const readStream = async (stream: ReadableStream<Uint8Array> | null | undefined): Promise<string> =>
  stream ? await new Response(stream).text() : ''

const fmtCmd = (command: string, args: string[]): string => [command, ...args].join(' ').trim()
const SETUP_OUTPUT_TAIL_LINES = 40
const SETUP_OUTPUT_TAIL_CHARS = 6000

export const formatSetupOutputTail = (stdout: string, stderr: string): string => {
  const combined = [
    stderr.trim().length > 0 ? `stderr:\n${stderr.trim()}` : '',
    stdout.trim().length > 0 ? `stdout:\n${stdout.trim()}` : ''
  ].filter(Boolean).join('\n\n')

  if (combined.trim().length === 0) {
    return ''
  }

  const lines = combined.split('\n')
  const lineTail = lines.slice(-SETUP_OUTPUT_TAIL_LINES).join('\n')
  return lineTail.length > SETUP_OUTPUT_TAIL_CHARS
    ? lineTail.slice(lineTail.length - SETUP_OUTPUT_TAIL_CHARS)
    : lineTail
}

const formatCommandFailure = (command: string, args: string[], result: RunResult): string => {
  const tail = formatSetupOutputTail(result.stdout, result.stderr)
  return tail.length > 0
    ? `Command failed (${fmtCmd(command, args)}): exit code ${result.exitCode}\n${tail}`
    : `Command failed (${fmtCmd(command, args)}): exit code ${result.exitCode}`
}

const shouldUseCompactSetup = (): boolean =>
  (process.env['AUTOSHOW_COMPACT_SETUP'] || '0') === '1'

const shouldUseVerboseHumanOutput = (): boolean =>
  globalLogger.config.minLevel === 'debug' && !isJsonResultActive()

const shouldStreamCompactSetupOutput = (): boolean =>
  shouldUseCompactSetup()
  && shouldUseVerboseHumanOutput()

export const runCapture = async (command: string, args: string[] = [], options: RunOptions = {}): Promise<RunResult> => {
  const proc = Bun.spawn([command, ...args], {
    ...(options.cwd ? { cwd: options.cwd } : {}),
    env: mergeEnv(options.env),
    stdout: 'pipe',
    stderr: 'pipe'
  })
  const [stdout, stderr, exitCode] = await Promise.all([
    readStream(proc.stdout), readStream(proc.stderr), proc.exited
  ])
  const result: RunResult = { stdout, stderr, exitCode }
  if (exitCode !== 0 && !options.allowFailure) {
    throw new Error(formatCommandFailure(command, args, result))
  }
  return result
}

export const runInherit = async (command: string, args: string[] = [], options: RunOptions = {}): Promise<number> => {
  if (shouldUseCompactSetup() && !shouldStreamCompactSetupOutput()) {
    const result = await runCapture(command, args, { ...options, allowFailure: true })
    if (result.exitCode !== 0 && !options.allowFailure) {
      throw new Error(formatCommandFailure(command, args, result))
    }
    return result.exitCode
  }

  const proc = Bun.spawn([command, ...args], {
    ...(options.cwd ? { cwd: options.cwd } : {}),
    env: mergeEnv(options.env),
    stdin: 'inherit', stdout: 'inherit', stderr: 'inherit'
  })
  const exitCode = await proc.exited
  if (exitCode !== 0 && !options.allowFailure) {
    throw new Error(`Command failed (${fmtCmd(command, args)}): exit code ${exitCode}`)
  }
  return exitCode
}

export const requireUvCommand = async (): Promise<string> => {
  const command = await resolveUvCommand()
  if (command) return command
  throw new Error('uv is not available. Run `bun as setup --step uv` to install AutoShow managed uv.')
}

export const runUvCapture = async (args: string[] = [], options: RunOptions = {}): Promise<RunResult> => {
  const command = await requireUvCommand()
  return await runCapture(command, args, options)
}

export const runUvInherit = async (args: string[] = [], options: RunOptions = {}): Promise<number> => {
  const command = await requireUvCommand()
  return await runInherit(command, args, options)
}

export const commandExists = (command: string): boolean => {
  const resolved = Bun.which(command)
  return typeof resolved === 'string' && resolved.length > 0
}

export const pathExists = async (path: string): Promise<boolean> => {
  try { await stat(path); return true } catch { return false }
}

export const detectPlatform = (): SetupPlatform => {
  if (process.platform === 'darwin') return 'darwin'
  if (process.platform === 'linux') return 'linux'
  return 'unknown'
}

export const detectArchitecture = (): string => {
  if (process.arch === 'x64') return 'x86_64'
  if (process.arch === 'arm64') return 'arm64'
  return process.arch
}

export const supportsCoreML = async (): Promise<boolean> => {
  if (!(detectPlatform() === 'darwin' && detectArchitecture() === 'arm64')) return false
  const result = await runCapture('xcrun', ['--sdk', 'macosx', '--show-sdk-path'], { allowFailure: true })
  return result.exitCode === 0
}

export const setupUv = async (): Promise<void> => {
  const pathUv = Bun.which('uv')
  if (pathUv) {
    return
  }
  const managedUv = await resolveUvCommand()
  if (managedUv && await pathExists(managedUvxPath)) {
    return
  }
  logSetupToolStatus(l, { tool: 'uv', status: 'installing' })
  await withRetry(
    { retryClass: 'setup_download', operationName: 'uv-release' },
    async () => {
      await installManagedUv()
    }
  )
  logSetupToolStatus(l, { tool: 'uv', status: 'installed' })
}

export const defaultWhisperModel = 'tiny'
export const defaultLlamaModel = 'ggml-org/gemma-3-270m-it-GGUF'

const withCompactSetup = async (fn: () => Promise<void>): Promise<void> => {
  const previous = process.env['AUTOSHOW_COMPACT_SETUP']
  process.env['AUTOSHOW_COMPACT_SETUP'] = '1'
  try { await fn() } finally {
    if (previous === undefined) delete process.env['AUTOSHOW_COMPACT_SETUP']
    else process.env['AUTOSHOW_COMPACT_SETUP'] = previous
  }
}

const ensureRuntimeDirs = async (): Promise<void> => {
  await Promise.all([
    mkdir(RUNTIME_BIN_DIR, { recursive: true }),
    mkdir(whisperBuildDir, { recursive: true }),
    mkdir(whisperModelsDir, { recursive: true }),
    mkdir(llamaModelsDir, { recursive: true }),
    mkdir(reverbUvEnvDir, { recursive: true }).catch(() => undefined),
    mkdir(reverbModelDir, { recursive: true }).catch(() => undefined),
    mkdir(reverbDiarizationDir, { recursive: true }).catch(() => undefined),
    mkdir(reverbDiarizationEmbeddingDir, { recursive: true }).catch(() => undefined)
  ])
}

const logPinnedVersions = async (): Promise<void> => {
  try {
    const deps = await readDependencyMetadata()
    const formatVersion = (value: string): string =>
      /^[a-f0-9]{40}$/i.test(value) ? value.slice(0, 12) : value
    logKeyValueTable(l, 'Pinned Versions', [
      ['whisper.cpp', formatVersion(deps['whisper.cpp']?.tag ?? 'unknown')],
      ['llama.cpp', formatVersion(deps['llama.cpp']?.tag ?? 'unknown')],
      ['uv', formatVersion(deps['uv']?.version ?? 'unknown')],
      ['reverb', formatVersion(deps['reverb']?.ref ?? 'unknown')]
    ], { category: 'command', keyLabel: 'dependency', valueLabel: 'version' })
  } catch { l.warn('Could not read config/deps.json') }
}

const validateBinary = async (name: string, path: string, args: string[]): Promise<void> => {
  if (!await pathExists(path)) { l.warn(`${name}: not found at ${path}`); return }
  try {
    const result = await runCapture(path, args, { allowFailure: true })
    if (result.exitCode === 0 || result.exitCode === 1) {
      logSetupToolStatus(l, { tool: name, status: 'ready', detail: path })
    } else l.warn(`${name}: installed but exited ${result.exitCode} (may still work)`)
  } catch (err) {
    l.warn(`${name}: could not execute — ${err instanceof Error ? err.message : String(err)}`)
  }
}

const TRANSCRIPTION_PROVIDER_ENV_KEYS = [
  'OPENAI_API_KEY',
  'GEMINI_API_KEY',
  'GLM_API_KEY',
  'TOGETHER_API_KEY',
  'XAI_API_KEY',
  'MISTRAL_API_KEY',
  'ELEVENLABS_API_KEY',
  'DEEPGRAM_API_KEY',
  'SONIOX_API_KEY',
  'SPEECHMATICS_API_KEY',
  'REVAI_ACCESS_TOKEN',
  'ASSEMBLYAI_API_KEY',
  'GLADIA_API_KEY',
  'SUPADATA_API_KEY',
  'SCRAPECREATORS_API_KEY',
  'GROQ_API_KEY',
  'DEEPINFRA_API_KEY',
  'HAPPYSCRIBE_API_KEY',
  'HUGGINGFACE_TOKEN'
] as const

const WRITE_PROVIDER_ENV_KEYS = [
  'OPENAI_API_KEY',
  'XAI_API_KEY',
  'GEMINI_API_KEY',
  'GLM_API_KEY',
  'KIMI_API_KEY',
  'ANTHROPIC_API_KEY',
  'GROQ_API_KEY',
  'MINIMAX_API_KEY'
] as const

const TTS_PROVIDER_ENV_KEYS = [
  'OPENAI_API_KEY',
  'ELEVENLABS_API_KEY',
  'GROQ_API_KEY',
  'XAI_API_KEY',
  'MISTRAL_API_KEY',
  'GEMINI_API_KEY',
  'DEEPGRAM_API_KEY',
  'SPEECHIFY_API_KEY',
  'HUME_API_KEY',
  'CARTESIA_API_KEY',
  'MINIMAX_API_KEY'
] as const

const IMAGE_PROVIDER_ENV_KEYS = [
  'OPENAI_API_KEY',
  'GEMINI_API_KEY',
  'XAI_API_KEY',
  'BFL_API_KEY',
  'REVE_API_KEY',
  'GLM_API_KEY'
] as const

const VIDEO_PROVIDER_ENV_KEYS = [
  'GEMINI_API_KEY',
  'MINIMAX_API_KEY',
  'GLM_API_KEY',
  'XAI_API_KEY',
  'RUNWAYML_API_SECRET'
] as const

const MUSIC_PROVIDER_ENV_KEYS = [
  'GEMINI_API_KEY',
  'ELEVENLABS_API_KEY',
  'MINIMAX_API_KEY'
] as const

const ALL_PROVIDER_ENV_KEYS = HOSTED_PROVIDER_ENV_CHECKS.map(check => check.envVar)

const logSetupProviderConfiguration = (
  title: string,
  envVars: readonly string[] = ALL_PROVIDER_ENV_KEYS
): HostedProviderConfigurationSummary =>
  logHostedProviderConfiguration(l, {
    title,
    envVars,
    mode: shouldUseVerboseHumanOutput() ? 'all' : 'missing'
  })

export const downloadKittenTtsModel = async (
  model: string,
  options: { pythonPath?: string } = {}
): Promise<void> => {
  const kittenPython = options.pythonPath ?? `${kittenTtsUvEnvDir}/bin/python`
  if (!await pathExists(kittenPython)) { l.warn(`Kitten TTS venv not found, skipping model download: ${model}`); return }
  logSetupToolStatus(l, { tool: 'kitten-tts', status: 'downloading', detail: model })
  const result = await runCapture(
    kittenPython,
    ['-c', `from kittentts import KittenTTS; KittenTTS("${model}")`],
    { allowFailure: true }
  )
  if (result.exitCode !== 0) {
    throw new Error(`Kitten TTS model download failed for ${model}: ${formatCommandFailure(kittenPython, ['-c', 'from kittentts import KittenTTS; KittenTTS("<model>")'], result)}`)
  }
  logSetupToolStatus(l, { tool: 'kitten-tts', status: 'ready', detail: model })
}

const formatElapsed = (elapsedMs: number): string => {
  if (elapsedMs < 1000) return `${elapsedMs}ms`
  return `${(elapsedMs / 1000).toFixed(1)}s`
}

const logSetupSummary = async (
  startedAtMs: number,
  providerSummary: HostedProviderConfigurationSummary
): Promise<void> => {
  const localToolChecks = [
    ['whisper-cli', await pathExists(whisperBinaryPath)] as const,
    ['llama-server', await pathExists(llamaBinaryPath)] as const,
    ['Kitten TTS env', await pathExists(`${kittenTtsUvEnvDir}/bin/python`)] as const
  ]
  const localModelChecks = [
    [`whisper ${defaultWhisperModel}`, await pathExists(`${whisperModelsDir}/ggml-${defaultWhisperModel}.bin`)] as const,
    ['Reverb ASR', await checkReverbAsrAssets()] as const
  ]
  const missingTools = localToolChecks.filter(([, ok]) => !ok).map(([name]) => name)
  const missingModels = localModelChecks.filter(([, ok]) => !ok).map(([name]) => name)

  l.write(missingTools.length === 0 && missingModels.length === 0 ? 'success' : 'warn', 'Setup Summary', {
    category: 'command',
    humanTable: createHumanTable([
      {
        item: 'elapsed',
        status: formatElapsed(Date.now() - startedAtMs),
        detail: ''
      },
      {
        item: 'local tools',
        status: missingTools.length === 0 ? 'ready' : 'missing',
        detail: missingTools.length === 0 ? 'all checked tools available' : missingTools.join(', ')
      },
      {
        item: 'local models',
        status: missingModels.length === 0 ? 'ready' : 'missing',
        detail: missingModels.length === 0 ? 'default local assets available' : missingModels.join(', ')
      },
      {
        item: 'hosted providers',
        status: `${providerSummary.configured}/${providerSummary.total} configured`,
        detail: providerSummary.missing === 0 ? 'all env vars set' : `${providerSummary.missing} missing`
      },
      {
        item: 'validation',
        status: 'next',
        detail: 'bun as setup --doctor'
      }
    ], ['item', 'status', 'detail'])
  })
}

const runFullSetup = async (): Promise<void> => {
  const startedAtMs = Date.now()
  l.write('info', 'Starting complete AutoShow setup')
  await logPinnedVersions()
  await ensureRuntimeDirs()

  await withCompactSetup(setupYtDependencies)

  await withCompactSetup(setupDefuddleCli)

  await withCompactSetup(setupWhisper)

  await withCompactSetup(runLlamaSetup)

  await withCompactSetup(async () => { await downloadWhisperModel(defaultWhisperModel) })

  if (await checkLlamaInstalled()) {
    await withCompactSetup(async () => { await ensureLlamaModelDownloaded(defaultLlamaModel) })
  } else { l.warn('llama.cpp not available, skipping model download') }

  const providerSummary = logSetupProviderConfiguration('Hosted Provider Configuration')

  await withCompactSetup(setupReverb)

  await withCompactSetup(setupCalibreDocumentTools)

  await withCompactSetup(setupTesseractOcr)

  await withCompactSetup(setupKittenTts)

  await withCompactSetup(async () => { await downloadKittenTtsModel('kitten-tts-nano-0.8-int8') })

  await validateBinary('whisper-cli', whisperBinaryPath, ['--help'])
  await validateBinary('llama-server', llamaBinaryPath, ['--version'])

  await logSetupSummary(startedAtMs, providerSummary)

  l.write('info', 'You can now run: bun as "https://www.youtube.com/watch?v=u1-WHqATSQU"')
}

export const runCompleteSetup = async (): Promise<void> => { await runFullSetup() }

const runSetupTranscription = async (): Promise<void> => {
  await downloadWhisperModel('large-v3-turbo')
  await setupReverb()
  logSetupProviderConfiguration('Transcription Provider Configuration', TRANSCRIPTION_PROVIDER_ENV_KEYS)
  l.write('success', 'Transcription setup complete')
}

const runSetupWrite = async (): Promise<void> => {
  if (!await checkLlamaInstalled()) await runLlamaSetup()
  for (const model of SUPPORTED_LLAMA_MODELS) await ensureLlamaModelDownloaded(model)
  logSetupProviderConfiguration('Write Provider Configuration', WRITE_PROVIDER_ENV_KEYS)
  l.write('success', 'Write setup complete')
}

const runSetupTts = async (): Promise<void> => {
  await ensureKittenTtsSetup()
  for (const model of SUPPORTED_KITTEN_TTS_MODELS) await downloadKittenTtsModel(model)
  logSetupProviderConfiguration('TTS Provider Configuration', TTS_PROVIDER_ENV_KEYS)
  l.write('success', 'TTS setup complete')
}

const runSetupImage = async (): Promise<void> => {
  logSetupProviderConfiguration('Image Provider Configuration', IMAGE_PROVIDER_ENV_KEYS)
  l.write('success', 'Image setup complete (all image providers are API-based)')
}

const runSetupVideo = async (): Promise<void> => {
  logSetupProviderConfiguration('Video Provider Configuration', VIDEO_PROVIDER_ENV_KEYS)
  l.write('success', 'Video setup complete (all video providers are API-based)')
}

const runSetupMusic = async (): Promise<void> => {
  logSetupProviderConfiguration('Music Provider Configuration', MUSIC_PROVIDER_ENV_KEYS)
  const requiredTools = ['ffmpeg', 'ffprobe']
  const missing = requiredTools.filter((tool) => !commandExists(tool))
  if (missing.length > 0) {
    throw new Error(
      `Music lyric-video setup: missing required tools: ${missing.join(', ')}. Install them via your system package manager or run: bun as setup`
    )
  }

  const ffmpegFilters = await runCapture('ffmpeg', ['-hide_banner', '-filters'], { allowFailure: true })
  const hasAssFilter = ffmpegFilters.exitCode === 0
    && ffmpegFilters.stdout.split('\n').some((line) => line.trim().split(/\s+/).includes('ass'))
  const hasFallbackRenderer = commandExists('pango-view') && commandExists('convert')
  if (!hasAssFilter && !hasFallbackRenderer) {
    throw new Error(
      'Music lyric-video setup: ffmpeg does not expose the ass filter, and the fallback renderer is unavailable. Install pango-view plus ImageMagick, or use an ffmpeg build with ass support.'
    )
  }

  await setupWhisper()
  await downloadWhisperModel('large-v3-turbo')
  l.write('success', 'Music setup complete')
}

const computeMedian = (values: number[]): number => {
  if (values.length === 0) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0 ? Math.round((sorted[mid - 1]! + sorted[mid]!) / 2) : sorted[mid]!
}

const computeP90 = (values: number[]): number => {
  if (values.length === 0) return 0
  const sorted = [...values].sort((a, b) => a - b)
  return sorted[Math.max(0, Math.min(sorted.length - 1, Math.ceil(0.9 * sorted.length) - 1))]!
}

const logBenchmarkResults = (stepLabel: string, runs: number, results: Map<string, number[]>): void => {
  const rows = [...results.entries()].map(([engine, durations]) => {
    const median = computeMedian(durations)
    const p90 = computeP90(durations)
    return {
      engine,
      medianMs: median,
      p90Ms: p90,
      minMs: Math.min(...durations),
      maxMs: Math.max(...durations),
      outliers: durations.filter(v => v > p90).length
    }
  })

  l.write('info', `Setup Benchmark (${stepLabel}, ${runs} run${runs > 1 ? 's' : ''})`, {
    category: 'command',
    humanTable: createHumanTable(rows, ['engine', 'medianMs', 'p90Ms', 'minMs', 'maxMs', 'outliers']),
    metadata: { step: stepLabel, runs, results: rows }
  })
}

const getForceRedownloadPaths = (step: SetupStepId): readonly string[] => {
  const whisperModelPath = `${whisperModelsDir}/ggml-${defaultWhisperModel}.bin`
  const lyricsWhisperModelPath = `${whisperModelsDir}/ggml-large-v3-turbo.bin`
  switch (step) {
    case 'whisper-binary': return [whisperBinaryPath, whisperBuildDir]
    case 'whisper-model': return [whisperModelPath]
    case 'llama-binary': return [llamaBinaryPath]
    case 'reverb': return [reverbModelDir, reverbDiarizationDir, reverbDiarizationEmbeddingDir]
    case 'defuddle': return [defuddleRuntimeDir]
    case 'music': return [whisperBinaryPath, whisperBuildDir, lyricsWhisperModelPath]
    case 'all': return [whisperModelPath, llamaBinaryPath]
    case 'yt-dlp': return [ytDlpManagedBinaryPath]
    case 'uv': case 'calibre': case 'transcription': case 'write': case 'tts': case 'image': case 'video': return []
    default: { const exhaustive: never = step; throw new Error(`Unknown setup step: ${exhaustive}`) }
  }
}

const applyRunOptions = async (step: SetupStepId, options?: { forceRedownload?: boolean }): Promise<void> => {
  if (!options?.forceRedownload) return
  const paths = getForceRedownloadPaths(step)
  if (paths.length === 0) return
  await Promise.all(paths.map(p => rm(p, { recursive: true, force: true })))
  logSingleRowTable(l, 'Force Redownload', {
    step,
    clearedArtifacts: paths.length
  }, { category: 'artifact', columns: ['step', 'clearedArtifacts'] })
}

const executeStepOnce = async (step: SetupStepId): Promise<void> => {
  switch (step) {
    case 'all': await runCompleteSetup(); return
    case 'uv': await setupUv(); return
    case 'yt-dlp': await setupYtDependencies(); return
    case 'whisper-binary': await setupWhisper(); return
    case 'whisper-model': await downloadWhisperModel(defaultWhisperModel); return
    case 'llama-binary': await runLlamaSetup(); return
    case 'reverb': await setupReverb(); return
    case 'defuddle': await setupDefuddleCli(); return
    case 'calibre': await setupCalibreDocumentTools(); return
    case 'transcription': await runSetupTranscription(); return
    case 'write': await runSetupWrite(); return
    case 'tts': await runSetupTts(); return
    case 'image': await runSetupImage(); return
    case 'video': await runSetupVideo(); return
    case 'music': await runSetupMusic(); return
    default: { const exhaustive: never = step; throw new Error(`Unknown setup step: ${exhaustive}`) }
  }
}

export const runSetupStep = async (step: SetupStepId, options?: { forceRedownload?: boolean, repeat?: number }): Promise<void> => {
  const repeat = options?.repeat ?? 1
  await ensureRuntimeDirs()

  if (repeat <= 1) {
    await applyRunOptions(step, options)
    await executeStepOnce(step)
    return
  }

  const label = 'auto'
  const timings = new Map<string, number[]>([[label, []]])
  for (let i = 0; i < repeat; i++) {
    await applyRunOptions(step, options)
    const start = Date.now()
    await executeStepOnce(step)
    const duration = Date.now() - start
    timings.get(label)!.push(duration)
    l.write('info', `Run ${i + 1}/${repeat} (${label}): ${duration}ms`)
  }

  logBenchmarkResults(step, repeat, timings)
}
