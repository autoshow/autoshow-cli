/**
 * Marker file management for setup commands
 */

import { rm } from 'node:fs/promises'
import { join } from 'node:path'
import { CONFIG_DIR, MARKER_PATTERNS } from '../constants.ts'
import { fileExists } from './utils.ts'

export async function removeMarkers(setupCommand: string): Promise<string[]> {
  const removed: string[] = []
  const markers = MARKER_PATTERNS[setupCommand] || []

  for (const marker of markers) {
    const markerPath = join(CONFIG_DIR, marker)
    if (await fileExists(markerPath)) {
      try {
        await rm(markerPath)
        removed.push(markerPath)
      } catch (err) {
        console.error(`Warning: Could not remove marker ${markerPath}:`, err)
      }
    }
  }

  return removed
}

export function getMarkersForCommand(setupCommand: string): string[] {
  return MARKER_PATTERNS[setupCommand] || []
}

export async function checkMarkersExist(setupCommand: string): Promise<{ marker: string; exists: boolean }[]> {
  const markers = MARKER_PATTERNS[setupCommand] || []
  const results: { marker: string; exists: boolean }[] = []

  for (const marker of markers) {
    const markerPath = join(CONFIG_DIR, marker)
    results.push({
      marker,
      exists: await fileExists(markerPath),
    })
  }

  return results
}
