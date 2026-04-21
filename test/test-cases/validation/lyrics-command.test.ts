import { afterEach, expect, test } from 'bun:test'
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises'
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

const createLyricsAlbumFixture = async (baseDir: string, files: Record<string, string>): Promise<string> => {
  const albumDir = baseDir
  const textDir = join(albumDir, 'text')
  await mkdir(textDir, { recursive: true })
  await writeFile(join(albumDir, 'prompt.md'), 'Write song lyrics from the provided source text.\n')
  await writeFile(join(albumDir, 'tracks.md'), '1. Track One\n2. Track Two\n')

  for (const [name, contents] of Object.entries(files)) {
    await writeFile(join(textDir, name), contents)
  }

  return albumDir
}

const createTempLyricsAlbumFixture = async (files: Record<string, string>): Promise<string> => {
  const dir = await createTempDir()
  return await createLyricsAlbumFixture(dir, files)
}

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map(async (dir) => {
    await rm(dir, { recursive: true, force: true })
  }))
})

test('lyrics help includes render and generation flags', async () => {
  const result = await runCommand(['src/cli/create-cli.ts', 'lyrics', '--help'])

  expect(result.exitCode).toBe(0)
  expect(result.stdout).toContain('--batch')
  expect(result.stdout).toContain('--audio')
  expect(result.stdout).toContain('--captions')
  expect(result.stdout).toContain('--model')
  expect(result.stdout).toContain('--font')
  expect(result.stdout).toContain('--keep-tmp')
  expect(result.stdout).toContain('--openai')
  expect(result.stdout).toContain('--prompt-file')
  expect(result.stdout).toContain('--track-list')
  expect(result.stdout).toContain('--price')
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
  expect(result.stderr).toContain('Unexpected flag: res')
})

test('lyrics render mode rejects --price', async () => {
  const result = await runCommand(['src/cli/create-cli.ts', 'lyrics', '--audio', SHORT_AUDIO_PATH, '--price'])

  expect(result.exitCode).toBe(2)
  expect(result.stderr).toContain('does not support --price')
})

test('lyrics render mode rejects generation flags', async () => {
  const result = await runCommand([
    'src/cli/create-cli.ts',
    'lyrics',
    '--audio',
    SHORT_AUDIO_PATH,
    '--openai',
    'gpt-5.4'
  ])

  expect(result.exitCode).toBe(2)
  expect(result.stderr).toContain('render mode does not support --openai')
})

test('lyrics generation mode rejects render flags', async () => {
  const albumDir = await createTempLyricsAlbumFixture({
    '01-track-one.md': 'A short source text for the first song.'
  })

  const result = await runCommand([
    'src/cli/create-cli.ts',
    'lyrics',
    albumDir,
    '--audio',
    SHORT_AUDIO_PATH
  ])

  expect(result.exitCode).toBe(2)
  expect(result.stderr).toContain('generation mode does not support --audio')
})

test('lyrics generation mode resolves ./albums fallback with --price', async () => {
  const repoAlbumDir = join(process.cwd(), 'albums', `lyrics-validation-${Date.now()}`)
  tempDirs.push(repoAlbumDir)
  await createLyricsAlbumFixture(repoAlbumDir, {
    '01-track-one.md': 'A short source text for the first song.'
  })

  const result = await runCommand([
    'src/cli/create-cli.ts',
    'lyrics',
    repoAlbumDir.split('/').pop() as string,
    '--price'
  ])

  expect(result.exitCode).toBe(0)
  const combined = `${result.stdout}\n${result.stderr}`
  expect(combined).toContain('Expected output directory:')
  expect(combined).toContain('/lyrics/*.md')
})

test('lyrics generation mode accepts extensionless file lookup with --price', async () => {
  const albumDir = await createTempLyricsAlbumFixture({
    '01-track-one.md': 'A short source text for the first song.'
  })

  const result = await runCommand([
    'src/cli/create-cli.ts',
    'lyrics',
    albumDir,
    '01-track-one',
    '--price'
  ])

  expect(result.exitCode).toBe(0)
  const combined = `${result.stdout}\n${result.stderr}`
  expect(combined).toContain('Expected files:')
  expect(combined).toContain('/lyrics/*.md')
})

test('lyrics generation mode rejects ambiguous extensionless file lookup', async () => {
  const albumDir = await createTempLyricsAlbumFixture({
    '01-track-one.md': 'A short source text for the first song.',
    '01-track-one.txt': 'An alternate source text with the same stem.'
  })

  const result = await runCommand([
    'src/cli/create-cli.ts',
    'lyrics',
    albumDir,
    '01-track-one',
    '--price'
  ])

  expect(result.exitCode).toBe(2)
  expect(result.stderr).toContain('is ambiguous')
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
