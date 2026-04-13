import { afterEach, expect, test } from 'bun:test'
import { copyFile, mkdtemp, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { runCommand, STABLE_LOCAL_AUDIO_PATH } from '../../test-utils/test-helpers'

const tempDirs: string[] = []

const createTempDir = async (): Promise<string> => {
  const dir = await mkdtemp(join(tmpdir(), 'autoshow-directory-batch-'))
  tempDirs.push(dir)
  return dir
}

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map(async (dir) => {
    await rm(dir, { recursive: true, force: true })
  }))
})

test('directory batch respects --batch-concurrency for metadata runs', async () => {
  const tempDir = await createTempDir()
  await copyFile(STABLE_LOCAL_AUDIO_PATH, join(tempDir, 'one.mp3'))
  await copyFile(STABLE_LOCAL_AUDIO_PATH, join(tempDir, 'two.mp3'))

  const result = await runCommand([
    'src/cli/create-cli.ts',
    'metadata',
    tempDir,
    '--batch-all',
    '--batch-concurrency',
    '2'
  ])

  const output = `${result.stdout}\n${result.stderr}`

  expect(result.exitCode).toBe(0)
  expect(output).toContain('Processing 2 items with concurrency 2')
})
