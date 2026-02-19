/**
 * Readiness markers used to enforce setup -> runtime report ordering.
 */

import { join } from 'node:path'
import { REPORT_READY_DIR } from '../constants.ts'
import { sanitizeForFilename } from './formatters.ts'
import { ensureDir, fileExists } from './utils.ts'

export interface ReadinessMarker {
  key: string
  setupCommand: string
  model?: string
  createdAt: string
  setupReportPath?: string
}

export function getReadinessKey(setupCommand: string, model?: string): string {
  const modelPart = model ? sanitizeForFilename(model) : 'default'
  return `${sanitizeForFilename(setupCommand)}-${modelPart}`
}

export function getReadinessMarkerPath(setupCommand: string, model?: string): string {
  return join(REPORT_READY_DIR, `${getReadinessKey(setupCommand, model)}.json`)
}

export async function writeReadinessMarker(setupCommand: string, model: string | undefined, data: Omit<ReadinessMarker, 'key' | 'setupCommand' | 'model' | 'createdAt'> = {}): Promise<string> {
  await ensureDir(REPORT_READY_DIR)
  const marker: ReadinessMarker = {
    key: getReadinessKey(setupCommand, model),
    setupCommand,
    model,
    createdAt: new Date().toISOString(),
    ...data,
  }
  const markerPath = getReadinessMarkerPath(setupCommand, model)
  await Bun.write(markerPath, JSON.stringify(marker, null, 2))
  return markerPath
}

export async function readReadinessMarker(setupCommand: string, model?: string): Promise<ReadinessMarker | null> {
  const markerPath = getReadinessMarkerPath(setupCommand, model)
  if (!(await fileExists(markerPath))) {
    return null
  }

  try {
    return (await Bun.file(markerPath).json()) as ReadinessMarker
  } catch {
    return null
  }
}
