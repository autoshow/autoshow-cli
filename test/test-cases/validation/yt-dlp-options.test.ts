import { afterEach, describe, expect, test } from 'bun:test'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  buildSharedYtDlpArgs,
  buildYtDlpDownloadArgs,
  buildYtDlpFailureMessage,
  buildYtDlpListArgs,
  buildYtDlpMetadataArgs,
  buildYtDlpSubtitleDownloadArgs,
  inspectYtDlpAuthState,
  resetYtDlpOptionWarningStateForTests
} from '~/cli/commands/process-steps/step-1-download/audio/yt-dlp-options'
import {
  buildYoutubeCollectionListArgs
} from '~/cli/commands/process-steps/step-1-download/targets/youtube-collection-target'
import {
  buildYoutubeChannelListArgs
} from '~/cli/commands/process-steps/step-1-download/targets/youtube-channel-provider'

const ENV_KEYS = [
  'YTDLP_ACCEPT_LANGUAGE',
  'YTDLP_USER_AGENT',
  'YTDLP_COOKIES_FROM_BROWSER',
  'YTDLP_COOKIES',
  'YTDLP_EXTRACTOR_ARGS',
  'YTDLP_NO_CHECK_CERTS'
] as const

const ORIGINAL_ENV = Object.fromEntries(
  ENV_KEYS.map(key => [key, process.env[key]])
) as Record<(typeof ENV_KEYS)[number], string | undefined>
const tempDirs: string[] = []

const restoreEnv = (): void => {
  for (const key of ENV_KEYS) {
    const value = ORIGINAL_ENV[key]
    if (value === undefined) {
      delete process.env[key]
    } else {
      process.env[key] = value
    }
  }
}

afterEach(async () => {
  restoreEnv()
  resetYtDlpOptionWarningStateForTests()
  await Promise.all(tempDirs.splice(0).map(dir => rm(dir, { recursive: true, force: true })))
})

describe('yt-dlp option builders', () => {
  test('YTDLP_COOKIES takes precedence when the file is readable', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'autoshow-yt-dlp-'))
    tempDirs.push(dir)
    const cookiesPath = join(dir, 'youtube.cookies.txt')
    await writeFile(cookiesPath, '# Netscape HTTP Cookie File\n.youtube.com\tTRUE\t/\tTRUE\t4102444800\tSID\tabc\n')

    process.env['YTDLP_ACCEPT_LANGUAGE'] = 'en-US,en;q=0.9'
    process.env['YTDLP_USER_AGENT'] = 'autoshow-test-agent'
    process.env['YTDLP_COOKIES_FROM_BROWSER'] = 'chrome:Default'
    process.env['YTDLP_COOKIES'] = cookiesPath
    process.env['YTDLP_EXTRACTOR_ARGS'] = 'youtube:player_client=tv'
    process.env['YTDLP_NO_CHECK_CERTS'] = 'true'

    await expect(inspectYtDlpAuthState()).resolves.toMatchObject({
      configuredMode: 'cookies-file',
      usableMode: 'cookies-file',
      cookiesPath,
      resolvedCookiesPath: cookiesPath,
      cookiesReadable: true,
      cookieArgs: ['--cookies', cookiesPath]
    })

    await expect(buildSharedYtDlpArgs()).resolves.toEqual([
      '--add-header',
      'Accept-Language: en-US,en;q=0.9',
      '--user-agent',
      'autoshow-test-agent',
      '--cookies',
      cookiesPath,
      '--no-check-certificates',
      '--extractor-args',
      'youtube:player_client=tv'
    ])
  })

  test('omits blank env values from shared args', async () => {
    process.env['YTDLP_ACCEPT_LANGUAGE'] = '   '
    process.env['YTDLP_USER_AGENT'] = ''
    process.env['YTDLP_COOKIES_FROM_BROWSER'] = ' '
    process.env['YTDLP_COOKIES'] = ''
    process.env['YTDLP_EXTRACTOR_ARGS'] = '   '
    process.env['YTDLP_NO_CHECK_CERTS'] = 'false'

    await expect(buildSharedYtDlpArgs()).resolves.toEqual([])
  })

  test('does not fall back to browser cookies when YTDLP_COOKIES is unreadable', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'autoshow-yt-dlp-'))
    tempDirs.push(dir)
    const missingCookiesPath = join(dir, 'missing.cookies.txt')

    process.env['YTDLP_COOKIES_FROM_BROWSER'] = 'firefox'
    process.env['YTDLP_COOKIES'] = missingCookiesPath

    await expect(inspectYtDlpAuthState()).resolves.toMatchObject({
      configuredMode: 'cookies-file',
      usableMode: 'none',
      cookiesPath: missingCookiesPath,
      resolvedCookiesPath: missingCookiesPath,
      cookiesReadable: false,
      cookieArgs: [],
      warning: `YTDLP_COOKIES is set but unreadable: ${missingCookiesPath}. Fix or remove it before retrying yt-dlp auth.`
    })

    await expect(buildSharedYtDlpArgs()).resolves.toEqual([])
  })

  test('threads browser-cookie auth into metadata, download, and list invocations', async () => {
    process.env['YTDLP_COOKIES_FROM_BROWSER'] = 'firefox'

    await expect(buildYtDlpMetadataArgs('https://example.com/watch?v=abc')).resolves.toEqual([
      '--dump-json',
      '--no-playlist',
      '--quiet',
      '--cookies-from-browser',
      'firefox',
      'https://example.com/watch?v=abc'
    ])

    await expect(buildYtDlpDownloadArgs('https://example.com/watch?v=abc', '/tmp/out')).resolves.toEqual([
      '--format',
      'bestaudio/best',
      '--output',
      '/tmp/out/%(title)s.%(ext)s',
      '--restrict-filenames',
      '--no-playlist',
      '--progress',
      '--newline',
      '--progress-delta',
      '1',
      '--cookies-from-browser',
      'firefox',
      'https://example.com/watch?v=abc'
    ])

    await expect(buildYtDlpListArgs('https://example.com/@channel/videos', {
      limit: 3,
      all: false,
      order: 'oldest'
    })).resolves.toEqual([
      '--flat-playlist',
      '--dump-json',
      '--no-warnings',
      '--ignore-errors',
      '--playlist-end',
      '3',
      '--playlist-reverse',
      '--cookies-from-browser',
      'firefox',
      'https://example.com/@channel/videos'
    ])
  })

  test('builds subtitle download args for manual and auto YouTube captions', async () => {
    process.env['YTDLP_COOKIES_FROM_BROWSER'] = 'firefox'

    await expect(buildYtDlpSubtitleDownloadArgs('https://example.com/watch?v=abc', '/tmp/out', 'manual')).resolves.toEqual([
      '--skip-download',
      '--write-subs',
      '--sub-langs',
      'en.*,en',
      '--sub-format',
      'vtt/best',
      '--convert-subs',
      'vtt',
      '--output',
      '/tmp/out/youtube-captions.%(ext)s',
      '--no-playlist',
      '--cookies-from-browser',
      'firefox',
      'https://example.com/watch?v=abc'
    ])

    await expect(buildYtDlpSubtitleDownloadArgs('https://example.com/watch?v=abc', '/tmp/out', 'auto')).resolves.toEqual([
      '--skip-download',
      '--write-auto-subs',
      '--sub-langs',
      'en.*,en',
      '--sub-format',
      'vtt/best',
      '--convert-subs',
      'vtt',
      '--output',
      '/tmp/out/youtube-captions.%(ext)s',
      '--no-playlist',
      '--cookies-from-browser',
      'firefox',
      'https://example.com/watch?v=abc'
    ])
  })

  test('channel and collection list helpers both inherit shared auth args', async () => {
    process.env['YTDLP_COOKIES_FROM_BROWSER'] = 'firefox'

    await expect(buildYoutubeCollectionListArgs('https://www.youtube.com/playlist?list=abc')).resolves.toEqual([
      '--flat-playlist',
      '--dump-json',
      '--no-warnings',
      '--ignore-errors',
      '--cookies-from-browser',
      'firefox',
      'https://www.youtube.com/playlist?list=abc'
    ])

    await expect(buildYoutubeChannelListArgs('https://www.youtube.com/@autoshow/videos', {
      limit: 2,
      all: false,
      order: 'oldest'
    })).resolves.toEqual([
      '--flat-playlist',
      '--dump-json',
      '--no-warnings',
      '--ignore-errors',
      '--playlist-end',
      '2',
      '--playlist-reverse',
      '--cookies-from-browser',
      'firefox',
      'https://www.youtube.com/@autoshow/videos'
    ])
  })
})

describe('buildYtDlpFailureMessage', () => {
  test('adds a YouTube auth hint for bot-check failures', () => {
    const message = buildYtDlpFailureMessage(
      'download',
      "ERROR: [youtube] abc123: Sign in to confirm you're not a bot"
    )

    expect(message).toContain('yt-dlp download failed.')
    expect(message).toContain("Sign in to confirm you're not a bot")
    expect(message).toContain('docs/cookies.md')
    expect(message).toContain('YTDLP_COOKIES_FROM_BROWSER')
    expect(message).toContain('YTDLP_COOKIES')
    expect(message).toContain('YTDLP_EXTRACTOR_ARGS')
  })

  test('leaves non-auth failures unchanged apart from the prefix', () => {
    expect(buildYtDlpFailureMessage('metadata', 'ERROR: unavailable')).toBe(
      'yt-dlp metadata failed. ERROR: unavailable'
    )
  })
})
