import { afterEach, describe, expect, test } from 'bun:test'
import { mkdir, mkdtemp, rm, stat, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { findDirectoriesBySuffix, listImmediateDirectories, makeExecutable, walkPaths } from '~/utils/filesystem'

const tempDirs: string[] = []

const makeTempDir = async (): Promise<string> => {
  const dir = await mkdtemp(join(tmpdir(), 'autoshow-filesystem-'))
  tempDirs.push(dir)
  return dir
}

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })))
})

describe('filesystem helpers', () => {
  test('walkPaths honors kind and maxDepth', async () => {
    const root = await makeTempDir()
    await mkdir(join(root, 'one', 'two'), { recursive: true })
    await writeFile(join(root, 'root.txt'), 'root')
    await writeFile(join(root, 'one', 'one.txt'), 'one')
    await writeFile(join(root, 'one', 'two', 'two.txt'), 'two')

    expect((await walkPaths(root, { kind: 'file', maxDepth: 1 })).map((path) => path.replace(`${root}/`, '')).sort())
      .toEqual(['root.txt'])
    expect((await walkPaths(root, { kind: 'file', maxDepth: 2 })).map((path) => path.replace(`${root}/`, '')).sort())
      .toEqual(['one/one.txt', 'root.txt'])
  })

  test('findDirectoriesBySuffix returns suffix matches inside maxDepth', async () => {
    const root = await makeTempDir()
    await mkdir(join(root, 'build', 'encoder.mlmodelc'), { recursive: true })
    await mkdir(join(root, 'build', 'nested', 'too-deep.mlmodelc'), { recursive: true })

    const matches = await findDirectoriesBySuffix(root, '.mlmodelc', 2)

    expect(matches.map((path) => path.replace(`${root}/`, ''))).toEqual(['build/encoder.mlmodelc'])
  })

  test('listImmediateDirectories ignores files and nested directories', async () => {
    const root = await makeTempDir()
    await mkdir(join(root, 'cache-a', 'nested'), { recursive: true })
    await mkdir(join(root, 'cache-b'), { recursive: true })
    await writeFile(join(root, 'entry.json'), '{}')

    const directories = await listImmediateDirectories(root)

    expect(directories.map((path) => path.replace(`${root}/`, ''))).toEqual(['cache-a', 'cache-b'])
  })

  test('makeExecutable applies executable mode', async () => {
    const root = await makeTempDir()
    const script = join(root, 'tool')
    await writeFile(script, '#!/bin/sh\nexit 0\n')

    await makeExecutable(script)

    expect((await stat(script)).mode & 0o111).toBeGreaterThan(0)
  })
})
