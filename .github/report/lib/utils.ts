/**
 * Utility functions for file system operations
 */

import { stat, mkdir, readdir } from 'node:fs/promises'
import { join } from 'node:path'

export async function getFileSize(path: string): Promise<number> {
  try {
    const s = await stat(path)
    return s.size
  } catch {
    return 0
  }
}

export async function fileExists(path: string): Promise<boolean> {
  try {
    await stat(path)
    return true
  } catch {
    return false
  }
}

export async function ensureDir(dir: string): Promise<void> {
  try {
    await mkdir(dir, { recursive: true })
  } catch {
    // Directory might already exist
  }
}

export async function getDirectorySize(dir: string): Promise<number> {
  let total = 0
  try {
    const entries = await readdir(dir, { withFileTypes: true, recursive: true })
    for (const entry of entries) {
      if (entry.isFile()) {
        const fullPath = join(entry.parentPath || dir, entry.name)
        total += await getFileSize(fullPath)
      }
    }
  } catch {
    // Directory might not exist
  }
  return total
}

export async function getFileMtime(path: string): Promise<number> {
  try {
    const s = await stat(path)
    return s.mtimeMs
  } catch {
    return 0
  }
}
