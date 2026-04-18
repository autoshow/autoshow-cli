import { readdir, readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import type { TestRunArtifacts } from '../../../src/types/tests-dir-types'
import type { HistoricalLookup } from './types'

export const readHistoricalLookups = async (
  artifacts: TestRunArtifacts
): Promise<HistoricalLookup> => {
  const durationById = new Map<string, number>()
  const processingTimeById = new Map<string, number>()
  const reportsRoot = resolve(artifacts.rootDir)

  let entries
  try {
    entries = await readdir(reportsRoot, { withFileTypes: true, encoding: 'utf8' })
  } catch {
    return { durationById, processingTimeById }
  }

  const priorReports: Array<{ endedAtMs: number, tests: Array<Record<string, unknown>> }> = []

  for (const entry of entries) {
    if (!entry.isDirectory() || entry.name === artifacts.runId) {
      continue
    }

    const reportPath = resolve(reportsRoot, entry.name, 'report.json')
    let parsed: unknown
    try {
      parsed = JSON.parse(await readFile(reportPath, 'utf8')) as unknown
    } catch {
      continue
    }

    if (typeof parsed !== 'object' || parsed === null) {
      continue
    }

    const run = 'run' in parsed && typeof parsed['run'] === 'object' && parsed['run'] !== null
      ? parsed['run'] as Record<string, unknown>
      : null
    const tests = Array.isArray((parsed as Record<string, unknown>)['tests'])
      ? (parsed as Record<string, unknown>)['tests'] as Array<Record<string, unknown>>
      : []
    const endedAt = typeof run?.['endedAt'] === 'string' ? run['endedAt'] : null
    const endedAtMs = endedAt ? Date.parse(endedAt) : Number.NaN

    if (!Number.isFinite(endedAtMs) || tests.length === 0) {
      continue
    }

    priorReports.push({ endedAtMs, tests })
  }

  priorReports.sort((a, b) => a.endedAtMs - b.endedAtMs)

  for (const report of priorReports) {
    for (const test of report.tests) {
      const file = typeof test['file'] === 'string' ? test['file'] : null
      const name = typeof test['name'] === 'string' ? test['name'] : null
      const status = typeof test['status'] === 'string' ? test['status'] : null
      const durationMs = typeof test['durationMs'] === 'number' && Number.isFinite(test['durationMs'])
        ? test['durationMs'] as number
        : null
      const metrics = typeof test['metrics'] === 'object' && test['metrics'] !== null
        ? test['metrics'] as Record<string, unknown>
        : null
      const actualProcessingTimeMs = typeof metrics?.['actualProcessingTimeMs'] === 'number'
        && Number.isFinite(metrics['actualProcessingTimeMs'])
        ? metrics['actualProcessingTimeMs'] as number
        : null

      if (!file || !name || status !== 'passed') {
        continue
      }

      const id = `${file}::${name}`
      if (durationMs !== null) {
        durationById.set(id, durationMs)
      }
      if (actualProcessingTimeMs !== null) {
        processingTimeById.set(id, actualProcessingTimeMs)
      }
    }
  }

  return { durationById, processingTimeById }
}
