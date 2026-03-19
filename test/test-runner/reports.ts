import { readdir, readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import type {
  ParsedCommandMetric,
  ParsedJunitCase,
  PriceCommandResult,
  TestRunArtifacts
} from '../../src/types/tests-dir-types'
import { normalizeRepoPath } from './utils'

export type MatchProvenance = 'name-file' | 'name-global' | 'line-unique' | 'group-order'

type MatchEntry = { metrics: ParsedCommandMetric[]; matchedBy: MatchProvenance }
type MatchResult = Map<string, MatchEntry>

type HistoricalProcessingTimeLookup = Map<string, number>

export type BudgetPreflightSummary = {
  suiteName: string
  budgetCents: number
  commandsChecked: number
  commandsRunnable: number
  commandsSkipped: number
  commandsFailed: number
  runnableEstimatedCostCents: number
  skipKeys: string[]
  skippedEntries: {
    key: string
    selectedCostCents: number
  }[]
}

export const matchMetricsToTests = (
  metrics: ParsedCommandMetric[],
  junitCases: ParsedJunitCase[]
): { matched: MatchResult; unmatched: ParsedCommandMetric[] } => {
  const matched: MatchResult = new Map()
  const unmatched: ParsedCommandMetric[] = []
  const passedCases = junitCases.filter(tc => tc.status === 'passed')

  const byFileAndName = new Map<string, Map<string, ParsedJunitCase>>()
  const byName = new Map<string, ParsedJunitCase[]>()
  const byFileLine = new Map<string, ParsedJunitCase[]>()

  for (const tc of passedCases) {
    if (!byFileAndName.has(tc.file)) {
      byFileAndName.set(tc.file, new Map())
    }
    byFileAndName.get(tc.file)!.set(tc.name, tc)

    const nameList = byName.get(tc.name) ?? []
    nameList.push(tc)
    byName.set(tc.name, nameList)

    if (tc.line !== null) {
      const key = `${tc.file}::${tc.line}`
      const lineList = byFileLine.get(key) ?? []
      lineList.push(tc)
      byFileLine.set(key, lineList)
    }
  }

  const addToMatched = (tc: ParsedJunitCase, metric: ParsedCommandMetric, provenance: MatchProvenance): void => {
    const existing = matched.get(tc.id)
    if (existing) {
      existing.metrics.push(metric)
    } else {
      matched.set(tc.id, { metrics: [metric], matchedBy: provenance })
    }
  }

  const remaining: ParsedCommandMetric[] = []

  for (const metric of metrics) {
    if (metric.testName !== null && metric.callerFile !== null) {
      const byNameInFile = byFileAndName.get(metric.callerFile)
      const tc = byNameInFile?.get(metric.testName)
      if (tc) {
        addToMatched(tc, metric, 'name-file')
        continue
      }
    }

    if (metric.testName !== null) {
      const candidates = byName.get(metric.testName) ?? []
      if (candidates.length === 1) {
        addToMatched(candidates[0]!, metric, 'name-global')
        continue
      }
    }

    if (metric.callerFile !== null && metric.callerLine !== null) {
      const key = `${metric.callerFile}::${metric.callerLine}`
      const candidates = byFileLine.get(key) ?? []
      const candidate = candidates[0]
      if (candidates.length === 1 && candidate && !matched.has(candidate.id)) {
        addToMatched(candidate, metric, 'line-unique')
        continue
      }
    }

    remaining.push(metric)
  }

  const groups = new Map<string, ParsedCommandMetric[]>()
  for (const metric of remaining) {
    if (metric.callerFile !== null && metric.callerLine !== null) {
      const key = `${metric.callerFile}::${metric.callerLine}`
      const list = groups.get(key) ?? []
      list.push(metric)
      groups.set(key, list)
    } else {
      unmatched.push(metric)
    }
  }

  for (const [key, groupMetrics] of groups) {
    const tcAtLine = (byFileLine.get(key) ?? []).filter(tc => !matched.has(tc.id))
    const count = Math.min(groupMetrics.length, tcAtLine.length)
    for (let i = 0; i < count; i++) {
      addToMatched(tcAtLine[i]!, groupMetrics[i]!, 'group-order')
    }
    for (let i = count; i < groupMetrics.length; i++) {
      unmatched.push(groupMetrics[i]!)
    }
  }

  return { matched, unmatched }
}

const readHistoricalProcessingTimeLookup = async (
  artifacts: TestRunArtifacts
): Promise<HistoricalProcessingTimeLookup> => {
  const lookup: HistoricalProcessingTimeLookup = new Map()
  const reportsRoot = resolve(artifacts.rootDir)

  let entries
  try {
    entries = await readdir(reportsRoot, { withFileTypes: true, encoding: 'utf8' })
  } catch {
    return lookup
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
      const metrics = typeof test['metrics'] === 'object' && test['metrics'] !== null
        ? test['metrics'] as Record<string, unknown>
        : null
      const actualProcessingTimeMs = typeof metrics?.['actualProcessingTimeMs'] === 'number'
        && Number.isFinite(metrics['actualProcessingTimeMs'])
        ? metrics['actualProcessingTimeMs'] as number
        : null

      if (!file || !name || status !== 'passed' || actualProcessingTimeMs === null) {
        continue
      }

      lookup.set(`${file}::${name}`, actualProcessingTimeMs)
    }
  }

  return lookup
}

export const buildTestReportData = async (
  junitCases: ParsedJunitCase[],
  metrics: ParsedCommandMetric[],
  artifacts: TestRunArtifacts,
  endedAtIso: string,
  endedAtMs: number,
  argv: string[],
  budgetSummary?: BudgetPreflightSummary
): Promise<Record<string, unknown>> => {
  const { matched, unmatched } = matchMetricsToTests(metrics, junitCases)
  const historicalProcessingTimeLookup = await readHistoricalProcessingTimeLookup(artifacts)

  const tests = junitCases.map(tc => {
    const entry = matched.get(tc.id)
    const linked = entry?.metrics ?? []
    const hasMetrics = linked.length > 0
    const matchedBy = entry?.matchedBy ?? null
    const commandDurationMs = hasMetrics
      ? linked.reduce((sum, value) => sum + value.durationMs, 0)
      : null
    const estimatedCostCents = hasMetrics
      ? linked.reduce<number | null>((sum, value) => {
          if (value.estimatedCostCents === null) return sum
          return (sum ?? 0) + value.estimatedCostCents
        }, null)
      : null
    const actualCostCents = hasMetrics
      ? linked.reduce<number | null>((sum, value) => {
          if (value.actualCostCents === null) return sum
          return (sum ?? 0) + value.actualCostCents
        }, null)
      : null
    const actualProcessingTimeMs = hasMetrics
      ? linked.reduce<number | null>((sum, value) => {
          if (value.actualProcessingTimeMs === null) return sum
          return (sum ?? 0) + value.actualProcessingTimeMs
        }, null)
      : null

    const notes: string[] = []
    if (hasMetrics && matchedBy === 'group-order') {
      notes.push('metric matched by group-order (positional, less reliable)')
    }
    if (hasMetrics && linked.length > 1) {
      notes.push('multiple metrics collapsed onto this test')
    }

    return {
      id: tc.id,
      file: tc.file,
      name: tc.name,
      status: tc.status,
      durationMs: tc.durationMs,
      metrics: {
        source: hasMetrics ? 'runCommand' : 'none',
        matchedBy,
        commandDurationMs,
        estimatedCostCents,
        actualCostCents,
        estimatedProcessingTimeMs: historicalProcessingTimeLookup.get(tc.id) ?? null,
        actualProcessingTimeMs,
        notes,
      }
    }
  })

  const passed = tests.filter(t => t.status === 'passed').length
  const failed = tests.filter(t => t.status === 'failed').length
  const skipped = tests.filter(t => t.status === 'skipped').length

  const matchedMetricCount = Array.from(matched.values()).reduce((sum, entry) => sum + entry.metrics.length, 0)
  const unmatchedMetricCount = unmatched.length

  const failures = tests
    .filter(t => t.status === 'failed')
    .map(t => {
      const source = junitCases.find(tc => tc.id === t.id)
      return {
        id: t.id,
        file: t.file,
        name: t.name,
        message: source?.failureMessage ?? 'Test failed'
      }
    })

  const runDurationMs = Math.max(0, endedAtMs - artifacts.startedAtMs)

  return {
    run: {
      id: artifacts.runId,
      mode: 'test',
      startedAt: artifacts.startedAtIso,
      endedAt: endedAtIso,
      durationMs: runDurationMs,
      argv,
      artifactDir: normalizeRepoPath(artifacts.runDir),
      ...(budgetSummary
        ? {
            budgetCents: budgetSummary.budgetCents,
            budgetPreflightSuite: budgetSummary.suiteName,
            budgetPreflightChecked: budgetSummary.commandsChecked,
            budgetPreflightRunnable: budgetSummary.commandsRunnable,
            budgetPreflightSkipped: budgetSummary.commandsSkipped,
            budgetPreflightFailed: budgetSummary.commandsFailed,
            budgetRunnableEstimatedCostCents: budgetSummary.runnableEstimatedCostCents,
            budgetSkipKeys: budgetSummary.skipKeys,
            budgetSkippedEntries: budgetSummary.skippedEntries,
          }
        : {}),
    },
    summary: {
      total: tests.length,
      passed,
      failed,
      skipped,
      cliMetricEligiblePassedCount: tests.filter(t => t.status === 'passed' && t.metrics.source === 'runCommand').length,
      matchedMetricCount,
      unmatchedMetricCount,
      passedWithoutMetricsCount: tests.filter(t => t.status === 'passed' && t.metrics.source === 'none').length,
    },
    tests,
    failures,
  }
}

export const buildPriceReportData = (
  results: PriceCommandResult[],
  suiteName: string,
  artifacts: TestRunArtifacts,
  endedAtIso: string,
  endedAtMs: number,
  argv: string[],
  budgetSummary?: BudgetPreflightSummary
): Record<string, unknown> => {
  const passed = results.filter(r => r.status === 'passed').length
  const failed = results.filter(r => r.status === 'failed').length
  const skipped = results.filter(r => r.status === 'skipped').length
  const totalCost = results
    .filter(r => r.status === 'passed')
    .map(r => r.costCents)
    .filter((v): v is number => typeof v === 'number')
    .reduce((sum, value) => sum + value, 0)

  const runDurationMs = Math.max(0, endedAtMs - artifacts.startedAtMs)

  return {
    run: {
      id: artifacts.runId,
      mode: 'price',
      suiteName,
      startedAt: artifacts.startedAtIso,
      endedAt: endedAtIso,
      durationMs: runDurationMs,
      argv,
      artifactDir: normalizeRepoPath(artifacts.runDir),
      ...(budgetSummary
        ? {
            budgetCents: budgetSummary.budgetCents,
            budgetPreflightSuite: budgetSummary.suiteName,
            budgetPreflightChecked: budgetSummary.commandsChecked,
            budgetPreflightRunnable: budgetSummary.commandsRunnable,
            budgetPreflightSkipped: budgetSummary.commandsSkipped,
            budgetPreflightFailed: budgetSummary.commandsFailed,
            budgetRunnableEstimatedCostCents: budgetSummary.runnableEstimatedCostCents,
            budgetSkipKeys: budgetSummary.skipKeys,
            budgetSkippedEntries: budgetSummary.skippedEntries,
          }
        : {}),
    },
    summary: {
      total: results.length,
      passed,
      failed,
      skipped,
      totalEstimatedCostCents: totalCost,
    },
    commands: results,
  }
}
