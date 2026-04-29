import { stat, mkdir, rm } from 'node:fs/promises'
import { resolve, join } from 'node:path'
import * as v from 'valibot'
import type { RunResult, RunOptions, SetupPlatform } from '~/types'
import type { SetupStepId } from '~/types'
import { downloadFile, consumeDownloadFallbackEvents } from '~/cli/commands/setup-and-utilities/setup/setup-download/download'
import * as l from '~/utils/logger'
import { createHumanTable, logKeyValueTable, logSingleRowTable } from '~/utils/logger/human-table'
import { SUPPORTED_LLAMA_MODELS, SUPPORTED_KITTEN_TTS_MODELS } from '~/cli/commands/setup-and-utilities/models/model-options'
import { withRetry } from '~/utils/retries'
import { validateJson } from '~/utils/validate/validation'
import { setupYtDependencies } from '~/cli/commands/setup-and-utilities/setup/setup-download/dl-audio/audio'
import { setupWhisper, downloadWhisperModel } from '~/cli/commands/process-steps/step-2-extract/step-2-stt/stt-local/whisper/whisper'
import { checkLlamaInstalled, runLlamaSetup } from '~/cli/commands/process-steps/step-3-write/write-local/llama/llama'
import { setupReverb } from '~/cli/commands/process-steps/step-2-extract/step-2-stt/stt-local/reverb/reverb'
import { setupElevenLabsStt } from '~/cli/commands/process-steps/step-2-extract/step-2-stt/stt-services/elevenlabs/elevenlabs'
import { setupDeepgramStt } from '~/cli/commands/process-steps/step-2-extract/step-2-stt/stt-services/deepgram/deepgram'
import { setupSonioxStt } from '~/cli/commands/process-steps/step-2-extract/step-2-stt/stt-services/soniox/soniox'
import { setupSpeechmaticsStt } from '~/cli/commands/process-steps/step-2-extract/step-2-stt/stt-services/speechmatics/speechmatics'
import { setupRevStt } from '~/cli/commands/process-steps/step-2-extract/step-2-stt/stt-services/rev/rev'
import { setupGrokStt } from '~/cli/commands/process-steps/step-2-extract/step-2-stt/stt-services/grok/grok-stt'
import { setupMistralStt } from '~/cli/commands/process-steps/step-2-extract/step-2-stt/stt-services/mistral/mistral'
import { setupOpenaiStt } from '~/cli/commands/process-steps/step-2-extract/step-2-stt/stt-services/openai-stt/openai-stt'
import { setupGeminiStt } from '~/cli/commands/process-steps/step-2-extract/step-2-stt/stt-services/gemini-stt/gemini-stt'
import { setupGlmStt } from '~/cli/commands/process-steps/step-2-extract/step-2-stt/stt-services/glm-stt/glm-stt'
import { setupTogetherStt } from '~/cli/commands/process-steps/step-2-extract/step-2-stt/stt-services/together/together'
import { setupFireworksStt } from '~/cli/commands/process-steps/step-2-extract/step-2-stt/stt-services/fireworks/fireworks'
import { setupCloudflareStt } from '~/cli/commands/process-steps/step-2-extract/step-2-stt/stt-services/cloudflare/cloudflare'
import { setupAssemblyAiStt } from '~/cli/commands/process-steps/step-2-extract/step-2-stt/stt-services/assemblyai/assemblyai'
import { setupGladiaStt } from '~/cli/commands/process-steps/step-2-extract/step-2-stt/stt-services/gladia/gladia'
import { setupSupadataStt } from '~/cli/commands/process-steps/step-2-extract/step-2-stt/stt-services/supadata/supadata'
import { readAwsSttConfigDefaults, setupAwsStt } from '~/cli/commands/process-steps/step-2-extract/step-2-stt/stt-services/aws/aws'
import { setupCalibreDocumentTools } from '~/cli/commands/setup-and-utilities/setup/setup-download/dl-document/calibre'
import { setupTesseractOcr } from '~/cli/commands/process-steps/step-2-extract/step-2-ocr/ocr-local/tesseract-setup'
import { setupMistralOcr } from '~/cli/commands/process-steps/step-2-extract/step-2-ocr/ocr-services/mistral-ocr/mistral'
import { setupGlmOcr } from '~/cli/commands/process-steps/step-2-extract/step-2-ocr/ocr-services/glm-ocr/glm'
import { setupGeminiOcr } from '~/cli/commands/process-steps/step-2-extract/step-2-ocr/ocr-services/gemini-ocr/gemini'
import { setupOpenAIOcr } from '~/cli/commands/process-steps/step-2-extract/step-2-ocr/ocr-services/openai-ocr/openai-ocr'
import { setupAnthropicOcr } from '~/cli/commands/process-steps/step-2-extract/step-2-ocr/ocr-services/anthropic-ocr/anthropic-ocr'
import { setupDeepinfraOcr } from '~/cli/commands/process-steps/step-2-extract/step-2-ocr/ocr-services/deepinfra-ocr/deepinfra-ocr'
import { setupDeapiOcr } from '~/cli/commands/process-steps/step-2-extract/step-2-ocr/ocr-services/deapi-ocr/deapi-ocr'
import { setupKittenTts } from '~/cli/commands/process-steps/step-4-tts/tts-local/kitten/kitten-tts'
import { setupElevenLabsTts } from '~/cli/commands/process-steps/step-4-tts/tts-services/elevenlabs/elevenlabs-tts'
import { setupGroqTts } from '~/cli/commands/process-steps/step-4-tts/tts-services/groq/groq-tts'
import { setupGrokTts } from '~/cli/commands/process-steps/step-4-tts/tts-services/grok/grok-tts'
import { setupOpenAITts } from '~/cli/commands/process-steps/step-4-tts/tts-services/openai/openai-tts'
import { setupGeminiTts } from '~/cli/commands/process-steps/step-4-tts/tts-services/gemini/gemini-tts'
import { setupDeepgramTts } from '~/cli/commands/process-steps/step-4-tts/tts-services/deepgram/deepgram-tts'
import { setupRunwayTts } from '~/cli/commands/process-steps/step-4-tts/tts-services/runway/runway-tts'
import { setupDeapiTts } from '~/cli/commands/process-steps/step-4-tts/tts-services/deapi/deapi-tts'
import { setupGeminiImageGen } from '~/cli/commands/process-steps/step-5-image/image-services/gemini/gemini-image-gen'
import { setupDeapiImageGen } from '~/cli/commands/process-steps/step-5-image/image-services/deapi/deapi-image-gen'
import { setupGrokImageGen } from '~/cli/commands/process-steps/step-5-image/image-services/grok/grok-image-gen'
import { setupOpenAIImageGen } from '~/cli/commands/process-steps/step-5-image/image-services/openai/openai-image-gen'
import { setupRunwayImageGen } from '~/cli/commands/process-steps/step-5-image/image-services/runway/runway-image-gen'
import { setupBflImageGen } from '~/cli/commands/process-steps/step-5-image/image-services/bfl/bfl-image-gen'
import { setupDeapiVideoGen } from '~/cli/commands/process-steps/step-6-video/video-services/deapi/deapi-video-gen'
import { setupElevenLabsMusicGen } from '~/cli/commands/process-steps/step-7-music/music-services/elevenlabs/elevenlabs-music-gen'
import { setupMinimaxMusicGen } from '~/cli/commands/process-steps/step-7-music/music-services/minimax/minimax-music-gen'
import { setupDeapiMusicGen } from '~/cli/commands/process-steps/step-7-music/music-services/deapi/deapi-music-gen'
import { setupGeminiMusicGen } from '~/cli/commands/process-steps/step-7-music/music-services/gemini/gemini-music-gen'
import { ensureLlamaModelDownloaded } from '~/cli/commands/process-steps/step-3-write/write-local/llama/run-llama'
import { ensureKittenTtsSetup } from '~/cli/commands/process-steps/step-4-tts/tts-local/kitten/kitten-tts'
import { logSetupToolStatus } from '~/cli/commands/setup-and-utilities/setup/setup-logging'

const PROJECT_ROOT = resolve(import.meta.dir, '../../../../../')
const RUNTIME = join(PROJECT_ROOT, 'runtime')

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
export const reverbModelDir = join(RUNTIME, 'models/reverb/reverb_asr_v1')
export const reverbModelPath = join(reverbModelDir, 'reverb_asr_v1.pt')
export const reverbConfigPath = join(reverbModelDir, 'config.yaml')
export const reverbDiarizationDir = join(RUNTIME, 'models/reverb/diarization-v2')
const mergeEnv = (env?: Record<string, string | undefined>): Record<string, string | undefined> =>
  env ? { ...(process.env as Record<string, string | undefined>), ...env } : process.env as Record<string, string | undefined>

const readStream = async (stream: ReadableStream<Uint8Array> | null | undefined): Promise<string> =>
  stream ? await new Response(stream).text() : ''

const fmtCmd = (command: string, args: string[]): string => [command, ...args].join(' ').trim()

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
    const details = result.stderr.trim() || result.stdout.trim() || `exit code ${result.exitCode}`
    throw new Error(`Command failed (${fmtCmd(command, args)}): ${details}`)
  }
  return result
}

export const runInherit = async (command: string, args: string[] = [], options: RunOptions = {}): Promise<number> => {
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
  if (commandExists('uv')) {
    return
  }
  logSetupToolStatus(l, { tool: 'uv', status: 'installing' })
  if (detectPlatform() === 'darwin' && commandExists('brew')) {
    await runInherit('brew', ['install', 'uv'])
  } else {
    await withRetry(
      { retryClass: 'setup_download', operationName: 'uv-installer' },
      async () => {
        await downloadFile({
          url: 'https://astral.sh/uv/install.sh',
          destination: '/tmp/uv-install.sh',
          mode: 'script-installer',
          flowId: 'uv-installer'
        })
      }
    )
  }
  logSetupToolStatus(l, { tool: 'uv', status: 'installed' })
}

export const defaultWhisperModel = 'tiny'
export const defaultLlamaModel = 'ggml-org/gemma-3-270m-it-GGUF'

const DepsEntrySchema = v.object({ tag: v.optional(v.string(), undefined) })
const DepsJsonSchema = v.record(v.string(), DepsEntrySchema)
const depsJsonPath = resolve(import.meta.dir, '../../../../../config/deps.json')

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
    mkdir(whisperBinaryPath.replace(/\/whisper-cli$/, ''), { recursive: true }),
    mkdir(whisperBuildDir, { recursive: true }),
    mkdir(whisperModelsDir, { recursive: true }),
    mkdir(llamaModelsDir, { recursive: true }),
    mkdir(reverbUvEnvDir, { recursive: true }).catch(() => undefined),
    mkdir(reverbModelDir, { recursive: true }).catch(() => undefined),
    mkdir(reverbDiarizationDir, { recursive: true }).catch(() => undefined),
  ])
}

const logPinnedVersions = async (): Promise<void> => {
  try {
    const raw = await Bun.file(depsJsonPath).text()
    const deps = validateJson(DepsJsonSchema, raw, 'config/deps.json')
    logKeyValueTable(l, 'Pinned Versions', [
      ['whisper.cpp', deps['whisper.cpp']?.tag ?? 'unknown'],
      ['llama.cpp', deps['llama.cpp']?.tag ?? 'unknown']
    ], { category: 'command', keyLabel: 'dependency', valueLabel: 'version' })
  } catch { l.warn('Could not read config/deps.json') }
}

const validateBinary = async (name: string, path: string, args: string[]): Promise<void> => {
  if (!await pathExists(path)) { l.warn(`${name}: not found at ${path}`); return }
  try {
    const result = await runCapture(path, args, { allowFailure: true })
    if (result.exitCode === 0 || result.exitCode === 1) {
      logSetupToolStatus(l, { tool: name, status: 'ok', detail: path })
    } else l.warn(`${name}: installed but exited ${result.exitCode} (may still work)`)
  } catch (err) {
    l.warn(`${name}: could not execute — ${err instanceof Error ? err.message : String(err)}`)
  }
}

const setupHostedVideoApiKey = async (
  envKey: string,
  providerName: string
): Promise<void> => {
  const apiKey = process.env[envKey]
  if (apiKey && apiKey.length > 0) {
    l.write('success', `${envKey} found — ${providerName} video generation ready`)
  } else {
    l.warn(`${envKey} not set — ${providerName} video generation will not work until set`)
    l.write('info', `Set ${envKey} environment variable to use ${providerName} video models`)
  }
}

const setupGeminiVideoGen = async (): Promise<void> => setupHostedVideoApiKey('GEMINI_API_KEY', 'Gemini')
const setupMinimaxVideoGen = async (): Promise<void> => setupHostedVideoApiKey('MINIMAX_API_KEY', 'MiniMax')
const setupGlmVideoGen = async (): Promise<void> => setupHostedVideoApiKey('GLM_API_KEY', 'GLM')
const setupGrokVideoGen = async (): Promise<void> => setupHostedVideoApiKey('XAI_API_KEY', 'Grok')
const setupRunwayVideoGen = async (): Promise<void> => setupHostedVideoApiKey('RUNWAYML_API_SECRET', 'Runway')

const downloadKittenTtsModel = async (model: string): Promise<void> => {
  const kittenPython = `${kittenTtsUvEnvDir}/bin/python`
  if (!await pathExists(kittenPython)) { l.warn(`Kitten TTS venv not found, skipping model download: ${model}`); return }
  logSetupToolStatus(l, { tool: 'kitten-tts', status: 'downloading', detail: model })
  await runCapture(kittenPython, ['-c', `from kittentts import KittenTTS; KittenTTS("${model}")`], { allowFailure: true })
  logSetupToolStatus(l, { tool: 'kitten-tts', status: 'ready', detail: model })
}

const runFullSetup = async (): Promise<void> => {
  l.write('info', 'Starting complete AutoShow setup')
  await logPinnedVersions()
  await ensureRuntimeDirs()
  const awsDefaults = await readAwsSttConfigDefaults()

  await withCompactSetup(setupYtDependencies)

  await withCompactSetup(setupWhisper)

  await withCompactSetup(runLlamaSetup)

  await withCompactSetup(async () => { await downloadWhisperModel(defaultWhisperModel) })

  if (await checkLlamaInstalled()) {
    await withCompactSetup(async () => { await ensureLlamaModelDownloaded(defaultLlamaModel) })
  } else { l.warn('llama.cpp not available, skipping model download') }

  await withCompactSetup(setupReverb)

  await withCompactSetup(setupElevenLabsStt)

  await withCompactSetup(setupDeepgramStt)

  await withCompactSetup(setupSonioxStt)

  await withCompactSetup(setupSpeechmaticsStt)

  await withCompactSetup(setupRevStt)

  await withCompactSetup(setupGrokStt)

  await withCompactSetup(async () => {
    await setupMistralStt()
    await setupOpenaiStt()
    await setupGeminiStt()
    await setupGlmStt()
    await setupTogetherStt()
    await setupFireworksStt()
    await setupCloudflareStt()
    await setupMistralOcr()
    await setupGlmOcr()
    await setupOpenAIOcr()
    await setupAnthropicOcr()
    await setupGeminiOcr()
    await setupDeepinfraOcr()
    await setupDeapiOcr()
  })

  await withCompactSetup(setupAssemblyAiStt)

  await withCompactSetup(setupGladiaStt)

  await withCompactSetup(setupSupadataStt)

  await withCompactSetup(async () => {
    await setupAwsStt({
      ...awsDefaults,
      verifyTranscribe: true
    })
  })

  await withCompactSetup(setupCalibreDocumentTools)

  await withCompactSetup(setupTesseractOcr)

  await withCompactSetup(setupKittenTts)

  await withCompactSetup(async () => { await downloadKittenTtsModel('kitten-tts-nano-0.8-int8') })

  await withCompactSetup(setupElevenLabsTts)

  await withCompactSetup(setupGroqTts)

  await withCompactSetup(setupGrokTts)

  await withCompactSetup(setupOpenAITts)

  await withCompactSetup(setupGeminiTts)

  await withCompactSetup(setupDeepgramTts)

  await withCompactSetup(setupRunwayTts)

  await withCompactSetup(setupDeapiTts)

  await withCompactSetup(setupGeminiImageGen)

  await withCompactSetup(setupOpenAIImageGen)

  await withCompactSetup(setupGrokImageGen)

  await withCompactSetup(setupRunwayImageGen)

  await withCompactSetup(setupBflImageGen)

  await withCompactSetup(setupDeapiImageGen)

  await withCompactSetup(setupDeapiVideoGen)

  await withCompactSetup(setupMinimaxVideoGen)

  await withCompactSetup(setupGeminiMusicGen)

  await withCompactSetup(setupElevenLabsMusicGen)

  await withCompactSetup(setupMinimaxMusicGen)

  await withCompactSetup(setupDeapiMusicGen)

  await validateBinary('whisper-cli', whisperBinaryPath, ['--help'])
  await validateBinary('llama-server', llamaBinaryPath, ['--version'])

  l.write('info', 'You can now run: bun as "https://www.youtube.com/watch?v=u1-WHqATSQU"')
}

export const runCompleteSetup = async (): Promise<void> => { await runFullSetup() }

const runSetupTranscription = async (): Promise<void> => {
  const awsDefaults = await readAwsSttConfigDefaults()
  await downloadWhisperModel('large-v3-turbo')
  await setupReverb()
  await setupOpenaiStt()
  await setupGeminiStt()
  await setupGlmStt()
  await setupTogetherStt()
  await setupFireworksStt()
  await setupCloudflareStt()
  await setupGrokStt()
  await setupAwsStt({
    ...awsDefaults,
    verifyTranscribe: true
  })
  l.write('success', 'Transcription setup complete')
}

const runSetupWrite = async (): Promise<void> => {
  if (!await checkLlamaInstalled()) await runLlamaSetup()
  for (const model of SUPPORTED_LLAMA_MODELS) await ensureLlamaModelDownloaded(model)
  l.write('success', 'Write setup complete')
}

const runSetupTts = async (): Promise<void> => {
  await ensureKittenTtsSetup()
  for (const model of SUPPORTED_KITTEN_TTS_MODELS) await downloadKittenTtsModel(model)
  await setupElevenLabsTts()
  await setupGroqTts()
  await setupGrokTts()
  await setupOpenAITts()
  await setupGeminiTts()
  await setupDeepgramTts()
  await setupRunwayTts()
  await setupDeapiTts()
  l.write('success', 'TTS setup complete')
}

const runSetupImage = async (): Promise<void> => {
  await setupGeminiImageGen()
  await setupOpenAIImageGen()
  await setupGrokImageGen()
  await setupRunwayImageGen()
  await setupBflImageGen()
  await setupDeapiImageGen()
  await setupGlmOcr()
  l.write('success', 'Image setup complete (all image providers are API-based)')
}

const runSetupVideo = async (): Promise<void> => {
  await setupGeminiVideoGen()
  await setupMinimaxVideoGen()
  await setupGlmVideoGen()
  await setupGrokVideoGen()
  await setupRunwayVideoGen()
  await setupDeapiVideoGen()
  l.write('success', 'Video setup complete (all video providers are API-based)')
}

const runSetupMusic = async (): Promise<void> => {
  await setupGeminiMusicGen()
  await setupElevenLabsMusicGen()
  await setupMinimaxMusicGen()
  await setupDeapiMusicGen()

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
  const hasFallbackRenderer = commandExists('pango-view') && (commandExists('magick') || commandExists('convert'))
  if (!hasAssFilter && !hasFallbackRenderer) {
    throw new Error(
      'Music lyric-video setup: ffmpeg does not expose the ass filter, and the fallback renderer is unavailable. Install pango-view plus ImageMagick, or use an ffmpeg build with ass support.'
    )
  }

  await setupWhisper()
  await downloadWhisperModel('large-v3-turbo')
  l.write('success', 'Music setup complete')
}

const runSetupSample = async (): Promise<void> => {
  l.write('info', 'Sample setup: verifying required tools for fixture generation (ffmpeg, ffprobe)')
  const { commandExists } = await import('~/utils/cli-utils')
  const requiredTools = ['ffmpeg', 'ffprobe']
  const missing: string[] = []
  for (const tool of requiredTools) {
    if (!commandExists(tool)) {
      missing.push(tool)
    }
  }
  if (missing.length > 0) {
    throw new Error(
      `Sample setup: missing required tools: ${missing.join(', ')}. ` +
      'Install them via your system package manager or run: bun as setup'
    )
  }
  l.write('success', 'Sample setup complete (all required tools found)')
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

const logBenchmarkResults = (
  stepLabel: string, runs: number, results: Map<string, number[]>, fallbackRuns: Map<string, number>
): void => {
  const rows = [...results.entries()].map(([engine, durations]) => {
    const median = computeMedian(durations)
    const p90 = computeP90(durations)
    return {
      engine,
      medianMs: median,
      p90Ms: p90,
      minMs: Math.min(...durations),
      maxMs: Math.max(...durations),
      outliers: durations.filter(v => v > p90).length,
      fallbackRuns: fallbackRuns.get(engine) ?? 0
    }
  })

  l.write('info', `Setup Benchmark (${stepLabel}, ${runs} run${runs > 1 ? 's' : ''})`, {
    category: 'command',
    humanTable: createHumanTable(rows, ['engine', 'medianMs', 'p90Ms', 'minMs', 'maxMs', 'outliers', 'fallbackRuns']),
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
    case 'reverb': return [reverbModelDir, reverbDiarizationDir]
    case 'music': return [whisperBinaryPath, whisperBuildDir, lyricsWhisperModelPath]
    case 'all': return [whisperModelPath, llamaBinaryPath]
    case 'uv': case 'yt-dlp': case 'calibre': case 'transcription': case 'write': case 'tts': case 'image': case 'video': case 'sample': return []
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
    case 'calibre': await setupCalibreDocumentTools(); return
    case 'transcription': await runSetupTranscription(); return
    case 'write': await runSetupWrite(); return
    case 'tts': await runSetupTts(); return
    case 'image': await runSetupImage(); return
    case 'video': await runSetupVideo(); return
    case 'music': await runSetupMusic(); return
    case 'sample': await runSetupSample(); return
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
  const fallbackRuns = new Map<string, number>([[label, 0]])
  for (let i = 0; i < repeat; i++) {
    await applyRunOptions(step, options)
    consumeDownloadFallbackEvents()
    const start = Date.now()
    await executeStepOnce(step)
    const duration = Date.now() - start
    const fallbackEvents = consumeDownloadFallbackEvents()
    if (fallbackEvents.length > 0) fallbackRuns.set(label, (fallbackRuns.get(label) ?? 0) + 1)
    timings.get(label)!.push(duration)
    const fallbackSuffix = fallbackEvents.length > 0 ? ` | fallback events: ${fallbackEvents.length}` : ''
    l.write('info', `Run ${i + 1}/${repeat} (${label}): ${duration}ms${fallbackSuffix}`)
  }

  logBenchmarkResults(step, repeat, timings, fallbackRuns)
}
