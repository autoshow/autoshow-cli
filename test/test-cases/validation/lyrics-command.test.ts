import { afterEach, expect, test } from 'bun:test'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { runCommand } from '../../test-utils/test-helpers'

const SHORT_AUDIO_PATH = 'input/examples/audio/0-audio-short.mp3'
const tempDirs: string[] = []

const createTempDir = async (): Promise<string> => {
  const dir = await mkdtemp(join(tmpdir(), 'autoshow-lyrics-cli-'))
  tempDirs.push(dir)
  return dir
}

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map(async (dir) => {
    await rm(dir, { recursive: true, force: true })
  }))
})

test('lyrics help includes lyric-specific flags and excludes price mode', async () => {
  const result = await runCommand(['src/cli/create-cli.ts', 'lyrics', '--help'])

  expect(result.exitCode).toBe(0)
  expect(result.stdout).toContain('--batch')
  expect(result.stdout).toContain('--audio')
  expect(result.stdout).toContain('--captions')
  expect(result.stdout).toContain('--model')
  expect(result.stdout).toContain('--font')
  expect(result.stdout).toContain('--keep-tmp')
  expect(result.stdout).not.toContain('--price')
})

test('setup help includes lyrics as a supported setup step', async () => {
  const result = await runCommand(['src/cli/create-cli.ts', 'setup', '--help'])

  expect(result.exitCode).toBe(0)
  expect(result.stdout).toContain('lyrics')
})

test('lyrics rejects invalid whisper model ids', async () => {
  const result = await runCommand(['src/cli/create-cli.ts', 'lyrics', '--audio', SHORT_AUDIO_PATH, '--model', 'tiny.en'])
  expect(result.exitCode).toBe(2)
})

test('lyrics rejects removed rendering flags with explicit usage errors', async () => {
  const result = await runCommand(['src/cli/create-cli.ts', 'lyrics', '--audio', SHORT_AUDIO_PATH, '--res', '1280x720'])

  expect(result.exitCode).toBe(2)
  expect(result.stderr).toContain('--res has been removed')
})

test('lyrics rejects --price because it is local-only', async () => {
  const result = await runCommand(['src/cli/create-cli.ts', 'lyrics', '--audio', SHORT_AUDIO_PATH, '--price'])

  expect(result.exitCode).toBe(2)
  expect(result.stderr).toContain('does not support --price')
})

test('lyrics rejects --audio paths outside the repo input directory', async () => {
  const tempDir = await createTempDir()
  const audioPath = join(tempDir, 'external.mp3')
  await writeFile(audioPath, 'not really audio')

  const result = await runCommand(['src/cli/create-cli.ts', 'lyrics', '--audio', audioPath])

  expect(result.exitCode).toBe(2)
  expect(result.stderr).toContain('--audio must point to a file inside ./input')
})

test('lyrics rejects --captions paths outside the repo output directory', async () => {
  const tempDir = await createTempDir()
  const captionsPath = join(tempDir, 'external.vtt')
  await writeFile(captionsPath, 'WEBVTT\n')

  const result = await runCommand([
    'src/cli/create-cli.ts',
    'lyrics',
    '--audio',
    SHORT_AUDIO_PATH,
    '--captions',
    captionsPath
  ])

  expect(result.exitCode).toBe(2)
  expect(result.stderr).toContain('--captions must point to a file inside ./output')
})

test('lyrics rejects mixing --batch with --audio', async () => {
  const result = await runCommand(['src/cli/create-cli.ts', 'lyrics', '--batch', '--audio', SHORT_AUDIO_PATH])

  expect(result.exitCode).toBe(2)
  expect(result.stderr).toContain('Do not use --audio with --batch')
})
