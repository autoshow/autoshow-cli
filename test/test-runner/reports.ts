import { readdir, readFile } from 'node:fs/promises'
import { basename, resolve } from 'node:path'
import type {
  ParsedCommandMetric,
  ParsedJunitCase,
  PriceCommandResult,
  TestRunArtifacts
} from '../../src/types/tests-dir-types'
import { normalizeRepoPath } from './utils'

export type MatchProvenance = 'name-file' | 'name-global' | 'line-unique' | 'group-order' | 'heuristic'

type MatchEntry = { metrics: ParsedCommandMetric[]; matchedBy: MatchProvenance }
type MatchResult = Map<string, MatchEntry>

type HistoricalLookup = {
  durationById: Map<string, number>
  processingTimeById: Map<string, number>
}

type ServiceModelPair = {
  kind: string | null
  service: string
  model: string | null
}

type MetricContext = {
  metric: ParsedCommandMetric
  kind: string | null
  isPrice: boolean
  pairs: ServiceModelPair[]
}

type TestContext = {
  testCase: ParsedJunitCase
  kind: string | null
  isPrice: boolean
  serviceHints: Set<string>
  modelHints: Set<string>
}

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

const COMMAND_KIND_NAMES = new Set(['setup', 'sample', 'download', 'stt', 'transcribe', 'ocr', 'extract', 'write', 'tts', 'image', 'video', 'music'])

const normalizeMetricCommandKind = (kind: string): string => {
  if (kind === 'stt') return 'transcribe'
  if (kind === 'ocr') return 'extract'
  return kind
}

const ARG_SERVICE_FLAGS: Record<string, { service: string, kind: string }> = {
  '--openai': { service: 'openai', kind: 'write' },
  '--anthropic': { service: 'anthropic', kind: 'write' },
  '--gemini': { service: 'gemini', kind: 'write' },
  '--groq': { service: 'groq', kind: 'write' },
  '--minimax': { service: 'minimax', kind: 'write' },
  '--llama': { service: 'llama.cpp', kind: 'write' },
  '--whisper': { service: 'whisper', kind: 'transcribe' },
  '--elevenlabs-stt': { service: 'elevenlabs', kind: 'transcribe' },
  '--deepgram-stt': { service: 'deepgram', kind: 'transcribe' },
  '--soniox-stt': { service: 'soniox', kind: 'transcribe' },
  '--speechmatics-stt': { service: 'speechmatics', kind: 'transcribe' },
  '--rev-stt': { service: 'rev', kind: 'transcribe' },
  '--openai-stt': { service: 'openai', kind: 'transcribe' },
  '--groq-stt': { service: 'groq', kind: 'transcribe' },
  '--assemblyai-stt': { service: 'assemblyai', kind: 'transcribe' },
  '--gladia-stt': { service: 'gladia', kind: 'transcribe' },
  '--mistral-stt': { service: 'mistral', kind: 'transcribe' },
  '--mistral-ocr': { service: 'mistral', kind: 'extract' },
  '--glm-ocr': { service: 'glm', kind: 'extract' },
  '--elevenlabs-tts': { service: 'elevenlabs', kind: 'tts' },
  '--minimax-tts': { service: 'minimax', kind: 'tts' },
  '--groq-tts': { service: 'groq', kind: 'tts' },
  '--openai-tts': { service: 'openai', kind: 'tts' },
  '--gemini-tts': { service: 'gemini', kind: 'tts' },
  '--kitten-tts': { service: 'kitten', kind: 'tts' },
  '--openai-image': { service: 'openai', kind: 'image' },
  '--gemini-image': { service: 'gemini', kind: 'image' },
  '--minimax-image': { service: 'minimax', kind: 'image' },
  '--gemini-video': { service: 'gemini', kind: 'video' },
  '--minimax-video': { service: 'minimax', kind: 'video' },
  '--elevenlabs-music': { service: 'elevenlabs', kind: 'music' },
  '--minimax-music': { service: 'minimax', kind: 'music' },
}

const KNOWN_SERVICE_HINTS: Array<{ pattern: RegExp, service: string }> = [
  { pattern: /\bopenai\b/i, service: 'openai' },
  { pattern: /\banthropic\b/i, service: 'anthropic' },
  { pattern: /\bgemini\b/i, service: 'gemini' },
  { pattern: /\bgroq\b/i, service: 'groq' },
  { pattern: /\bminimax\b/i, service: 'minimax' },
  { pattern: /\belevenlabs\b/i, service: 'elevenlabs' },
  { pattern: /\bdeepgram\b/i, service: 'deepgram' },
  { pattern: /\bsoniox\b/i, service: 'soniox' },
  { pattern: /\bspeechmatics\b/i, service: 'speechmatics' },
  { pattern: /\brev\b/i, service: 'rev' },
  { pattern: /\bassemblyai\b/i, service: 'assemblyai' },
  { pattern: /\bgladia\b/i, service: 'gladia' },
  { pattern: /\bmistral\b/i, service: 'mistral' },
  { pattern: /\bfirecrawl\b/i, service: 'firecrawl' },
  { pattern: /\bglm(?:-reader)?\b/i, service: 'glm' },
  { pattern: /\bwhisper\b/i, service: 'whisper' },
  { pattern: /\bllama\b/i, service: 'llama.cpp' },
  { pattern: /\bkitten\b/i, service: 'kitten' },
]

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === 'object' && value !== null
}

const cleanValue = (value: string | null | undefined): string | null => {
  if (!value) return null
  const cleaned = value.trim()
  return cleaned.length > 0 ? cleaned : null
}

const normalizeValue = (value: string | null | undefined): string | null => {
  const cleaned = cleanValue(value)
  return cleaned ? cleaned.toLowerCase() : null
}

const toRecordArray = (value: unknown): Record<string, unknown>[] => {
  if (Array.isArray(value)) {
    return value.filter(isRecord)
  }
  return isRecord(value) ? [value] : []
}

const dedupePairs = (pairs: ServiceModelPair[]): ServiceModelPair[] => {
  const seen = new Set<string>()
  const out: ServiceModelPair[] = []

  for (const pair of pairs) {
    const key = `${pair.kind ?? ''}::${normalizeValue(pair.service) ?? ''}::${normalizeValue(pair.model) ?? ''}`
    if (seen.has(key)) continue
    seen.add(key)
    out.push(pair)
  }

  return out
}

const pushPair = (
  pairs: ServiceModelPair[],
  kind: string | null,
  service: string | null | undefined,
  model: string | null | undefined
): void => {
  const cleanedService = cleanValue(service)
  if (!cleanedService) return

  pairs.push({
    kind,
    service: cleanedService,
    model: cleanValue(model),
  })
}

const isE2ETestFile = (file: string): boolean => file.startsWith('test/test-cases/e2e/')

const isControlE2ETest = (name: string): boolean => {
  return /^rejects\b/i.test(name)
    || /^requires\b/i.test(name)
    || /^all output files\b/i.test(name)
    || /^selects exactly one model\b/i.test(name)
}

const parseMetricCommandKind = (metric: ParsedCommandMetric): string | null => {
  const subcommand = metric.args[1]
  if (subcommand && COMMAND_KIND_NAMES.has(subcommand)) {
    return normalizeMetricCommandKind(subcommand)
  }

  if (metric.args.length > 1) {
    return 'write'
  }

  return null
}

const buildPairsFromMetricArgs = (metric: ParsedCommandMetric): ServiceModelPair[] => {
  const pairs: ServiceModelPair[] = []

  for (let index = 0; index < metric.args.length; index++) {
    const arg = metric.args[index]
    if (!arg) continue

    if (arg === '--url-backend') {
      const next = metric.args[index + 1]
      if (next === 'firecrawl') {
        pushPair(pairs, 'extract', 'firecrawl', 'firecrawl')
      } else if (next === 'glm-reader') {
        pushPair(pairs, 'extract', 'glm', 'glm-reader')
      }
      continue
    }

    const flag = ARG_SERVICE_FLAGS[arg]
    if (!flag) continue

    const next = metric.args[index + 1]
    const model = next && !next.startsWith('--') ? next : null
    pushPair(pairs, flag.kind, flag.service, model)
  }

  return dedupePairs(pairs)
}

const extractPairsFromMetadata = (metadata: Record<string, unknown>): ServiceModelPair[] => {
  const pairs: ServiceModelPair[] = []

  const step2 = typeof metadata['step2'] === 'object' && metadata['step2'] !== null
    ? metadata['step2'] as Record<string, unknown>
    : null
  const step3Entries = toRecordArray(metadata['step3'])
  const step4Entries = toRecordArray(metadata['step4'])
  const musicEntries = toRecordArray(metadata['music'])
  const ttsEntries = toRecordArray(metadata['tts'])
  const imageEntries = [
    ...toRecordArray(metadata['step5']),
    ...toRecordArray(metadata['image'])
  ]
  const videoEntries = toRecordArray(metadata['video'])

  pushPair(
    pairs,
    'transcribe',
    typeof step2?.['transcriptionService'] === 'string' ? step2['transcriptionService'] : null,
    typeof step2?.['transcriptionModel'] === 'string'
      ? step2['transcriptionModel']
      : typeof step2?.['transcriptionModel'] === 'string'
        ? step2['transcriptionModel']
        : null
  )
  pushPair(
    pairs,
    'extract',
    typeof step2?.['ocrService'] === 'string'
      ? step2['ocrService']
      : typeof step2?.['extractionMethod'] === 'string' && step2['extractionMethod'].includes('mistral-ocr')
        ? 'mistral'
        : typeof step2?.['extractionMethod'] === 'string' && step2['extractionMethod'].includes('glm-ocr')
          ? 'glm'
          : typeof step2?.['extractionMethod'] === 'string' && step2['extractionMethod'].includes('glm-reader')
            ? 'glm'
            : typeof step2?.['extractionMethod'] === 'string' && step2['extractionMethod'].includes('firecrawl')
              ? 'firecrawl'
        : null,
    typeof step2?.['ocrModel'] === 'string'
      ? step2['ocrModel']
      : typeof step2?.['extractionMethod'] === 'string' && step2['extractionMethod'].includes('glm-reader')
        ? 'glm-reader'
        : typeof step2?.['extractionMethod'] === 'string' && step2['extractionMethod'].includes('firecrawl')
          ? 'firecrawl'
          : null
  )
  for (const step3 of step3Entries) {
    pushPair(
      pairs,
      'write',
      typeof step3['llmService'] === 'string' ? step3['llmService'] : null,
      typeof step3['llmModel'] === 'string' ? step3['llmModel'] : null
    )
  }
  for (const step4 of step4Entries) {
    pushPair(
      pairs,
      'tts',
      typeof step4['ttsService'] === 'string' ? step4['ttsService'] : null,
      typeof step4['ttsModel'] === 'string' ? step4['ttsModel'] : null
    )
  }
  for (const music of musicEntries) {
    pushPair(
      pairs,
      'music',
      typeof music['musicService'] === 'string' ? music['musicService'] : null,
      typeof music['musicModel'] === 'string' ? music['musicModel'] : null
    )
  }
  for (const tts of ttsEntries) {
    pushPair(
      pairs,
      'tts',
      typeof tts['ttsService'] === 'string' ? tts['ttsService'] : null,
      typeof tts['ttsModel'] === 'string' ? tts['ttsModel'] : null
    )
  }
  for (const image of imageEntries) {
    pushPair(
      pairs,
      'image',
      typeof image['imageService'] === 'string' ? image['imageService'] : null,
      typeof image['imageModel'] === 'string' ? image['imageModel'] : null
    )
  }
  for (const video of videoEntries) {
    pushPair(
      pairs,
      'video',
      typeof video['videoService'] === 'string' ? video['videoService'] : null,
      typeof video['videoModel'] === 'string' ? video['videoModel'] : null
    )
  }

  return dedupePairs(pairs)
}

const getMetricMetadata = async (
  metric: ParsedCommandMetric,
  artifacts: TestRunArtifacts,
  cache: Map<string, Record<string, unknown> | null>
): Promise<Record<string, unknown> | null> => {
  if (!metric.outputDir) return null

  const key = basename(metric.outputDir)
  if (cache.has(key)) {
    return cache.get(key) ?? null
  }

  const metadataPath = resolve(artifacts.metadataDirPath, `${key}.json`)

  try {
    const parsed = JSON.parse(await readFile(metadataPath, 'utf8')) as unknown
    if (typeof parsed === 'object' && parsed !== null) {
      const record = parsed as Record<string, unknown>
      cache.set(key, record)
      return record
    }
  } catch {
  }

  cache.set(key, null)
  return null
}

const buildMetricContext = async (
  metric: ParsedCommandMetric,
  artifacts: TestRunArtifacts,
  metadataCache: Map<string, Record<string, unknown> | null>
): Promise<MetricContext> => {
  const metadata = await getMetricMetadata(metric, artifacts, metadataCache)
  const pairs = dedupePairs([
    ...extractPairsFromMetadata(metadata ?? {}),
    ...buildPairsFromMetricArgs(metric),
  ])

  return {
    metric,
    kind: parseMetricCommandKind(metric),
    isPrice: metric.args.includes('--price'),
    pairs,
  }
}

const inferTestKind = (testCase: ParsedJunitCase): string | null => {
  if (testCase.file.includes('/step-7-music-gen-e2e/')) return 'music'
  if (testCase.file.includes('/step-6-video-gen-e2e/')) return 'video'
  if (testCase.file.includes('/step-5-image-gen-e2e/')) return 'image'
  if (testCase.file.includes('/step-4-tts-e2e/')) return 'tts'
  if (testCase.file.includes('/step-3-write-e2e/')) return 'write'
  if (testCase.file.includes('/step-2-stt-e2e/')) return 'transcribe'
  if (testCase.file.includes('/step-2-ocr-e2e/')) return 'extract'
  if (/\btranscribe\b/i.test(testCase.name)) return 'transcribe'
  if (/\bextract\b/i.test(testCase.name)) return 'extract'
  if (/\btts\b/i.test(testCase.name) || /speech\.wav/i.test(testCase.name)) return 'tts'
  if (/\bimage\b/i.test(testCase.name) || /generated-image/i.test(testCase.name)) return 'image'
  if (/\bvideo\b/i.test(testCase.name) || /\bveo\b/i.test(testCase.name)) return 'video'
  if (/\bmusic\b/i.test(testCase.name) || /generated music/i.test(testCase.name)) return 'music'
  if (/uses cheapest model/i.test(testCase.name)) return 'write'
  return null
}

const inferServiceHints = (testCase: ParsedJunitCase): Set<string> => {
  const text = `${testCase.file} ${testCase.name}`
  const services = new Set<string>()

  for (const hint of KNOWN_SERVICE_HINTS) {
    if (hint.pattern.test(text)) {
      services.add(hint.service)
    }
  }

  return services
}

const addModelHint = (models: Set<string>, value: string | null | undefined): void => {
  const normalized = normalizeValue(value)
  if (normalized) {
    models.add(normalized)
  }
}

const inferModelHints = (testCase: ParsedJunitCase): Set<string> => {
  const models = new Set<string>()
  const name = testCase.name

  addModelHint(models, name.match(/uses cheapest model (.+?)(?: at minimal cost settings)?$/i)?.[1])
  addModelHint(models, name.match(/with --mistral-ocr ([A-Za-z0-9./_-]+)/i)?.[1])
  addModelHint(models, name.match(/with --glm-ocr ([A-Za-z0-9./_-]+)/i)?.[1])
  addModelHint(models, name.match(/^([A-Za-z0-9./_-]+) (?:model generates|generates|runs in parallel|uses cheapest model)/i)?.[1])

  for (const match of name.matchAll(/--[a-z-]+\s+([A-Za-z0-9./_-]+)/gi)) {
    addModelHint(models, match[1])
  }

  return models
}

const buildTestContext = (testCase: ParsedJunitCase): TestContext => {
  return {
    testCase,
    kind: inferTestKind(testCase),
    isPrice: /\bprice\b/i.test(testCase.name),
    serviceHints: inferServiceHints(testCase),
    modelHints: inferModelHints(testCase),
  }
}

const metricModelMatches = (modelHints: Set<string>, metricPairs: ServiceModelPair[]): boolean => {
  if (modelHints.size === 0) return true

  for (const pair of metricPairs) {
    if (pair.model && modelHints.has(normalizeValue(pair.model) as string)) {
      return true
    }
  }

  return false
}

const metricServiceMatches = (serviceHints: Set<string>, metricPairs: ServiceModelPair[]): boolean => {
  if (serviceHints.size === 0) return true

  for (const pair of metricPairs) {
    if (serviceHints.has(normalizeValue(pair.service) as string)) {
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
        addToMatched(matched, candidates[0]!, metric, 'name-global')
        continue
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
    for (let i = 0; i < count; i++) {
      addToMatched(matched, tcAtLine[i]!, groupMetrics[i]!, 'group-order')
    }
    for (let i = count; i < groupMetrics.length; i++) {
      unmatched.push(groupMetrics[i]!)
    }
  }

  const remainingAfterHeuristic = await addHeuristicMatches(matched, unmatched, junitCases, artifacts)
  return { matched, unmatched: remainingAfterHeuristic }
}

const readHistoricalLookups = async (
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

const selectPrimaryPairs = (testCase: ParsedJunitCase, pairs: ServiceModelPair[]): ServiceModelPair[] => {
  const deduped = dedupePairs(pairs)
  if (deduped.length === 0) return []

  const kind = inferTestKind(testCase)
  if (!kind) return deduped

  const kindMatches = deduped.filter(pair => pair.kind === kind)
  return kindMatches.length > 0 ? kindMatches : deduped
}

const joinUnique = (values: Array<string | null>): string | null => {
  const unique = [...new Set(values.filter((value): value is string => Boolean(value)))].sort((a, b) =>
    a.localeCompare(b, undefined, { sensitivity: 'base' })
  )
  return unique.length > 0 ? unique.join(', ') : null
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
    const primaryPairs = selectPrimaryPairs(
      {
        id: test.id,
        file: test.file,
        name: test.name,
        line: null,
        durationMs: test.durationMs,
        status: test.status as ParsedJunitCase['status'],
        failureMessage: null,
      },
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

  const tests = junitCases.map(tc => {
    const entry = matched.get(tc.id)
    const linked = entry?.metrics ?? []
    const matchedBy = entry?.matchedBy ?? null

    return {
      id: tc.id,
      file: tc.file,
      name: tc.name,
      status: tc.status,
      durationMs: tc.durationMs,
      metrics: summarizeLinkedMetrics(linked, historical, tc.id, matchedBy),
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
      cliMetricEligiblePassedCount: tests.filter(t => t.status === 'passed' && t.metrics['source'] === 'runCommand').length,
      matchedMetricCount,
      unmatchedMetricCount,
      passedWithoutMetricsCount: tests.filter(t => t.status === 'passed' && t.metrics['source'] === 'none').length,
    },
    tests,
    failures,
    e2e,
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
