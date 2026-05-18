import { afterEach, expect, test } from 'bun:test'
import { mkdir, mkdtemp, rm, stat, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { basename, join } from 'node:path'
import { createGenerationOutputDir } from '~/cli/commands/process-steps/generation-command-utils'

const tempDirs: string[] = []

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })))
})

const makeTempRoot = async (): Promise<string> => {
  const root = await mkdtemp(join(tmpdir(), 'autoshow-generation-output-dir-'))
  tempDirs.push(root)
  return root
}

test('explicit generation output directories are exact and reusable', async () => {
  const root = await makeTempRoot()
  const exactDir = join(root, 'exact-run')

  const createdDir = await createGenerationOutputDir('image-gen', { 'output-dir': exactDir })

  expect(createdDir).toBe(exactDir)
  expect(basename(createdDir)).toBe('exact-run')
  expect((await stat(exactDir)).isDirectory()).toBe(true)

  const existingDir = join(root, 'existing-run')
  await mkdir(existingDir)

  await expect(createGenerationOutputDir('image-gen', { out: existingDir })).resolves.toBe(existingDir)

  const filePath = join(root, 'not-a-directory')
  await writeFile(filePath, 'not a directory')

  await expect(createGenerationOutputDir('image-gen', { 'output-dir': filePath }))
    .rejects
    .toThrow(`Output path exists and is not a directory: ${filePath}`)
})
