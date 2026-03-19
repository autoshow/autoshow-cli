import * as l from '~/logger'
import { exec, loadEnvFile } from '~/utils/cli-utils'
import { withRetry } from '~/utils/retries'

const buildBaseArgs = async (url: string, outputDir: string): Promise<string[]> => {
  await loadEnvFile()
  const acceptLanguage = process.env['YTDLP_ACCEPT_LANGUAGE']
  const userAgent = process.env['YTDLP_USER_AGENT']
  const extractorArgsEnv = process.env['YTDLP_EXTRACTOR_ARGS']
  const noCheckCerts = String(process.env['YTDLP_NO_CHECK_CERTS'] || '').toLowerCase() === 'true'
  const args: string[] = [
    '--extract-audio',
    '--audio-format',
    'mp3',
    '--output',
    `${outputDir}/%(title)s.%(ext)s`,
    '--restrict-filenames',
    '--no-playlist',
    '--progress',
    '--retries',
    '10',
    '--fragment-retries',
    '10'
  ]
  if (acceptLanguage) {
    args.push('--add-header', `Accept-Language: ${acceptLanguage}`)
  }
  if (userAgent) {
    args.push('--user-agent', userAgent)
  }
  if (extractorArgsEnv) {
    args.push('--extractor-args', extractorArgsEnv)
  }
  if (noCheckCerts) {
    args.push('--no-check-certificates')
  }
  args.push(url)
  return args
}

const buildAndroidClientArgs = async (url: string, outputDir: string): Promise<string[]> => {
  const base = await buildBaseArgs(url, outputDir)
  const insertIndex = Math.max(0, base.indexOf(url))
  base.splice(insertIndex, 0, '--extractor-args', 'youtube:player_client=android')
  return base
}

const buildCookiesFromBrowserArgs = async (url: string, outputDir: string, browser: string): Promise<string[]> => {
  const base = await buildBaseArgs(url, outputDir)
  const insertIndex = Math.max(0, base.indexOf(url))
  base.splice(insertIndex, 0, '--cookies-from-browser', browser)
  return base
}

const buildCookiesFileArgs = async (url: string, outputDir: string, filePath: string): Promise<string[]> => {
  const base = await buildBaseArgs(url, outputDir)
  const insertIndex = Math.max(0, base.indexOf(url))
  base.splice(insertIndex, 0, '--cookies', filePath)
  return base
}

const runAttempt = async (_label: string, cmdArgs: string[]): Promise<{ ok: boolean; stdout: string; stderr: string; exitCode: number }> => {
  const result = await exec('yt-dlp', cmdArgs)
  if (result.exitCode === 0) {
    return { ok: true, stdout: result.stdout, stderr: result.stderr, exitCode: 0 }
  }
  return { ok: false, stdout: result.stdout, stderr: result.stderr, exitCode: result.exitCode }
}

const isRetryableNetworkError = (text: string): boolean => {
  const combined = text.toLowerCase()
  return combined.includes('read timed out')
    || combined.includes('unable to download webpage')
    || combined.includes('transporterror')
    || combined.includes('temporarily unavailable')
    || combined.includes('connection reset')
}

const findDownloadedAudio = async (outputDir: string): Promise<string> => {
  const files = await Bun.$`find ${outputDir} -type f \( -name "*.mp3" -o -name "*.m4a" -o -name "*.webm" -o -name "*.mp4" -o -name "*.opus" -o -name "*.ogg" -o -name "*.aac" \)`.text()
  const list = files.trim().split('\n').filter(f => f.length > 0)
  const first = list[0]
  if (!first) {
    l.error(`No files found in ${outputDir}`)
    throw new Error('No downloaded files found')
  }
  return first
}

const downloadVideoOnce = async (url: string, outputDir: string): Promise<string> => {
  await loadEnvFile()
  const cookiesFromBrowser = process.env['YTDLP_COOKIES_FROM_BROWSER']
  const cookiesFile = process.env['YTDLP_COOKIES_FILE']
  const attempts: Array<{ label: string; build: () => Promise<string[]> }> = [
    { label: 'standard', build: () => buildBaseArgs(url, outputDir) },
    { label: 'android-player-client', build: () => buildAndroidClientArgs(url, outputDir) }
  ]
  if (cookiesFromBrowser) {
    attempts.unshift({ label: `cookies-from-browser:${cookiesFromBrowser}`, build: () => buildCookiesFromBrowserArgs(url, outputDir, cookiesFromBrowser) })
  }
  if (cookiesFile) {
    attempts.unshift({ label: `cookies-file:${cookiesFile}`, build: () => buildCookiesFileArgs(url, outputDir, cookiesFile) })
  }

  const results = await attempts.reduce(async (prevPromise, attempt) => {
    const prev = await prevPromise
    if (prev.ok) return prev
    const args = await attempt.build()
    const res = await runAttempt(attempt.label, args)
    return res.ok ? res : prev
  }, Promise.resolve<{ ok: boolean; stdout: string; stderr: string; exitCode: number }>({ ok: false, stdout: '', stderr: '', exitCode: 1 }))

  if (!results.ok) {
    const finalArgs = await buildAndroidClientArgs(url, outputDir)
    const last = await runAttempt('final-android-retry', finalArgs)
    if (!last.ok) {
      throw new Error(`yt-dlp failed: ${last.stderr || last.stdout}`)
    }
  }

  return await findDownloadedAudio(outputDir)
}

export const downloadVideo = async (url: string, outputDir: string): Promise<string> => {
  try {
    return await withRetry(
      { retryClass: 'runtime_subprocess_transient', operationName: 'yt-dlp-download' },
      async () => await downloadVideoOnce(url, outputDir),
      (error) => {
        const message = error instanceof Error ? error.message : String(error)
        if (isRetryableNetworkError(message)) {
          return { shouldRetry: true, delayMs: 0, reason: 'transient network error' }
        }
        return { shouldRetry: false, delayMs: 0, reason: 'non-retryable error' }
      }
    )
  } catch (error) {
    l.error(`Failed to download with yt-dlp`, error)
    throw error
  }
}
