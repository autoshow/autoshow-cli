import { chmod, readdir } from 'node:fs/promises'
import { join } from 'node:path'

type WalkPathKind = 'file' | 'directory' | 'any'

type WalkPathsOptions = {
  kind?: WalkPathKind
  maxDepth?: number
}

const normalizeMaxDepth = (maxDepth: number | undefined): number => {
  if (maxDepth === undefined) return Number.POSITIVE_INFINITY
  if (!Number.isFinite(maxDepth)) return Number.POSITIVE_INFINITY
  return Math.max(0, Math.floor(maxDepth))
}

const shouldInclude = (kind: WalkPathKind, entryKind: Exclude<WalkPathKind, 'any'>): boolean =>
  kind === 'any' || kind === entryKind

export const makeExecutable = async (path: string, mode = 0o755): Promise<void> => {
  await chmod(path, mode)
}

export const walkPaths = async (
  root: string,
  options: WalkPathsOptions = {}
): Promise<string[]> => {
  const kind = options.kind ?? 'any'
  const maxDepth = normalizeMaxDepth(options.maxDepth)
  const paths: string[] = []

  const visit = async (directory: string, depth: number): Promise<void> => {
    if (depth >= maxDepth) return

    const entries = (await readdir(directory, { withFileTypes: true }))
      .sort((left, right) => left.name.localeCompare(right.name))
    for (const entry of entries) {
      const fullPath = join(directory, entry.name)
      const entryDepth = depth + 1

      if (entry.isDirectory()) {
        if (shouldInclude(kind, 'directory')) {
          paths.push(fullPath)
        }
        if (entryDepth < maxDepth) {
          await visit(fullPath, entryDepth)
        }
      } else if (entry.isFile() && shouldInclude(kind, 'file')) {
        paths.push(fullPath)
      }
    }
  }

  await visit(root, 0)
  return paths
}

export const findDirectoriesBySuffix = async (
  root: string,
  suffix: string,
  maxDepth = Number.POSITIVE_INFINITY
): Promise<string[]> =>
  (await walkPaths(root, { kind: 'directory', maxDepth }))
    .filter((path) => path.endsWith(suffix))

export const listImmediateDirectories = async (root: string): Promise<string[]> => {
  const entries = (await readdir(root, { withFileTypes: true }))
    .sort((left, right) => left.name.localeCompare(right.name))
  return entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => join(root, entry.name))
}
