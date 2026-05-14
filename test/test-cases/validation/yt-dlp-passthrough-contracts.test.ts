import { afterEach, describe, expect, test } from 'bun:test'
import { chmod, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { buildOptsFromFlags } from '~/cli/commands/process-steps/step-1-download/targets/build-opts-from-flags'
import { selectBatchItems } from '~/cli/commands/process-steps/step-1-download/targets/batch/batch-select'
import { resolveProcessTargetDoubleDash } from '~/cli/commands/process-steps/step-1-download/targets/handle-process-target'
import { buildDownloadMediaOptions } from '~/cli/commands/process-steps/step-1-download/targets/single/media-runner'
import { resolveYtDlpBinaryInfo } from '~/cli/commands/process-steps/step-1-download/audio/yt-dlp-binary'
import { STABLE_LOCAL_AUDIO_PATH, runCommand } from '../../test-utils/test-helpers'

const EMPTY_CONFIG_PATH = 'test/test-utils/fixtures/empty-autoshow-config.json'
const tempDirs: string[] = []

const createFakeYtDlpBinDir = async (argsLogPath: string): Promise<string> => {
  const dir = await mkdtemp(join(tmpdir(), 'autoshow-fake-ytdlp-'))
  tempDirs.push(dir)
  const ytDlpPath = join(dir, 'yt-dlp')
  const ffmpegPath = join(dir, 'ffmpeg')

  await writeFile(ytDlpPath, `#!/bin/sh
if [ "$1" = "--version" ]; then
  echo "fake-yt-dlp-2026.05.12"
  exit 0
fi
if [ "$1" = "--fail-with-code" ]; then
  exit "$2"
fi
printf '%s\\n' "$@" > "${argsLogPath}"
output_dir=""
previous=""
skip_media_output=0
two_media_output=0
for arg in "$@"; do
  if [ "$arg" = "--no-media-output" ]; then
    skip_media_output=1
  fi
  if [ "$arg" = "--two-media-output" ]; then
    two_media_output=1
  fi
  if [ "$previous" = "--output" ]; then
    output_dir="\${arg%/*}"
  fi
  previous="$arg"
done
if [ -n "$output_dir" ] && [ "$skip_media_output" != "1" ]; then
  mkdir -p "$output_dir"
  media_path="$output_dir/fake-download.mp3"
  dd if=/dev/zero of="$media_path" bs=1201 count=1 >/dev/null 2>&1
  second_media_path="$output_dir/fake-download-2.mp3"
  if [ "$two_media_output" = "1" ]; then
    dd if=/dev/zero of="$second_media_path" bs=1201 count=1 >/dev/null 2>&1
  fi
  previous=""
  print_template_seen=0
  for arg in "$@"; do
    if [ "$print_template_seen" = "1" ]; then
      if [ "$two_media_output" = "1" ]; then
        printf '%s\\n%s\\n' "$media_path" "$second_media_path" > "$arg"
      else
        printf '%s\\n' "$media_path" > "$arg"
      fi
      print_template_seen=0
    elif [ "$previous" = "--print-to-file" ]; then
      print_template_seen=1
    fi
    previous="$arg"
  done
fi
exit 0
`)
  await writeFile(ffmpegPath, '#!/bin/sh\nexit 0\n')
  await chmod(ytDlpPath, 0o755)
  await chmod(ffmpegPath, 0o755)
  return dir
}

const readLoggedArgs = async (path: string): Promise<string[]> =>
  (await readFile(path, 'utf8')).trim().split('\n').filter(Boolean)

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })))
})

describe('yt-dlp binary resolution', () => {
  test('prefers AUTOSHOW_YTDLP_BIN before managed and PATH binaries', () => {
    const resolved = resolveYtDlpBinaryInfo({
      env: { AUTOSHOW_YTDLP_BIN: '/override/yt-dlp' },
      managedPath: '/managed/yt-dlp',
      exists: () => true,
      which: () => '/path/yt-dlp'
    })

    expect(resolved).toEqual({ path: '/override/yt-dlp', source: 'env' })
  })

  test('prefers managed binary before PATH', () => {
    const resolved = resolveYtDlpBinaryInfo({
      env: {},
      managedPath: '/managed/yt-dlp',
      exists: (path) => path === '/managed/yt-dlp',
      which: () => '/path/yt-dlp'
    })

    expect(resolved).toEqual({ path: '/managed/yt-dlp', source: 'managed' })
  })

  test('falls back to PATH when no override or managed binary exists', () => {
    const resolved = resolveYtDlpBinaryInfo({
      env: {},
      managedPath: '/managed/yt-dlp',
      exists: () => false,
      which: () => '/path/yt-dlp'
    })

    expect(resolved).toEqual({ path: '/path/yt-dlp', source: 'path' })
  })
})

describe('yt-dlp passthrough mode resolution', () => {
  test('positional download target plus doubleDash resolves integrated passthrough', () => {
    const resolved = resolveProcessTargetDoubleDash('download', 'https://example.com/audio.mp3', ['--format', 'bestaudio'])

    expect(resolved).toEqual({
      kind: 'target',
      resolvedTarget: 'https://example.com/audio.mp3',
      ytDlpPassthroughArgs: ['--format', 'bestaudio']
    })
  })

  test('download without positional target and option doubleDash resolves raw mode', () => {
    const resolved = resolveProcessTargetDoubleDash('download', undefined, ['--version'])

    expect(resolved).toEqual({
      kind: 'raw-yt-dlp',
      ytDlpPassthroughArgs: ['--version']
    })
  })

  test('single non-option doubleDash remains escaped input', () => {
    const resolved = resolveProcessTargetDoubleDash('download', undefined, ['https://example.com/audio.mp3'])

    expect(resolved).toEqual({
      kind: 'target',
      resolvedTarget: 'https://example.com/audio.mp3'
    })
  })

  test('multiple non-option doubleDash inputs remain a usage error', () => {
    expect(() => resolveProcessTargetDoubleDash('download', undefined, ['one', 'two']))
      .toThrow('Too many positional inputs for "download"')
  })

  test('non-download commands reject doubleDash passthrough', () => {
    expect(() => resolveProcessTargetDoubleDash('extract', 'https://example.com/audio.mp3', ['--write-thumbnail']))
      .toThrow('yt-dlp passthrough (--) is only supported for the "download" command')
  })
})

describe('yt-dlp passthrough execution contracts', () => {
  test('raw mode streams yt-dlp output and propagates raw exit codes', async () => {
    const logDir = await mkdtemp(join(tmpdir(), 'autoshow-raw-ytdlp-log-'))
    tempDirs.push(logDir)
    const argsLogPath = join(logDir, 'args.txt')
    const fakeBinDir = await createFakeYtDlpBinDir(argsLogPath)
    const env = { PATH: `${fakeBinDir}:${process.env['PATH'] ?? ''}`, NO_COLOR: '1' }

    const version = await runCommand([
      'src/cli/create-cli.ts',
      'download',
      '--config-path',
      EMPTY_CONFIG_PATH,
      '--',
      '--version'
    ], { env })
    expect(version.exitCode).toBe(0)
    expect(version.stdout).toContain('fake-yt-dlp-2026.05.12')

    const failed = await runCommand([
      'src/cli/create-cli.ts',
      'download',
      '--config-path',
      EMPTY_CONFIG_PATH,
      '--',
      '--fail-with-code',
      '7'
    ], { env })
    expect(failed.exitCode).toBe(7)
  })

  test('integrated passthrough forwards args for a direct media URL and keeps AutoShow tracking last', async () => {
    const logDir = await mkdtemp(join(tmpdir(), 'autoshow-integrated-ytdlp-log-'))
    tempDirs.push(logDir)
    const argsLogPath = join(logDir, 'args.txt')
    const fakeBinDir = await createFakeYtDlpBinDir(argsLogPath)

    const result = await runCommand([
      'src/cli/create-cli.ts',
      'download',
      'https://example.com/audio.mp3',
      '--keep-original-media',
      '--config-path',
      EMPTY_CONFIG_PATH,
      '--',
      '--format',
      'bestaudio',
      '--write-thumbnail'
    ], {
      env: { PATH: `${fakeBinDir}:${process.env['PATH'] ?? ''}`, NO_COLOR: '1' }
    })
    const args = await readLoggedArgs(argsLogPath)
    const defaultFormatIndex = args.indexOf('--format')
    const userFormatIndex = args.lastIndexOf('--format')
    const printToFileIndex = args.indexOf('--print-to-file')

    expect(result.exitCode).toBe(0)
    expect(defaultFormatIndex).toBeGreaterThanOrEqual(0)
    expect(userFormatIndex).toBeGreaterThan(defaultFormatIndex)
    expect(args[userFormatIndex + 1]).toBe('bestaudio')
    expect(args).toContain('--write-thumbnail')
    expect(printToFileIndex).toBeGreaterThan(userFormatIndex)
    expect(args.at(-1)).toBe('https://example.com/audio.mp3')
  })

  test('integrated passthrough reports a clear error when yt-dlp produces no primary media file', async () => {
    const logDir = await mkdtemp(join(tmpdir(), 'autoshow-integrated-ytdlp-empty-'))
    tempDirs.push(logDir)
    const argsLogPath = join(logDir, 'args.txt')
    const fakeBinDir = await createFakeYtDlpBinDir(argsLogPath)

    const result = await runCommand([
      'src/cli/create-cli.ts',
      'download',
      'https://example.com/audio.mp3',
      '--config-path',
      EMPTY_CONFIG_PATH,
      '--',
      '--no-media-output'
    ], {
      env: { PATH: `${fakeBinDir}:${process.env['PATH'] ?? ''}`, NO_COLOR: '1' }
    })
    const output = `${result.stdout}\n${result.stderr}`

    expect(result.exitCode).toBe(1)
    expect(output).toContain('found no primary media file after yt-dlp passthrough')
    expect(output).toContain('Use raw mode')
  })

  test('integrated passthrough reports a clear error when yt-dlp produces multiple primary media files', async () => {
    const logDir = await mkdtemp(join(tmpdir(), 'autoshow-integrated-ytdlp-multiple-'))
    tempDirs.push(logDir)
    const argsLogPath = join(logDir, 'args.txt')
    const fakeBinDir = await createFakeYtDlpBinDir(argsLogPath)

    const result = await runCommand([
      'src/cli/create-cli.ts',
      'download',
      'https://example.com/audio.mp3',
      '--config-path',
      EMPTY_CONFIG_PATH,
      '--',
      '--two-media-output'
    ], {
      env: { PATH: `${fakeBinDir}:${process.env['PATH'] ?? ''}`, NO_COLOR: '1' }
    })
    const output = `${result.stdout}\n${result.stderr}`

    expect(result.exitCode).toBe(1)
    expect(output).toContain('found multiple media files after yt-dlp passthrough')
    expect(output).toContain('Use raw mode')
  })

  test('local files reject integrated passthrough before download tools run', async () => {
    const result = await runCommand([
      'src/cli/create-cli.ts',
      'download',
      STABLE_LOCAL_AUDIO_PATH,
      '--config-path',
      EMPTY_CONFIG_PATH,
      '--',
      '--write-thumbnail'
    ], {
      env: { NO_COLOR: '1' }
    })

    expect(result.exitCode).toBe(2)
    expect(`${result.stdout}\n${result.stderr}`).toContain('yt-dlp passthrough args (--) are only supported for media URL downloads')
  })

  test('document URLs reject integrated passthrough', async () => {
    const result = await runCommand([
      'src/cli/create-cli.ts',
      'download',
      'https://example.com/report.pdf',
      '--config-path',
      EMPTY_CONFIG_PATH,
      '--',
      '--write-thumbnail'
    ], {
      env: { NO_COLOR: '1' }
    })

    expect(result.exitCode).toBe(2)
    expect(`${result.stdout}\n${result.stderr}`).toContain('yt-dlp passthrough args (--) are only supported for media URL downloads')
  })

  test('batch download option flow preserves passthrough while suppressing direct fetch', () => {
    const resolved = resolveProcessTargetDoubleDash('download', 'input/examples/batch/2-urls.md', ['--format', 'bestaudio'])
    if (resolved.kind !== 'target') {
      throw new Error('expected integrated passthrough target mode')
    }
    const opts = buildOptsFromFlags(true, {
      'batch-limit': '2',
      'batch-concurrency': '3',
      'flat-batch': true,
      'keep-original-media': true,
      'best-quality': true
    })
    opts.ytDlpPassthroughArgs = resolved.ytDlpPassthroughArgs
    const selectedItems = selectBatchItems([
      { id: 'episode-1', url: 'https://example.com/feed-audio-1.mp3', directDownload: true },
      { id: 'episode-2', url: 'https://example.com/feed-audio-2.mp3', directDownload: true },
      { id: 'episode-3', url: 'https://example.com/feed-audio-3.mp3', directDownload: true }
    ], {
      limit: opts.batchLimit,
      all: opts.batchAll,
      order: opts.batchOrder
    })

    const options = buildDownloadMediaOptions(
      selectedItems[0]?.url ?? '',
      '/tmp/autoshow-batch',
      opts,
      {
        isUrl: true,
        exists: false,
        batchItem: selectedItems[0]
      }
    )

    expect(selectedItems).toHaveLength(2)
    expect(opts.batchConcurrency).toBe(3)
    expect(opts.flatBatch).toBe(true)
    expect(options).toMatchObject({
      url: 'https://example.com/feed-audio-1.mp3',
      outputDir: '/tmp/autoshow-batch',
      keepOriginalMedia: true,
      bestQuality: true,
      ytDlpPassthroughArgs: ['--format', 'bestaudio']
    })
    expect(options.directDownload).toBeUndefined()
  })
})
