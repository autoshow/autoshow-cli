/**
 * FileSystemTracker class for monitoring file system changes during setup
 */

import { watch, type FSWatcher } from 'node:fs'
import { join } from 'node:path'
import type { FileOperation, StorageMetrics } from '../types.ts'
import { WATCH_DIRS } from '../constants.ts'
import { fileExists, ensureDir, getFileSize, getDirectorySize } from './utils.ts'

export class FileSystemTracker {
  private watchers: FSWatcher[] = []
  private operations: FileOperation[] = []
  private baseDir: string
  private initialSizes: Map<string, number> = new Map()
  private seenPaths: Set<string> = new Set()

  constructor(baseDir: string) {
    this.baseDir = baseDir
  }

  async snapshotInitialState(): Promise<void> {
    for (const dir of WATCH_DIRS) {
      const fullDir = join(this.baseDir, dir)
      if (await fileExists(fullDir)) {
        const size = await getDirectorySize(fullDir)
        this.initialSizes.set(dir, size)
      } else {
        this.initialSizes.set(dir, 0)
      }
    }
  }

  async startWatching(): Promise<void> {
    for (const dir of WATCH_DIRS) {
      const fullDir = join(this.baseDir, dir)
      await ensureDir(fullDir)

      try {
        const watcher = watch(fullDir, { recursive: true }, (eventType, filename) => {
          if (filename) {
            this.handleFileEvent(eventType, join(dir, filename))
          }
        })
        this.watchers.push(watcher)
      } catch (err) {
        // Directory might not be watchable, continue
        console.error(`Warning: Could not watch ${fullDir}:`, err)
      }
    }
  }

  private async handleFileEvent(eventType: string, relativePath: string): Promise<void> {
    const fullPath = join(this.baseDir, relativePath)
    const timestamp = new Date().toISOString()

    // Debounce: skip if we've seen this path very recently
    const key = `${eventType}:${relativePath}`
    if (this.seenPaths.has(key)) return
    this.seenPaths.add(key)
    setTimeout(() => this.seenPaths.delete(key), 100)

    const size = await getFileSize(fullPath)
    const exists = await fileExists(fullPath)

    let type: 'created' | 'modified' | 'deleted'
    if (!exists) {
      type = 'deleted'
    } else if (eventType === 'rename') {
      type = 'created'
    } else {
      type = 'modified'
    }

    this.operations.push({
      type,
      path: fullPath,
      relativePath,
      timestamp,
      size,
    })
  }

  stopWatching(): void {
    for (const watcher of this.watchers) {
      watcher.close()
    }
    this.watchers = []
  }

  getOperations(): FileOperation[] {
    return this.operations
  }

  async calculateStorageMetrics(): Promise<StorageMetrics> {
    const byDirectory: Record<string, number> = {}
    let totalBytesAdded = 0
    let totalBytesModified = 0
    const fileSizes: Array<{ path: string; size: number }> = []

    for (const dir of WATCH_DIRS) {
      const fullDir = join(this.baseDir, dir)
      const currentSize = await getDirectorySize(fullDir)
      const initialSize = this.initialSizes.get(dir) || 0
      const diff = currentSize - initialSize

      byDirectory[dir] = diff > 0 ? diff : 0
      if (diff > 0) {
        totalBytesAdded += diff
      }
    }

    // Get all files created during this run
    for (const op of this.operations) {
      if (op.type === 'created' && op.size > 0) {
        fileSizes.push({ path: op.relativePath, size: op.size })
      } else if (op.type === 'modified' && op.size > 0) {
        totalBytesModified += op.size
      }
    }

    // Sort by size and take top 10
    fileSizes.sort((a, b) => b.size - a.size)
    const largestFiles = fileSizes.slice(0, 10)

    return {
      totalBytesAdded,
      totalBytesModified,
      largestFiles,
      byDirectory,
    }
  }
}
