import { readdir, stat } from 'node:fs/promises'
import { join } from 'node:path'
import { inspectYtDlpAuthState } from '~/cli/commands/process-steps/step-1-download/audio/yt-dlp-options'
import { loadEnvFile } from '~/utils/cli-utils'
import { resolveConfigPath, loadConfig } from '~/cli/commands/setup-and-utilities/config/config-loader'
import { readDefuddleCliReadiness } from '~/cli/commands/process-steps/step-2-extract/step-2-url/url-local/defuddle/defuddle-cli'
import * as l from '~/utils/logger'
import { createHumanTable } from '~/utils/logger/human-table'
import type { AutoshowConfig, CheckResult, RunResult } from '~/types'
import { resolveYtDlpBinaryInfo, type ResolvedYtDlpBinary } from '~/cli/commands/process-steps/step-1-download/audio/yt-dlp-binary'
import {
  defaultLlamaModel,
  defaultWhisperModel,
  kittenTtsUvEnvDir,
  llamaBinaryPath,
  paddleOcrUvEnvDir,
  reverbUvEnvDir,
  runCapture,
  whisperBinaryPath,
  whisperModelsDir
} from './run-complete-setup'
import { resolveUvCommand } from './setup-download/managed-uv'
import {
  hasSetupManagedLlamaModel,
  llamaSetupModelsMetadataPath,
  readLlamaSetupModelMetadata,
  type LlamaSetupModelMetadata
} from '~/cli/commands/process-steps/step-3-write/write-local/llama/llama-model-metadata'
import {
  getHostedProviderConfiguredPaths,
  HOSTED_PROVIDER_ENV_CHECKS
} from './hosted-provider-config'
import {
  formatReverbDiarizationAssetPaths,
  formatReverbAsrAssetPaths,
  getMissingReverbDiarizationFiles,
  getMissingReverbAsrFiles
} from '~/cli/commands/process-steps/step-2-extract/step-2-stt/stt-local/reverb/reverb-assets'
export { HOSTED_PROVIDER_ENV_CHECKS } from './hosted-provider-config'

type DoctorStatus = 'OK' | 'MISSING' | 'WARN' | 'INFO'
type DoctorSeverity = 'warn' | 'info'

export type DoctorCheck = {
  label: string
  status: DoctorStatus
  detail: string
  severity: DoctorSeverity
  nextStep?: string | undefined
}

type DoctorSection = {
  title: string
  checks: DoctorCheck[]
}

type DoctorReport = {
  sections: DoctorSection[]
  hasWarnings: boolean
  nextSteps: string[]
}

type YtDlpAuthState = Awaited<ReturnType<typeof inspectYtDlpAuthState>>

export type DoctorProbes = {
  env: Record<string, string | undefined>
  which: (command: string) => string | undefined
  pathExists: (path: string) => Promise<boolean>
  listDirectory: (path: string) => Promise<string[]>
  directoryHasFiles: (path: string) => Promise<boolean>
  run: (command: string, args: string[]) => Promise<RunResult>
  resolveYtDlpBinaryInfo: () => ResolvedYtDlpBinary | undefined
  resolveUvCommand: () => Promise<string | undefined>
  readDefuddleCliReadiness: () => Promise<CheckResult>
  resolveConfigPath: () => Promise<string>
  loadConfig: (path: string) => Promise<AutoshowConfig>
  inspectYtDlpAuthState: () => Promise<YtDlpAuthState>
  hasSetupManagedLlamaModel: (model: string) => Promise<boolean>
  readLlamaSetupModelMetadata: () => Promise<LlamaSetupModelMetadata>
}

const hasPath = async (path: string): Promise<boolean> => {
  try {
    await stat(path)
    return true
  } catch {
    return false
  }
}

const listNames = async (path: string): Promise<string[]> => {
  try {
    return await readdir(path)
  } catch {
    return []
  }
}

const directoryHasAnyFiles = async (root: string): Promise<boolean> => {
  try {
    const entries = await readdir(root, { withFileTypes: true })
    for (const entry of entries) {
      const path = join(root, entry.name)
      if (entry.isFile()) return true
      if (entry.isDirectory() && await directoryHasAnyFiles(path)) return true
    }
    return false
  } catch {
    return false
  }
}

const createDoctorProbes = (overrides: Partial<DoctorProbes> = {}): DoctorProbes => ({
  env: process.env as Record<string, string | undefined>,
  which: (command) => Bun.which(command) ?? undefined,
  pathExists: hasPath,
  listDirectory: listNames,
  directoryHasFiles: directoryHasAnyFiles,
  run: async (command, args) => await runCapture(command, args, { allowFailure: true }),
  resolveYtDlpBinaryInfo,
  resolveUvCommand,
  readDefuddleCliReadiness,
  resolveConfigPath,
  loadConfig,
  inspectYtDlpAuthState,
  hasSetupManagedLlamaModel,
  readLlamaSetupModelMetadata,
  ...overrides
})

const check = (
  status: DoctorStatus,
  label: string,
  detail: string,
  options: { severity?: DoctorSeverity, nextStep?: string } = {}
): DoctorCheck => ({
  label,
  status,
  detail,
  severity: options.severity ?? (status === 'WARN' ? 'warn' : 'info'),
  ...(options.nextStep ? { nextStep: options.nextStep } : {})
})

const checkCommand = (
  probes: DoctorProbes,
  label: string,
  command: string,
  options: { nextStep?: string, severity?: DoctorSeverity } = {}
): DoctorCheck => {
  const found = probes.which(command)
  return found
    ? check('OK', label, found)
    : check('MISSING', label, 'not found', {
      severity: options.severity ?? 'warn',
      ...(options.nextStep ? { nextStep: options.nextStep } : {})
    })
}

const checkYtDlp = (probes: DoctorProbes): DoctorCheck => {
  const resolved = probes.resolveYtDlpBinaryInfo()
  return resolved
    ? check('OK', 'yt-dlp', `${resolved.path} (${resolved.source})`)
    : check('MISSING', 'yt-dlp', 'not found', {
      severity: 'warn',
      nextStep: 'bun as setup --step yt-dlp'
    })
}

const checkUv = async (probes: DoctorProbes): Promise<DoctorCheck> => {
  const resolved = await probes.resolveUvCommand()
  return resolved
    ? check('OK', 'uv', resolved)
    : check('MISSING', 'uv', 'not found', {
      severity: 'warn',
      nextStep: 'bun as setup --step uv'
    })
}

const envIsSet = (probes: DoctorProbes, envVar: string): boolean => {
  const value = probes.env[envVar]
  return typeof value === 'string' && value.trim().length > 0
}

const reverbSetupNextStep = (probes: DoctorProbes): string =>
  envIsSet(probes, 'HUGGINGFACE_TOKEN')
    ? 'bun as setup --step reverb'
    : 'set HUGGINGFACE_TOKEN, then run bun as setup --step reverb'

const formatRunIssue = (result: RunResult): string => {
  const details = result.stderr.trim() || result.stdout.trim() || `exit code ${result.exitCode}`
  return details.length > 300 ? `${details.slice(0, 300)}...` : details
}

const checkTesseractEnglishData = async (probes: DoctorProbes): Promise<DoctorCheck> => {
  if (!probes.which('tesseract')) {
    return check('MISSING', 'Tesseract eng data', 'tesseract not found', {
      severity: 'warn',
      nextStep: 'bun as setup'
    })
  }

  const result = await probes.run('tesseract', ['--list-langs'])
  if (result.exitCode !== 0) {
    return check('WARN', 'Tesseract eng data', `could not list languages: ${formatRunIssue(result)}`, {
      nextStep: 'bun as setup'
    })
  }

  const langs = `${result.stdout}\n${result.stderr}`
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean)

  return langs.includes('eng')
    ? check('OK', 'Tesseract eng data', 'eng available')
    : check('MISSING', 'Tesseract eng data', 'eng not listed by tesseract --list-langs', {
      severity: 'warn',
      nextStep: 'bun as setup'
    })
}

const hasFilter = (filtersOutput: string, filterName: string): boolean =>
  filtersOutput.split('\n').some((line) => line.trim().split(/\s+/).includes(filterName))

const checkMusicRenderer = async (probes: DoctorProbes): Promise<DoctorCheck> => {
  if (!probes.which('ffmpeg')) {
    return check('MISSING', 'music lyric-video renderer', 'ffmpeg not found', {
      severity: 'warn',
      nextStep: 'bun as setup --step yt-dlp'
    })
  }

  const filters = await probes.run('ffmpeg', ['-hide_banner', '-filters'])
  if (filters.exitCode === 0 && hasFilter(filters.stdout, 'ass')) {
    return check('OK', 'music lyric-video renderer', 'ffmpeg ass filter available')
  }

  const pango = probes.which('pango-view')
  const convert = probes.which('convert')
  if (pango && convert) {
    return check('OK', 'music lyric-video renderer', `fallback renderer available: ${pango}, ${convert}`)
  }

  return check(
    'MISSING',
    'music lyric-video renderer',
    filters.exitCode === 0
      ? 'ffmpeg lacks ass filter and fallback requires pango-view plus ImageMagick convert'
      : `could not inspect ffmpeg filters and fallback requires pango-view plus ImageMagick convert: ${formatRunIssue(filters)}`,
    {
      severity: 'warn',
      nextStep: 'install ffmpeg with libass support, or install pango-view plus ImageMagick convert'
    }
  )
}

const collectSystemBuildToolChecks = async (probes: DoctorProbes): Promise<DoctorSection> => ({
  title: 'System/build tools',
  checks: [
    checkYtDlp(probes),
    await checkUv(probes),
    checkCommand(probes, 'ffmpeg', 'ffmpeg', { nextStep: 'bun as setup --step yt-dlp' }),
    checkCommand(probes, 'ffprobe', 'ffprobe', { nextStep: 'bun as setup --step yt-dlp' }),
    checkCommand(probes, 'cmake', 'cmake', { nextStep: 'install cmake with your system package manager' }),
    checkCommand(probes, 'tesseract', 'tesseract', { nextStep: 'bun as setup' }),
    await checkTesseractEnglishData(probes),
    checkCommand(probes, 'mutool', 'mutool', { nextStep: 'bun as setup --step calibre' }),
    checkCommand(probes, 'ebook-convert', 'ebook-convert', { nextStep: 'bun as setup --step calibre' }),
    await checkMusicRenderer(probes)
  ]
})

const fromLegacyCheck = (legacy: CheckResult, options: { nextStep: string }): DoctorCheck => {
  if (legacy.ok) {
    return check('OK', legacy.label, legacy.detail)
  }
  return check(
    legacy.detail.toLowerCase().includes('failed') ? 'WARN' : 'MISSING',
    legacy.label,
    legacy.detail,
    { severity: 'warn', nextStep: options.nextStep }
  )
}

const checkManagedBinary = async (
  probes: DoctorProbes,
  label: string,
  path: string,
  args: string[],
  options: { nextStep: string, okExitCodes?: number[] }
): Promise<DoctorCheck> => {
  if (!await probes.pathExists(path)) {
    return check('MISSING', label, `${path} not found`, {
      severity: 'warn',
      nextStep: options.nextStep
    })
  }

  const result = await probes.run(path, args)
  const okExitCodes = options.okExitCodes ?? [0]
  if (okExitCodes.includes(result.exitCode)) {
    const detail = result.stdout.trim() || result.stderr.trim() || path
    return check('OK', label, detail.length > 0 ? detail : path)
  }

  return check('WARN', label, `${path} failed ${args.join(' ')}: ${formatRunIssue(result)}`, {
    nextStep: options.nextStep
  })
}

const checkPythonImportRuntime = async (
  probes: DoctorProbes,
  label: string,
  envDir: string,
  importCode: string,
  nextStep: string
): Promise<DoctorCheck> => {
  const python = `${envDir}/bin/python`
  if (!await probes.pathExists(python)) {
    return check('MISSING', label, `${python} not found`, {
      severity: 'warn',
      nextStep
    })
  }

  const result = await probes.run(python, ['-c', importCode])
  return result.exitCode === 0
    ? check('OK', label, `${python} imports required packages`)
    : check('WARN', label, `${python} import check failed: ${formatRunIssue(result)}`, {
      nextStep
    })
}

const checkOptionalCommandVersion = async (
  probes: DoctorProbes,
  label: string,
  command: string,
  args: string[],
  nextStep: string
): Promise<DoctorCheck> => {
  const resolved = probes.which(command)
  if (!resolved) {
    return check('MISSING', label, 'not installed (optional)', { severity: 'info' })
  }

  const result = await probes.run(command, args)
  return result.exitCode === 0
    ? check('OK', label, result.stdout.trim() || result.stderr.trim() || resolved)
    : check('WARN', label, `${resolved} failed ${args.join(' ')}: ${formatRunIssue(result)}`, {
      nextStep
    })
}

const checkOptionalPythonRuntime = async (
  probes: DoctorProbes,
  label: string,
  envDir: string,
  importCode: string,
  nextStep: string
): Promise<DoctorCheck> => {
  const python = `${envDir}/bin/python`
  if (!await probes.pathExists(python)) {
    return check('MISSING', label, 'not installed (optional)', { severity: 'info' })
  }

  const result = await probes.run(python, ['-c', importCode])
  return result.exitCode === 0
    ? check('OK', label, `${python} imports required packages`)
    : check('WARN', label, `${python} import check failed: ${formatRunIssue(result)}`, {
      nextStep
    })
}

const collectManagedRuntimeChecks = async (probes: DoctorProbes): Promise<DoctorSection> => ({
  title: 'Managed local runtimes',
  checks: [
    fromLegacyCheck(await probes.readDefuddleCliReadiness(), { nextStep: 'bun as setup --step defuddle' }),
    await checkManagedBinary(probes, 'runtime/bin/whisper-cli', whisperBinaryPath, ['--help'], {
      nextStep: 'bun as setup --step whisper-binary'
    }),
    await checkManagedBinary(probes, 'runtime/bin/llama-server', llamaBinaryPath, ['--version'], {
      nextStep: 'bun as setup --step llama-binary',
      okExitCodes: [0, 1]
    }),
    await checkPythonImportRuntime(
      probes,
      'Reverb Python env',
      reverbUvEnvDir,
      'import wenet, pyannote, torch',
      reverbSetupNextStep(probes)
    ),
    await checkPythonImportRuntime(
      probes,
      'Kitten TTS Python env',
      kittenTtsUvEnvDir,
      'from kittentts import KittenTTS; import soundfile',
      'bun as setup --step tts'
    ),
    await checkOptionalCommandVersion(probes, 'OCRmyPDF', 'ocrmypdf', ['--version'], 'bun as setup'),
    await checkOptionalPythonRuntime(
      probes,
      'PaddleOCR Python env',
      paddleOcrUvEnvDir,
      'from paddleocr import PaddleOCR',
      'bun as extract INPUT --paddle-ocr'
    )
  ]
})

const checkModelFile = async (
  probes: DoctorProbes,
  label: string,
  path: string,
  nextStep: string
): Promise<DoctorCheck> =>
  await probes.pathExists(path)
    ? check('OK', label, path)
    : check('MISSING', label, `${path} not found`, { severity: 'warn', nextStep })

const collectInstalledWhisperModelsCheck = async (probes: DoctorProbes): Promise<DoctorCheck> => {
  const entries = await probes.listDirectory(whisperModelsDir)
  const modelFiles = entries
    .filter(name => /^ggml-.+\.bin$/.test(name))
    .sort()

  return check(
    'INFO',
    'installed whisper model files',
    modelFiles.length > 0 ? modelFiles.join(', ') : `none found in ${whisperModelsDir}`
  )
}

const collectLlamaManagedModelsCheck = async (probes: DoctorProbes): Promise<DoctorCheck> => {
  const metadata = await probes.readLlamaSetupModelMetadata()
  const models = Object.keys(metadata.models).sort()
  return check(
    'INFO',
    'llama setup-managed models',
    models.length > 0 ? models.join(', ') : `none recorded in ${llamaSetupModelsMetadataPath}`
  )
}

const checkReverbAssets = async (probes: DoctorProbes): Promise<DoctorCheck> => {
  const missing = await getMissingReverbAsrFiles(probes.pathExists)

  return missing.length === 0
    ? check('OK', 'Reverb ASR files', formatReverbAsrAssetPaths())
    : check('MISSING', 'Reverb ASR files', `missing ${missing.join(', ')}`, {
      severity: 'warn',
      nextStep: reverbSetupNextStep(probes)
    })
}

const checkReverbDiarization = async (probes: DoctorProbes): Promise<DoctorCheck> => {
  const missing = await getMissingReverbDiarizationFiles(probes.pathExists)

  return missing.length === 0
    ? check('OK', 'Reverb diarization cache', formatReverbDiarizationAssetPaths())
    : check('MISSING', 'Reverb diarization cache', `missing ${missing.join(', ')}`, {
      severity: 'warn',
      nextStep: reverbSetupNextStep(probes)
    })
}

const checkLlamaModelReadiness = async (probes: DoctorProbes, model: string): Promise<DoctorCheck> =>
  await probes.hasSetupManagedLlamaModel(model)
    ? check('OK', `llama model ${model}`, `setup-managed marker found in ${llamaSetupModelsMetadataPath}`)
    : check('MISSING', `llama model ${model}`, `unverified: no setup-managed marker in ${llamaSetupModelsMetadataPath}`, {
      severity: 'warn',
      nextStep: `bun as setup --models ${model}`
    })

const collectLocalModelAssetChecks = async (probes: DoctorProbes): Promise<DoctorSection> => ({
  title: 'Local model assets',
  checks: [
    await checkModelFile(
      probes,
      `default whisper model ${defaultWhisperModel}`,
      `${whisperModelsDir}/ggml-${defaultWhisperModel}.bin`,
      'bun as setup --step whisper-model'
    ),
    await checkModelFile(
      probes,
      'music whisper model large-v3-turbo',
      `${whisperModelsDir}/ggml-large-v3-turbo.bin`,
      'bun as setup --models large-v3-turbo'
    ),
    await collectInstalledWhisperModelsCheck(probes),
    await checkReverbAssets(probes),
    await checkReverbDiarization(probes),
    await checkLlamaModelReadiness(probes, defaultLlamaModel),
    await collectLlamaManagedModelsCheck(probes)
  ]
})

const buildHostedProviderEnvChecks = (
  env: Record<string, string | undefined>,
  config?: AutoshowConfig
): DoctorCheck[] =>
  HOSTED_PROVIDER_ENV_CHECKS.map((provider) => {
    const value = env[provider.envVar]
    const set = typeof value === 'string' && value.trim().length > 0
    const configuredPaths = getHostedProviderConfiguredPaths(config, provider.configPaths)
    const label = `${provider.envVar} (${provider.label})`

    if (set) {
      return check('OK', label, 'set')
    }

    if (configuredPaths.length > 0) {
      return check('MISSING', label, `not set (configured: ${configuredPaths.join(', ')})`, {
        severity: 'warn',
        nextStep: `export ${provider.envVar}=...`
      })
    }

    return check('MISSING', label, 'not set (optional)', { severity: 'info' })
  })

const collectHostedProviderChecks = (
  probes: DoctorProbes,
  config?: AutoshowConfig
): DoctorSection => ({
  title: 'Hosted provider configuration',
  checks: buildHostedProviderEnvChecks(probes.env, config)
})

const collectConfigChecks = async (
  probes: DoctorProbes
): Promise<{ checks: DoctorCheck[], config?: AutoshowConfig }> => {
  const checks: DoctorCheck[] = []
  const configPath = await probes.resolveConfigPath()
  const configExists = await probes.pathExists(configPath)

  checks.push(configExists
    ? check('OK', 'config file', configPath)
    : check('INFO', 'config file', `${configPath} (not found)`, { severity: 'info' }))

  if (!configExists) {
    return { checks, config: {} }
  }

  try {
    const config = await probes.loadConfig(configPath)
    checks.push(check('OK', 'config valid', 'parseable JSON'))
    return { checks, config }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    checks.push(check('WARN', 'config valid', message, {
      nextStep: `fix ${configPath}`
    }))
    return { checks }
  }
}

const collectYoutubeCookieChecks = async (probes: DoctorProbes): Promise<DoctorCheck[]> => {
  const youtubeStatus = await probes.inspectYtDlpAuthState()
  const checks: DoctorCheck[] = [
    check('INFO', 'YouTube cookies mode', youtubeStatus.configuredMode)
  ]

  if (youtubeStatus.configuredMode === 'cookies-file') {
    const cookieDetail = youtubeStatus.resolvedCookiesPath ?? youtubeStatus.cookiesPath ?? 'not configured'
    checks.push(youtubeStatus.cookiesReadable === true
      ? check('OK', 'YouTube cookies file', cookieDetail)
      : check('MISSING', 'YouTube cookies file', cookieDetail, {
        severity: 'warn',
        nextStep: 'docs/cookies.md'
      }))
  } else if (youtubeStatus.configuredMode === 'cookies-from-browser') {
    checks.push(check('OK', 'YouTube cookies source', 'browser import via YTDLP_COOKIES_FROM_BROWSER'))
  } else {
    checks.push(check('INFO', 'YouTube cookies source', 'not configured'))
  }

  if (youtubeStatus.warning) {
    checks.push(check('WARN', 'YouTube cookies warning', youtubeStatus.warning, {
      nextStep: 'docs/cookies.md'
    }))
  }

  return checks
}

const collectConfigAndCookieChecks = async (
  probes: DoctorProbes
): Promise<{ section: DoctorSection, config?: AutoshowConfig }> => {
  const configResult = await collectConfigChecks(probes)
  const youtubeChecks = await collectYoutubeCookieChecks(probes)
  return {
    section: {
      title: 'Config and YouTube cookies',
      checks: [...configResult.checks, ...youtubeChecks]
    },
    ...(configResult.config ? { config: configResult.config } : {})
  }
}

export const collectDoctorNextSteps = (sections: readonly DoctorSection[]): string[] => {
  const steps = new Set<string>()
  for (const section of sections) {
    for (const item of section.checks) {
      if (item.severity === 'warn' && item.status !== 'OK' && item.nextStep) {
        steps.add(item.nextStep)
      }
    }
  }
  return [...steps]
}

const hasDoctorWarnings = (sections: readonly DoctorSection[]): boolean =>
  sections.some(section => section.checks.some(item => item.severity === 'warn' && item.status !== 'OK'))

export const collectDoctorReport = async (
  probeOverrides: Partial<DoctorProbes> = {}
): Promise<DoctorReport> => {
  const probes = createDoctorProbes(probeOverrides)
  const configAndCookies = await collectConfigAndCookieChecks(probes)
  const sections = [
    await collectSystemBuildToolChecks(probes),
    await collectManagedRuntimeChecks(probes),
    await collectLocalModelAssetChecks(probes),
    collectHostedProviderChecks(probes, configAndCookies.config),
    configAndCookies.section
  ]
  const hasWarnings = hasDoctorWarnings(sections)

  return {
    sections,
    hasWarnings,
    nextSteps: collectDoctorNextSteps(sections)
  }
}

const sectionHasWarnings = (section: DoctorSection): boolean =>
  section.checks.some(item => item.severity === 'warn' && item.status !== 'OK')

const logDoctorSection = (section: DoctorSection): void => {
  l.write(sectionHasWarnings(section) ? 'warn' : 'info', section.title, {
    category: 'command',
    humanTable: createHumanTable(
      section.checks.map((item) => ({
        status: item.status,
        check: item.label,
        detail: item.detail
      })),
      ['status', 'check', 'detail']
    )
  })
}

export const runDoctor = async (): Promise<void> => {
  await loadEnvFile()
  const report = await collectDoctorReport()

  for (const section of report.sections) {
    logDoctorSection(section)
  }

  l.write(report.hasWarnings ? 'warn' : 'success', 'Setup Doctor Summary', {
    category: 'command',
    humanTable: createHumanTable([
      {
        status: report.hasWarnings ? 'WARN' : 'OK',
        check: 'overall',
        detail: report.hasWarnings ? 'one or more local checks need attention' : 'no warning-level issues found'
      }
    ], ['status', 'check', 'detail'])
  })

  if (report.nextSteps.length > 0) {
    l.write('info', 'Setup Next Steps', {
      category: 'command',
      humanTable: createHumanTable(
        report.nextSteps.map((step, index) => ({
          step: index + 1,
          action: step
        })),
        ['step', 'action']
      )
    })
  }
}
