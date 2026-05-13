import { describe, expect, test } from 'bun:test'
import { buildYtDlpDownloadArgs } from '~/cli/commands/process-steps/step-1-download/audio/yt-dlp-options'

const valueAfter = (args: string[], flag: string): string | undefined => {
  const index = args.indexOf(flag)
  if (index === -1) {
    return undefined
  }
  return args[index + 1]
}

const indexesOf = (args: string[], value: string): number[] =>
  args.flatMap((arg, index) => arg === value ? [index] : [])

describe('yt-dlp option contracts', () => {
  test('default download args request best audio fallback', async () => {
    const args = await buildYtDlpDownloadArgs('https://example.com/watch?v=1', '/tmp/autoshow')

    expect(valueAfter(args, '--format')).toBe('bestaudio/best')
    expect(args).not.toContain('--merge-output-format')
  })

  test('best-quality download args request best video plus best audio', async () => {
    const args = await buildYtDlpDownloadArgs('https://example.com/watch?v=1', '/tmp/autoshow', {
      bestQuality: true
    })

    expect(valueAfter(args, '--format')).toBe('bestvideo+bestaudio/best')
    expect(valueAfter(args, '--merge-output-format')).toBe('mkv/mp4/webm')
  })

  test('passthrough args are exact argv tokens before the final URL', async () => {
    const args = await buildYtDlpDownloadArgs('https://example.com/watch?v=1', '/tmp/autoshow', {
      ytDlpPassthroughArgs: ['--write-thumbnail', '--postprocessor-args', 'ffmpeg:-vf scale=1280:720']
    })

    expect(args.at(-1)).toBe('https://example.com/watch?v=1')
    expect(args.indexOf('--write-thumbnail')).toBeGreaterThan(args.indexOf('--no-progress'))
    expect(args.indexOf('--write-thumbnail')).toBeLessThan(args.length - 1)
    expect(valueAfter(args, '--postprocessor-args')).toBe('ffmpeg:-vf scale=1280:720')
  })

  test('passthrough format args appear after AutoShow default format', async () => {
    const args = await buildYtDlpDownloadArgs('https://example.com/watch?v=1', '/tmp/autoshow', {
      ytDlpPassthroughArgs: ['--format', 'bestvideo+bestaudio']
    })
    const formatIndexes = indexesOf(args, '--format')
    const firstFormatIndex = formatIndexes[0] as number
    const secondFormatIndex = formatIndexes[1] as number

    expect(formatIndexes.length).toBe(2)
    expect(args[firstFormatIndex + 1]).toBe('bestaudio/best')
    expect(args[secondFormatIndex + 1]).toBe('bestvideo+bestaudio')
    expect(secondFormatIndex).toBeGreaterThan(firstFormatIndex)
  })

  test('empty passthrough produces the same args as undefined passthrough', async () => {
    const withoutPassthrough = await buildYtDlpDownloadArgs('https://example.com/watch?v=1', '/tmp/autoshow')
    const withEmptyPassthrough = await buildYtDlpDownloadArgs('https://example.com/watch?v=1', '/tmp/autoshow', {
      ytDlpPassthroughArgs: []
    })

    expect(withEmptyPassthrough).toEqual(withoutPassthrough)
  })

  test('downloaded path tracking args stay after passthrough and before URL', async () => {
    const args = await buildYtDlpDownloadArgs('https://example.com/watch?v=1', '/tmp/autoshow', {
      ytDlpPassthroughArgs: ['--format', 'bestaudio'],
      downloadedPathLogFile: '/tmp/autoshow/files.txt'
    })

    expect(args.at(-1)).toBe('https://example.com/watch?v=1')
    expect(valueAfter(args, '--print-to-file')).toBe('after_move:filepath')
    expect(args[args.indexOf('--print-to-file') + 2]).toBe('/tmp/autoshow/files.txt')
    expect(args.indexOf('--print-to-file')).toBeGreaterThan(args.lastIndexOf('--format'))
    expect(args.indexOf('--print-to-file')).toBeLessThan(args.length - 1)
  })
})
