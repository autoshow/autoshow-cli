import { describe, expect, test } from 'bun:test'
import { buildYtDlpDownloadArgs } from '~/cli/commands/process-steps/step-1-download/audio/yt-dlp-options'

const valueAfter = (args: string[], flag: string): string | undefined => {
  const index = args.indexOf(flag)
  if (index === -1) {
    return undefined
  }
  return args[index + 1]
}

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
})
