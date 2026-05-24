import { describe, expect, test } from 'bun:test'
import { runCommand } from '../../test-utils/test-helpers'
import { CALIBRE_REQUIRED_TOOLS } from '~/cli/commands/setup-and-utilities/setup/setup-download/dl-document/calibre'

describe('setup command contracts', () => {
  test('setup help does not expose Cloudflare focused setup', async () => {
    const result = await runCommand(['src/cli/create-cli.ts', 'setup', '--help'], {
      env: { NO_COLOR: '1' }
    })

    expect(result.exitCode).toBe(0)
    expect(result.stdout).toContain('defuddle')
    expect(result.stdout).not.toContain('--cloudflare')
    expect(result.stdout).not.toContain('Cloudflare')
  })

  test('setup usage contracts include the defuddle step', async () => {
    const result = await runCommand(['src/cli/create-cli.ts', 'setup', '--step', 'not-real'], {
      env: { NO_COLOR: '1' }
    })

    expect(result.exitCode).toBe(2)
    expect(`${result.stdout}\n${result.stderr}`).toContain('defuddle')
  })

  test('Linux yt-dlp setup writes the managed runtime binary without sudo chmod or mv', async () => {
    const source = await Bun.file('src/cli/commands/setup-and-utilities/setup/setup-download/dl-audio/audio.ts').text()

    expect(source).toContain('ytDlpManagedBinaryPath')
    expect(source).toContain('makeExecutable(ytDlpManagedBinaryPath)')
    expect(source).not.toContain("runInherit('sudo', ['mv'")
    expect(source).not.toContain("runInherit('sudo', ['chmod'")
  })

  test('command existence checks use Bun APIs instead of shell test', async () => {
    const setupSource = await Bun.file('src/cli/commands/setup-and-utilities/setup/run-complete-setup.ts').text()
    const utilSource = await Bun.file('src/utils/cli-utils.ts').text()
    const combinedSource = `${setupSource}\n${utilSource}`

    expect(combinedSource).toContain('Bun.which(command)')
    expect(combinedSource).not.toContain('test -x')
  })

  test('Calibre setup only requires ebook-convert for ebook normalization', () => {
    const tools = [...CALIBRE_REQUIRED_TOOLS]
    expect(tools).toEqual(['ebook-convert'])
    expect(tools).not.toContain('calibre-debug')
    expect(tools).not.toContain('ebook-meta')
  })
})
