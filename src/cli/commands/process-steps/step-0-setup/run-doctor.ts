import { inspectYtDlpAuthState } from '~/cli/commands/process-steps/step-1-download/audio/yt-dlp-options'
import { commandExists } from '~/utils/cli-utils'
import { loadEnvFile } from '~/utils/cli-utils'
import { resolveConfigPath, loadConfig } from '~/cli/commands/config/config-loader'
import * as l from '~/logger'

type CheckResult = { label: string; ok: boolean; detail: string }

const checkCommand = (label: string, command: string): CheckResult => {
  const found = commandExists(command)
  return {
    label,
    ok: found,
    detail: found ? Bun.which(command) as string : 'not found'
  }
}

const checkEnvVar = (label: string, envVar: string): CheckResult => {
  const value = process.env[envVar]
  const ok = typeof value === 'string' && value.length > 0
  return {
    label,
    ok,
    detail: ok ? 'set' : 'not set'
  }
}

export const runDoctor = async (): Promise<void> => {
  await loadEnvFile()

  const checks: CheckResult[] = []

  checks.push(checkCommand('yt-dlp', 'yt-dlp'))
  checks.push(checkCommand('ffmpeg', 'ffmpeg'))
  checks.push(checkCommand('ffprobe', 'ffprobe'))
  checks.push(checkCommand('tesseract', 'tesseract'))

  checks.push(checkEnvVar('OPENAI_API_KEY', 'OPENAI_API_KEY'))
  checks.push(checkEnvVar('GEMINI_API_KEY', 'GEMINI_API_KEY'))
  checks.push(checkEnvVar('ANTHROPIC_API_KEY', 'ANTHROPIC_API_KEY'))
  checks.push(checkEnvVar('GROQ_API_KEY', 'GROQ_API_KEY'))
  checks.push(checkEnvVar('MINIMAX_API_KEY', 'MINIMAX_API_KEY'))
  checks.push(checkEnvVar('ELEVENLABS_API_KEY', 'ELEVENLABS_API_KEY'))
  checks.push(checkEnvVar('ASSEMBLYAI_API_KEY', 'ASSEMBLYAI_API_KEY'))

  const configPath = await resolveConfigPath()
  const configFile = Bun.file(configPath)
  const configExists = await configFile.exists()
  checks.push({
    label: 'config file',
    ok: configExists,
    detail: configExists ? configPath : `${configPath} (not found)`
  })

  if (configExists) {
    try {
      await loadConfig(configPath)
      checks.push({ label: 'config valid', ok: true, detail: 'parseable JSON' })
    } catch {
      checks.push({ label: 'config valid', ok: false, detail: 'invalid JSON' })
    }
  }

  const bunVersion = Bun.version
  checks.push({ label: 'bun', ok: true, detail: `v${bunVersion}` })

  let hasFailure = false
  for (const check of checks) {
    const symbol = check.ok ? 'OK' : 'MISSING'
    const logFn = check.ok ? l.success : l.warn
    logFn(`${symbol}: ${check.label} — ${check.detail}`)
    if (!check.ok) hasFailure = true
  }

  const youtubeStatus = await inspectYtDlpAuthState()
  l.info('')
  l.info('YouTube cookies')
  l.info(`INFO: mode — ${youtubeStatus.configuredMode}`)

  if (youtubeStatus.configuredMode === 'cookies-file') {
    const cookieDetail = youtubeStatus.resolvedCookiesPath ?? youtubeStatus.cookiesPath ?? 'not configured'
    if (youtubeStatus.cookiesReadable === true) {
      l.success(`OK: cookies file — ${cookieDetail}`)
    } else {
      l.warn(`MISSING: cookies file — ${cookieDetail}`)
      hasFailure = true
    }
  } else if (youtubeStatus.configuredMode === 'cookies-from-browser') {
    l.success('OK: cookies source — browser import via YTDLP_COOKIES_FROM_BROWSER')
  } else {
    l.info('INFO: cookies source — not configured')
  }

  if (youtubeStatus.warning) {
    l.warn(youtubeStatus.warning)
    hasFailure = true
  }

  if (hasFailure) {
    l.info('')
    l.info("Run 'bun as setup' to install missing tools")
    l.info('See docs/cookies.md for YouTube cookie setup')
  }
}
