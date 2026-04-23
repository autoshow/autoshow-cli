import type { ParsedCommandMetric, ParsedJunitCase, TestRunArtifacts } from '~/types'
import {
  buildMetricContext,
  buildTestContext,
  isControlE2ETest,
  isE2ETestFile,
  normalizeValue
} from './context'
import type {
  MatchProvenance,
  MatchResult,
  MetricContext,
  ServiceModelPair,
  TestContext
} from './types'

const metricModelMatches = (modelHints: Set<string>, metricPairs: ServiceModelPair[]): boolean => {
  if (modelHints.size === 0) return true

  for (const pair of metricPairs) {
    const normalizedModel = normalizeValue(pair.model)
    if (normalizedModel && modelHints.has(normalizedModel)) {
      return true
    }
  }

  return false
}

const metricServiceMatches = (serviceHints: Set<string>, metricPairs: ServiceModelPair[]): boolean => {
  if (serviceHints.size === 0) return true

  for (const pair of metricPairs) {
    const normalizedService = normalizeValue(pair.service)
    if (normalizedService && serviceHints.has(normalizedService)) {
      return true
    }
  }

  return false
}

const scoreHeuristicMatch = (
  testContext: TestContext,
  metricContext: MetricContext
): number | null => {
  const { testCase } = testContext
  const name = testCase.name

  if (testCase.status === 'skipped' || isControlE2ETest(name)) {
    return null
  }

  if (testContext.isPrice !== metricContext.isPrice) {
    return null
  }

  if (testContext.kind && metricContext.kind && testContext.kind !== metricContext.kind) {
    const hasMatchingPairKind = metricContext.pairs.some(pair => pair.kind === testContext.kind)
    if (!hasMatchingPairKind) {
      return null
    }
  }

  if (!metricServiceMatches(testContext.serviceHints, metricContext.pairs)) {
    return null
  }

  if (!metricModelMatches(testContext.modelHints, metricContext.pairs)) {
    return null
  }

  if (testCase.status === 'passed' && metricContext.metric.exitCode !== 0) {
    return null
  }

  const durationDelta = Math.abs(testCase.durationMs - metricContext.metric.durationMs)
  const serviceBonus = testContext.serviceHints.size > 0 ? 0 : 10_000
  const modelBonus = testContext.modelHints.size > 0 ? 0 : 5_000
  return durationDelta + serviceBonus + modelBonus
}

const addToMatched = (
  matched: MatchResult,
  testCase: ParsedJunitCase,
  metric: ParsedCommandMetric,
  provenance: MatchProvenance
): void => {
  const existing = matched.get(testCase.id)
  if (existing) {
    existing.metrics.push(metric)
  } else {
    matched.set(testCase.id, { metrics: [metric], matchedBy: provenance })
  }
}

const addHeuristicMatches = async (
  matched: MatchResult,
  unmatchedMetrics: ParsedCommandMetric[],
  junitCases: ParsedJunitCase[],
  artifacts: TestRunArtifacts
): Promise<ParsedCommandMetric[]> => {
  const unmatchedTests = junitCases
    .filter(testCase => !matched.has(testCase.id) && isE2ETestFile(testCase.file))
    .map(buildTestContext)

  if (unmatchedTests.length === 0 || unmatchedMetrics.length === 0) {
    return unmatchedMetrics
  }

  const metadataCache = new Map<string, Record<string, unknown> | null>()
  const metricContexts = await Promise.all(
    unmatchedMetrics.map(async metric => await buildMetricContext(metric, artifacts, metadataCache))
  )

  const candidates: Array<{ testIndex: number, metricIndex: number, score: number }> = []
  for (const [testIndex, testContext] of unmatchedTests.entries()) {
    for (const [metricIndex, metricContext] of metricContexts.entries()) {
      const score = scoreHeuristicMatch(testContext, metricContext)
      if (score !== null) {
        candidates.push({ testIndex, metricIndex, score })
      }
    }
  }

  candidates.sort((a, b) => a.score - b.score || a.testIndex - b.testIndex || a.metricIndex - b.metricIndex)

  const usedTests = new Set<number>()
  const usedMetrics = new Set<number>()

  for (const candidate of candidates) {
    if (usedTests.has(candidate.testIndex) || usedMetrics.has(candidate.metricIndex)) {
      continue
    }

    const testContext = unmatchedTests[candidate.testIndex]
    const metric = unmatchedMetrics[candidate.metricIndex]
    if (!testContext || !metric) {
      continue
    }

    addToMatched(matched, testContext.testCase, metric, 'heuristic')
    usedTests.add(candidate.testIndex)
    usedMetrics.add(candidate.metricIndex)
  }

  return unmatchedMetrics.filter((_metric, index) => !usedMetrics.has(index))
}

export const matchMetricsToTests = async (
  metrics: ParsedCommandMetric[],
  junitCases: ParsedJunitCase[],
  artifacts: TestRunArtifacts
): Promise<{ matched: MatchResult; unmatched: ParsedCommandMetric[] }> => {
  const matched: MatchResult = new Map()
  const unmatched: ParsedCommandMetric[] = []
  const matchableCases = junitCases.filter(tc => tc.status !== 'skipped')

  const byFileAndName = new Map<string, Map<string, ParsedJunitCase>>()
  const byName = new Map<string, ParsedJunitCase[]>()
  const byFileLine = new Map<string, ParsedJunitCase[]>()

  for (const tc of matchableCases) {
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

  const remaining: ParsedCommandMetric[] = []

  for (const metric of metrics) {
    if (metric.testName !== null && metric.callerFile !== null) {
      const byNameInFile = byFileAndName.get(metric.callerFile)
      const tc = byNameInFile?.get(metric.testName)
      if (tc) {
        addToMatched(matched, tc, metric, 'name-file')
        continue
      }
    }

    if (metric.testName !== null) {
      const candidates = byName.get(metric.testName) ?? []
      if (candidates.length === 1) {
        const candidate = candidates[0]
        if (candidate) {
          addToMatched(matched, candidate, metric, 'name-global')
          continue
        }
      }
    }

    if (metric.callerFile !== null && metric.callerLine !== null) {
      const key = `${metric.callerFile}::${metric.callerLine}`
      const candidates = byFileLine.get(key) ?? []
      const candidate = candidates[0]
      if (candidates.length === 1 && candidate && !matched.has(candidate.id)) {
        addToMatched(matched, candidate, metric, 'line-unique')
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
    for (let index = 0; index < count; index++) {
      const testCase = tcAtLine[index]
      const metric = groupMetrics[index]
      if (testCase && metric) {
        addToMatched(matched, testCase, metric, 'group-order')
      }
    }
    for (let index = count; index < groupMetrics.length; index++) {
      const metric = groupMetrics[index]
      if (metric) {
        unmatched.push(metric)
      }
    }
  }

  const remainingAfterHeuristic = await addHeuristicMatches(matched, unmatched, junitCases, artifacts)
  return { matched, unmatched: remainingAfterHeuristic }
}
