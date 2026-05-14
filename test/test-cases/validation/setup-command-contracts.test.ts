import { afterEach, describe, expect, test } from 'bun:test'
import { chmod, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { runCommand } from '../../test-utils/test-helpers'
import { CALIBRE_REQUIRED_TOOLS } from '~/cli/commands/setup-and-utilities/setup/setup-download/dl-document/calibre'

const tempDirs: string[] = []

const writeFakeGcloud = async (dir: string): Promise<string> => {
  const bin = join(dir, 'gcloud')
  await writeFile(bin, `#!/bin/sh
if [ "$1 $2" = "auth print-access-token" ]; then
  echo "token-123"
  exit 0
fi
if [ "$1 $2 $3" = "config get-value project" ]; then
  exit 0
fi
exit 1
`)
  await chmod(bin, 0o755)
  return bin
}

const writeFakeAws = async (dir: string): Promise<string> => {
  const bin = join(dir, 'aws')
  await writeFile(bin, `#!/bin/sh
if [ "$1 $2" = "sts get-caller-identity" ]; then
  echo '{"Account":"123456789012","Arn":"arn:aws:iam::123456789012:user/test","UserId":"test-user"}'
  exit 0
fi
if [ "$1 $2 $3" = "configure get region" ]; then
  echo "us-east-1"
  exit 0
fi
if [ "$1 $2" = "transcribe list-transcription-jobs" ]; then
  echo '{"TranscriptionJobSummaries":[]}'
  exit 0
fi
exit 1
`)
  await chmod(bin, 0o755)
  return bin
}

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })))
})

describe('setup command contracts', () => {
  test('allows combined AWS and Google Cloud focused setup', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'autoshow-combined-setup-'))
    tempDirs.push(dir)
    const gcloudBin = await writeFakeGcloud(dir)
    const awsBin = await writeFakeAws(dir)
    const configPath = join(dir, 'autoshow.json')

    const result = await runCommand([
      'src/cli/create-cli.ts',
      'setup',
      '--gcloud',
      '--aws',
      '--config-path',
      configPath
    ], {
      env: {
        AUTOSHOW_GCLOUD_BIN: gcloudBin,
        AUTOSHOW_AWS_BIN: awsBin,
        NO_COLOR: '1'
      }
    })

    expect(result.exitCode).toBe(0)
    const output = `${result.stdout}\n${result.stderr}`
    expect(output).toContain('Google Cloud STT + Document AI OCR + TTS setup')
    expect(output).toContain('AWS STT setup')
    expect(output).not.toContain('Cloudflare')
    expect(output).not.toContain('CLOUDFLARE_API_TOKEN')
    expect(output).not.toContain('--cloudflare')
    expect(output).not.toContain('--gcloud cannot be combined with --aws')
  })

  test('setup help does not expose Cloudflare focused setup', async () => {
    const result = await runCommand(['src/cli/create-cli.ts', 'setup', '--help'], {
      env: { NO_COLOR: '1' }
    })

    expect(result.exitCode).toBe(0)
    expect(result.stdout).toContain('--gcloud')
    expect(result.stdout).toContain('--aws')
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
