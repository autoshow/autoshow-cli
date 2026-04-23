import type { ParsedCommandMetric, ParsedJunitCase, TestRunArtifacts } from '~/types'
import { normalizeRepoPath } from '../utils'
import {
  buildMetricContext,
  isControlE2ETest,
  isE2ETestFile,
  joinUnique,
  selectPrimaryPairs
} from './context'
import { readHistoricalLookups } from './history'
import { matchMetricsToTests } from './matching'
import { buildBudgetRunFields } from './run-metadata'
import type {
  BudgetPreflightSummary,
  HistoricalLookup,
  MatchProvenance,
  MatchResult
} from './types'

const earliestMetricStartIso = (metrics: ParsedCommandMetric[]): string | null => {
  let earliest: number | null = null

  for (const metric of metrics) {
    if (!metric.at) continue
    const atMs = Date.parse(metric.at)
    if (!Number.isFinite(atMs)) continue

    const startedAt = atMs - metric.durationMs
    if (earliest === null || startedAt < earliest) {
      earliest = startedAt
    }
  }

  return earliest === null ? null : new Date(earliest).toISOString()
}

const summarizeLinkedMetrics = (
  linked: ParsedCommandMetric[],
  historical: HistoricalLookup,
  testId: string,
  matchedBy: MatchProvenance | null
): Record<string, unknown> => {
  const hasMetrics = linked.length > 0
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
  const estimatedProcessingTimeMs = hasMetrics
    ? linked.reduce<number | null>((sum, value) => {
        if (value.estimatedProcessingTimeMs === null) return sum
        return (sum ?? 0) + value.estimatedProcessingTimeMs
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
  if (hasMetrics && matchedBy === 'heuristic') {
    notes.push('metric matched heuristically by provider/model/time')
  }
  if (hasMetrics && linked.length > 1) {
    notes.push('multiple metrics collapsed onto this test')
  }
  if (estimatedProcessingTimeMs === null && historical.processingTimeById.has(testId)) {
    notes.push('estimated processing time fell back to prior successful run')
  }

  return {
    source: hasMetrics ? 'runCommand' : 'none',
    matchedBy,
    commandDurationMs,
    estimatedCostCents,
    actualCostCents,
    estimatedProcessingTimeMs: estimatedProcessingTimeMs ?? historical.processingTimeById.get(testId) ?? null,
    actualProcessingTimeMs,
    notes,
  }
}

const buildCondensedE2EReport = async (
  tests: Array<{
    id: string
    file: string
    name: string
    status: string
    durationMs: number
    metrics: Record<string, unknown>
  }>,
  matched: MatchResult,
  artifacts: TestRunArtifacts,
  historical: HistoricalLookup,
  endedAtIso: string,
  endedAtMs: number
): Promise<Record<string, unknown>> => {
  const metadataCache = new Map<string, Record<string, unknown> | null>()

  const reportableTests = tests.filter(test => {
    return isE2ETestFile(test.file)
      && test.metrics['source'] === 'runCommand'
      && !isControlE2ETest(test.name)
  })

  const condensedTests = await Promise.all(reportableTests.map(async test => {
    const linked = matched.get(test.id)?.metrics ?? []
    const metricContexts = await Promise.all(
      linked.map(async metric => await buildMetricContext(metric, artifacts, metadataCache))
    )
    const testCase: ParsedJunitCase = {
      id: test.id,
      file: test.file,
      name: test.name,
      line: null,
      durationMs: test.durationMs,
      status: test.status as ParsedJunitCase['status'],
      failureMessage: null,
    }
    const primaryPairs = selectPrimaryPairs(
      testCase,
      metricContexts.flatMap(context => context.pairs)
    )

    return {
      id: test.id,
      file: test.file,
      name: test.name,
      status: test.status,
      serviceName: joinUnique(primaryPairs.map(pair => pair.service)),
      modelName: joinUnique(primaryPairs.map(pair => pair.model)),
      runAt: earliestMetricStartIso(linked),
      estimatedDurationMs: historical.durationById.get(test.id) ?? null,
      actualDurationMs: test.durationMs,
      estimatedProcessingTimeMs: test.metrics['estimatedProcessingTimeMs'] ?? null,
      actualProcessingTimeMs: test.metrics['actualProcessingTimeMs'] ?? null,
      estimatedCostCents: test.metrics['estimatedCostCents'] ?? null,
      actualCostCents: test.metrics['actualCostCents'] ?? null,
    }
  }))

  return {
    run: {
      id: artifacts.runId,
      mode: 'test',
      startedAt: artifacts.startedAtIso,
      endedAt: endedAtIso,
      durationMs: Math.max(0, endedAtMs - artifacts.startedAtMs),
      artifactDir: normalizeRepoPath(artifacts.runDir),
    },
    summary: {
      total: condensedTests.length,
      passed: condensedTests.filter(test => test.status === 'passed').length,
      failed: condensedTests.filter(test => test.status === 'failed').length,
      skipped: condensedTests.filter(test => test.status === 'skipped').length,
    },
    tests: condensedTests,
  }
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
  const { matched, unmatched } = await matchMetricsToTests(metrics, junitCases, artifacts)
  const historical = await readHistoricalLookups(artifacts)

  const tests = junitCases.map(testCase => {
    const entry = matched.get(testCase.id)
    const linked = entry?.metrics ?? []
    const matchedBy = entry?.matchedBy ?? null

    return {
      id: testCase.id,
      file: testCase.file,
      name: testCase.name,
      status: testCase.status,
      durationMs: testCase.durationMs,
      metrics: summarizeLinkedMetrics(linked, historical, testCase.id, matchedBy),
    }
  })

  const passed = tests.filter(test => test.status === 'passed').length
  const failed = tests.filter(test => test.status === 'failed').length
  const skipped = tests.filter(test => test.status === 'skipped').length

  const matchedMetricCount = Array.from(matched.values()).reduce((sum, entry) => sum + entry.metrics.length, 0)
  const unmatchedMetricCount = unmatched.length

  const failures = tests
    .filter(test => test.status === 'failed')
    .map(test => {
      const source = junitCases.find(testCase => testCase.id === test.id)
      return {
        id: test.id,
        file: test.file,
        name: test.name,
        message: source?.failureMessage ?? 'Test failed'
      }
    })

  const runDurationMs = Math.max(0, endedAtMs - artifacts.startedAtMs)
  const e2e = await buildCondensedE2EReport(tests, matched, artifacts, historical, endedAtIso, endedAtMs)

  return {
    run: {
      id: artifacts.runId,
      mode: 'test',
      startedAt: artifacts.startedAtIso,
      endedAt: endedAtIso,
      durationMs: runDurationMs,
      argv,
      artifactDir: normalizeRepoPath(artifacts.runDir),
      ...buildBudgetRunFields(budgetSummary),
    },
    summary: {
      total: tests.length,
      passed,
      failed,
      skipped,
      cliMetricEligiblePassedCount: tests.filter(test => test.status === 'passed' && test.metrics['source'] === 'runCommand').length,
      matchedMetricCount,
      unmatchedMetricCount,
      passedWithoutMetricsCount: tests.filter(test => test.status === 'passed' && test.metrics['source'] === 'none').length,
    },
    tests,
    failures,
    e2e,
  }
}
