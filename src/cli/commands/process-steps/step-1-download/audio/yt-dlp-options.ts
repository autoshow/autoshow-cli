import { access } from 'node:fs/promises'
import { constants as fsConstants } from 'node:fs'
import { resolve } from 'node:path'
import * as l from '~/utils/logger'
import type { YtDlpAuthMode, YtDlpListOptions } from '~/types'
import { loadEnvFile } from '~/utils/cli-utils'

const YOUTUBE_BOT_CHECK_PATTERN = /Sign in to confirm you(?:’|')re not a bot/i
const warnedUnreadableCookiePaths = new Set<string>()

const getTrimmedEnv = (key: string): string | undefined => {
  const value = process.env[key]?.trim()
  return value ? value : undefined
}

const isTrueEnv = (key: string): boolean =>
  String(process.env[key] || '').trim().toLowerCase() === 'true'

const isReadableFile = async (filePath: string): Promise<boolean> => {
  try {
    await access(filePath, fsConstants.R_OK)
    return true
  } catch {
    return false
  }
}

export const resetYtDlpOptionWarningStateForTests = (): void => {
  warnedUnreadableCookiePaths.clear()
}

export const inspectYtDlpAuthState = async (
  options?: { cwd?: string }
): Promise<{
  configuredMode: YtDlpAuthMode
  usableMode: YtDlpAuthMode
  cookiesPath?: string
  resolvedCookiesPath?: string
  cookiesReadable?: boolean
  cookieArgs: string[]
  warning?: string
}> => {
  await loadEnvFile()

  const cookiesFromBrowser = getTrimmedEnv('YTDLP_COOKIES_FROM_BROWSER')
  const cookiesPath = getTrimmedEnv('YTDLP_COOKIES')
  const cwd = resolve(options?.cwd ?? process.cwd())

  if (cookiesPath) {
    const resolvedCookiesPath = resolve(cwd, cookiesPath)
    const cookiesReadable = await isReadableFile(resolvedCookiesPath)
    return {
      configuredMode: 'cookies-file',
      usableMode: cookiesReadable ? 'cookies-file' : 'none',
      cookiesPath,
      resolvedCookiesPath,
      cookiesReadable,
      cookieArgs: cookiesReadable ? ['--cookies', cookiesPath] : [],
      ...(cookiesReadable
        ? {}
        : { warning: `YTDLP_COOKIES is set but unreadable: ${resolvedCookiesPath}. Fix or remove it before retrying yt-dlp auth.` })
    }
  }

  if (cookiesFromBrowser) {
    return {
      configuredMode: 'cookies-from-browser',
      usableMode: 'cookies-from-browser',
      cookieArgs: ['--cookies-from-browser', cookiesFromBrowser]
    }
  }

  return {
    configuredMode: 'none',
    usableMode: 'none',
    cookieArgs: []
  }
}

export const buildSharedYtDlpArgs = async (): Promise<string[]> => {
  await loadEnvFile()

  const acceptLanguage = getTrimmedEnv('YTDLP_ACCEPT_LANGUAGE')
  const userAgent = getTrimmedEnv('YTDLP_USER_AGENT')
  const extractorArgs = getTrimmedEnv('YTDLP_EXTRACTOR_ARGS')
  const authState = await inspectYtDlpAuthState()

  const args: string[] = []

  if (acceptLanguage) {
    args.push('--add-header', `Accept-Language: ${acceptLanguage}`)
  }
  if (userAgent) {
    args.push('--user-agent', userAgent)
  }
  if (authState.warning) {
    const warningKey = authState.resolvedCookiesPath ?? authState.cookiesPath ?? authState.warning
    if (!warnedUnreadableCookiePaths.has(warningKey)) {
      warnedUnreadableCookiePaths.add(warningKey)
      l.warn(authState.warning)
    }
  }
  args.push(...authState.cookieArgs)
  if (isTrueEnv('YTDLP_NO_CHECK_CERTS')) {
    args.push('--no-check-certificates')
  }
  if (extractorArgs) {
    args.push('--extractor-args', extractorArgs)
  }

  return args
}

export const buildYtDlpDownloadArgs = async (url: string, outputDir: string): Promise<string[]> => {
  const sharedArgs = await buildSharedYtDlpArgs()

  return [
    '--format',
    'bestaudio/best',
    '--output',
    `${outputDir}/%(title)s.%(ext)s`,
    '--restrict-filenames',
    '--no-playlist',
    '--no-progress',
    ...sharedArgs,
    url
  ]
}

export const buildYtDlpMetadataArgs = async (url: string): Promise<string[]> => {
  const sharedArgs = await buildSharedYtDlpArgs()

  return [
    '--dump-json',
    '--no-playlist',
    '--quiet',
    ...sharedArgs,
    url
  ]
}

export const buildYtDlpSubtitleDownloadArgs = async (
  url: string,
  outputDir: string,
  captionKind: 'manual' | 'auto'
): Promise<string[]> => {
  const sharedArgs = await buildSharedYtDlpArgs()

  return [
    '--skip-download',
    ...(captionKind === 'manual' ? ['--write-subs'] : ['--write-auto-subs']),
    '--sub-langs',
    'en.*,en',
    '--sub-format',
    'vtt/best',
    '--convert-subs',
    'vtt',
    '--output',
    `${outputDir}/youtube-captions.%(ext)s`,
    '--no-playlist',
    ...sharedArgs,
    url
  ]
}

export const buildYtDlpListArgs = async (
  url: string,
  options: YtDlpListOptions = {}
): Promise<string[]> => {
  const sharedArgs = await buildSharedYtDlpArgs()
  const limit = Math.max(1, options.limit ?? 5)
  const all = options.all === true
  const order = options.order ?? 'newest'

  return [
    '--flat-playlist',
    '--dump-json',
    '--no-warnings',
    '--ignore-errors',
    ...(!all ? ['--playlist-end', String(limit)] : []),
    ...(order === 'oldest' ? ['--playlist-reverse'] : []),
    ...sharedArgs,
    url
  ]
}

export const buildYtDlpFailureMessage = (
  operation: 'download' | 'metadata' | 'list' | 'subtitles',
  details: string
): string => {
  const cleanDetails = (details || 'unknown yt-dlp error').trim()

  if (!YOUTUBE_BOT_CHECK_PATTERN.test(cleanDetails)) {
    return `yt-dlp ${operation} failed. ${cleanDetails}`
  }

  return [
    `yt-dlp ${operation} failed. ${cleanDetails}`,
    'Hint: YouTube blocked the anonymous request. See docs/cookies.md for the recommended cookie setup flow, or set YTDLP_COOKIES_FROM_BROWSER=chrome, YTDLP_COOKIES=/absolute/path/to/cookies.txt, or YTDLP_EXTRACTOR_ARGS for a PO token / client override.'
  ].join('\n')
}
