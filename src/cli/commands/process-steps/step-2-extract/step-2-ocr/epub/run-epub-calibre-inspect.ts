import { mkdtemp, readdir, readFile, rm, stat } from 'node:fs/promises'
import { join, relative } from 'node:path'
import { tmpdir } from 'node:os'
import { exec } from '~/utils/cli-utils'
import { ensureCalibreDocumentTools, calibreBin } from '~/cli/commands/setup-and-utilities/setup/setup-download/dl-document/calibre'
import { inspectEpubWithReader, normalizeEntryPath } from './inspect-core'
import type { EpubContentEntry, EpubContentReader, EpubInspectOutput } from '~/types'


const walkFiles = async (rootDir: string): Promise<EpubContentEntry[]> => {
  const entries: EpubContentEntry[] = []
  const queue = [rootDir]

  while (queue.length > 0) {
    const current = queue.shift() as string
    const children = await readdir(current)
    for (const child of children) {
      const absPath = join(current, child)
      const info = await stat(absPath)
      if (info.isDirectory()) {
        queue.push(absPath)
        continue
      }
      const relPath = normalizeEntryPath(relative(rootDir, absPath))
      entries.push({
        path: relPath,
        size: info.size
      })
    }
  }

  return entries.sort((a, b) => a.path.localeCompare(b.path))
}

const createExplodedReader = (rootDir: string, entries: EpubContentEntry[]): EpubContentReader => {
  const byPath = new Map(entries.map(entry => [entry.path, join(rootDir, entry.path)]))

  return {
    adapterLabel: 'calibre-exploded',
    entries,
    hasEntry: (entryPath: string) => byPath.has(normalizeEntryPath(entryPath)),
    readText: async (entryPath: string) => {
      const normalized = normalizeEntryPath(entryPath)
      const absPath = byPath.get(normalized)
      if (!absPath) {
        throw new Error(`Exploded EPUB entry not found: ${normalized}`)
      }
      return await readFile(absPath, 'utf8')
    }
  }
}

export const runEpubCalibreInspect = async (filePath: string): Promise<EpubInspectOutput> => {
  await ensureCalibreDocumentTools()

  const tempRoot = await mkdtemp(join(tmpdir(), 'autoshow-epub-calibre-'))
  const explodeDir = join(tempRoot, 'exploded')

  try {
    const explodeResult = await exec(calibreBin('calibre-debug'), ['--explode-book', filePath, explodeDir])
    if (explodeResult.exitCode !== 0) {
      throw new Error(explodeResult.stderr || explodeResult.stdout || 'calibre-debug --explode-book failed')
    }

    const entries = await walkFiles(explodeDir)
    const reader = createExplodedReader(explodeDir, entries)

    return await inspectEpubWithReader(reader, 'calibre')
  } finally {
    await rm(tempRoot, { recursive: true, force: true })
  }
}
