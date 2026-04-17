import { readdir } from 'node:fs/promises'
import { join, resolve } from 'node:path'

const isRunDirectory = async (targetDir: string): Promise<boolean> => {
  const entries = await readdir(targetDir).catch(() => null)
  if (!entries) {
    return false
  }

  return entries.includes('providers') && entries.includes('run.json')
}

export const listProviderDirectories = async (runDir: string): Promise<string[]> => {
  const providerEntries = await readdir(join(runDir, 'providers'), { withFileTypes: true }).catch(() => [])
  return providerEntries
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort((left, right) => left.localeCompare(right))
}

export const discoverRunDirectories = async (
  targetPath: string,
  missingRunsMessage: (resolvedTarget: string) => string
): Promise<string[]> => {
  const resolvedTarget = resolve(targetPath)
  const directEntries = await readdir(resolvedTarget, { withFileTypes: true }).catch(() => null)
  if (!directEntries) {
    throw new Error(`Target path does not exist or is not readable: ${resolvedTarget}`)
  }

  if (await isRunDirectory(resolvedTarget)) {
    return [resolvedTarget]
  }

  const runDirectories: string[] = []
  for (const entry of directEntries) {
    if (!entry.isDirectory()) {
      continue
    }

    const childDir = join(resolvedTarget, entry.name)
    if (await isRunDirectory(childDir)) {
      runDirectories.push(childDir)
    }
  }

  if (runDirectories.length === 0) {
    throw new Error(missingRunsMessage(resolvedTarget))
  }

  return runDirectories.sort()
}
