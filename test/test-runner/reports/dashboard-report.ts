import { readdir, readFile } from 'node:fs/promises'
import { basename, resolve } from 'node:path'
import type { ParsedCommandMetric, ParsedJunitCase, TestRunArtifacts } from '~/types'
import { normalizeRepoPath } from '../utils'
import {
  buildMetricContext,
  inferTestKind,
  isControlE2ETest,
  isE2ETestFile,
  selectPrimaryPairs
} from './context'
import { readHistoricalLookups } from './history'
import { matchMetricsToTests } from './matching'

const DASHBOARD_SCHEMA_VERSION = 2
const URL_BACKENDS = new Set(['defuddle', 'firecrawl', 'glm-reader', 'spider', 'zyte'])

type DashboardCategory =
  | 'document'
  | 'url'
  | 'transcription'
  | 'llm'
  | 'tts'
  | 'image'
  | 'music'
  | 'video'
  | 'uncategorized'

type DashboardRow = {
  category: DashboardCategory
  serviceName: string
  modelName: string
  runAt: string
  status: ParsedJunitCase['status']
  testFile: string
  testName: string
  command: string | null
  durations: {
    endToEnd: {
      estimatedMs: number | null
      actualMs: number | null
    }
    primaryStep: {
      estimatedMs: number | null
      actualMs: number | null
    }
  }
  cost: {
    estimatedUsd: number | null
    runtimeEstimatedUsd: number | null
  }
}

type PartialDashboardRow = {
  category: DashboardCategory
  serviceName: string
  modelName: string
  estimatedCostCents: number | null
  actualCostCents: number | null
  estimatedProcessingTimeMs: number | null
  actualProcessingTimeMs: number | null
}

type StepPatch = {
  category: DashboardCategory
  serviceName: string
  modelName: string
  estimatedCostCents?: number | null
  actualCostCents?: number | null
  estimatedProcessingTimeMs?: number | null
  actualProcessingTimeMs?: number | null
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null

const toRecordArray = (value: unknown): Record<string, unknown>[] => {
  if (Array.isArray(value)) return value.filter(isRecord)
  return isRecord(value) ? [value] : []
}

const getFiniteNumber = (value: unknown): number | null =>
  typeof value === 'number' && Number.isFinite(value) ? value : null

const getString = (value: unknown): string | null => {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

const centsToUsd = (cents: number | null): number | null =>
  cents === null ? null : cents / 100

const categoryFromStep = (
  step: string,
  service: string,
  metadata: Record<string, unknown>,
  metric: ParsedCommandMetric
): DashboardCategory => {
  const resolvedStep2 = isRecord(metadata['resolvedStep2']) ? metadata['resolvedStep2'] : null
  const articleRoute = resolvedStep2?.['route'] === 'article'
  const urlArgs = metric.args.includes('--all-url') || metric.args.includes('--url-backend')

  if (step === 'extract') {
    return articleRoute || urlArgs || URL_BACKENDS.has(service) ? 'url' : 'document'
  }
  if (step === 'stt' || step === 'transcribe') return 'transcription'
  if (step === 'llm' || step === 'write') return 'llm'
  if (step === 'tts') return 'tts'
  if (step === 'image') return 'image'
  if (step === 'music') return 'music'
  if (step === 'video') return 'video'
  return 'uncategorized'
}

const categoryFromKind = (
  kind: string | null,
  service: string,
  metric: ParsedCommandMetric
): DashboardCategory => {
  if (kind === 'extract') {
    return metric.args.includes('--all-url') || metric.args.includes('--url-backend') || URL_BACKENDS.has(service)
      ? 'url'
      : 'document'
  }
  if (kind === 'transcribe') return 'transcription'
  if (kind === 'write') return 'llm'
  if (kind === 'tts') return 'tts'
  if (kind === 'image') return 'image'
  if (kind === 'music') return 'music'
  if (kind === 'video') return 'video'
  return 'uncategorized'
}

const allowedCategoriesForKind = (kind: string | null): Set<DashboardCategory> | null => {
  if (kind === 'extract') return new Set(['document', 'url'])
  if (kind === 'transcribe') return new Set(['transcription'])
  if (kind === 'write') return new Set(['llm'])
  if (kind === 'tts') return new Set(['tts'])
  if (kind === 'image') return new Set(['image'])
  if (kind === 'music') return new Set(['music'])
  if (kind === 'video') return new Set(['video'])
  return null
}

const allowedCategoriesForTest = (
  testCase: ParsedJunitCase
): Set<DashboardCategory> | null =>
  allowedCategoriesForKind(inferTestKind(testCase))

const isKnownProviderName = (value: string): boolean => {
  const normalized = value.trim().toLowerCase()
  return normalized.length > 0
    && normalized !== 'unknown'
    && normalized !== 'n/a'
    && normalized !== 'none'
    && normalized !== 'null'
    && normalized !== 'undefined'
}

const mergePatch = (
  rows: Map<string, PartialDashboardRow>,
  patch: StepPatch
): void => {
  const serviceName = patch.serviceName.trim()
  const modelName = patch.modelName.trim()
  if (!isKnownProviderName(serviceName) || !isKnownProviderName(modelName)) return

  const key = `${patch.category}::${serviceName.toLowerCase()}::${modelName.toLowerCase()}`
  const current = rows.get(key) ?? {
    category: patch.category,
    serviceName,
    modelName,
    estimatedCostCents: null,
    actualCostCents: null,
    estimatedProcessingTimeMs: null,
    actualProcessingTimeMs: null,
  }

  if ('estimatedCostCents' in patch && patch.estimatedCostCents !== null && patch.estimatedCostCents !== undefined) {
    current.estimatedCostCents = patch.estimatedCostCents
  }
  if ('actualCostCents' in patch && patch.actualCostCents !== null && patch.actualCostCents !== undefined) {
    current.actualCostCents = patch.actualCostCents
  }
  if ('estimatedProcessingTimeMs' in patch && patch.estimatedProcessingTimeMs !== null && patch.estimatedProcessingTimeMs !== undefined) {
    current.estimatedProcessingTimeMs = patch.estimatedProcessingTimeMs
  }
  if ('actualProcessingTimeMs' in patch && patch.actualProcessingTimeMs !== null && patch.actualProcessingTimeMs !== undefined) {
    current.actualProcessingTimeMs = patch.actualProcessingTimeMs
  }

  rows.set(key, current)
}

const readSteps = (
  metadata: Record<string, unknown>,
  sectionName: 'cost' | 'timing',
  phase: 'estimated' | 'actual'
): Record<string, unknown>[] => {
  const section = isRecord(metadata[sectionName]) ? metadata[sectionName] : null
  const phaseRecord = section && isRecord(section[phase]) ? section[phase] : null
  const steps = phaseRecord?.['steps']
  return Array.isArray(steps) ? steps.filter(isRecord) : []
}

const mergeCostSteps = (
  rows: Map<string, PartialDashboardRow>,
  metadata: Record<string, unknown>,
  metric: ParsedCommandMetric,
  phase: 'estimated' | 'actual'
): void => {
  for (const stepRecord of readSteps(metadata, 'cost', phase)) {
    const step = getString(stepRecord['step'])
    const provider = getString(stepRecord['provider'])
    const model = getString(stepRecord['model']) ?? provider
    const cost = getFiniteNumber(stepRecord['cost'])
    if (!step || !provider || !model || cost === null) continue

    mergePatch(rows, {
      category: categoryFromStep(step, provider, metadata, metric),
      serviceName: provider,
      modelName: model,
      ...(phase === 'estimated' ? { estimatedCostCents: cost } : { actualCostCents: cost }),
    })
  }
}

const mergeTimingSteps = (
  rows: Map<string, PartialDashboardRow>,
  metadata: Record<string, unknown>,
  metric: ParsedCommandMetric,
  phase: 'estimated' | 'actual'
): void => {
  for (const stepRecord of readSteps(metadata, 'timing', phase)) {
    const step = getString(stepRecord['step'])
    const provider = getString(stepRecord['provider'])
    const model = getString(stepRecord['model']) ?? provider
    const processingTimeMs = getFiniteNumber(stepRecord['processingTimeMs'])
    if (!step || !provider || !model || processingTimeMs === null) continue

    mergePatch(rows, {
      category: categoryFromStep(step, provider, metadata, metric),
      serviceName: provider,
      modelName: model,
      ...(phase === 'estimated'
        ? { estimatedProcessingTimeMs: processingTimeMs }
        : { actualProcessingTimeMs: processingTimeMs }),
    })
  }
}

const providerFromExtractionMethod = (method: string): string | null => {
  if (method.startsWith('html+')) return method.slice('html+'.length)
  if (method.includes('tesseract')) return 'tesseract'
  if (method.includes('ocrmypdf')) return 'ocrmypdf'
  if (method.includes('paddle-ocr')) return 'paddle-ocr'
  if (method.includes('mistral-ocr')) return 'mistral'
  if (method.includes('glm-ocr')) return 'glm'
  if (method.includes('kimi-ocr')) return 'kimi'
  if (method.includes('openai-ocr')) return 'openai'
  if (method.includes('anthropic-ocr')) return 'anthropic'
  if (method.includes('gemini-ocr')) return 'gemini'
  if (method.includes('aws-textract')) return 'aws-textract'
  if (method.includes('gcloud-docai')) return 'gcloud-docai'
  return null
}

const mergeStep2MetadataRows = (
  rows: Map<string, PartialDashboardRow>,
  metadata: Record<string, unknown>,
  metric: ParsedCommandMetric
): void => {
  const resolvedStep2 = isRecord(metadata['resolvedStep2']) ? metadata['resolvedStep2'] : null
  const articleRoute = resolvedStep2?.['route'] === 'article'

  for (const entry of toRecordArray(metadata['step2'])) {
    const method = getString(entry['extractionMethod'])
    const processingTime = getFiniteNumber(entry['processingTime'])
    const transcriptionService = getString(entry['transcriptionService'])
    const transcriptionModel = getString(entry['transcriptionModel']) ?? transcriptionService

    if (transcriptionService && transcriptionModel) {
      mergePatch(rows, {
        category: 'transcription',
        serviceName: transcriptionService,
        modelName: transcriptionModel,
        actualProcessingTimeMs: processingTime,
      })
      continue
    }

    if (!method) continue

    const service = getString(entry['ocrService']) ?? providerFromExtractionMethod(method)
    const model = getString(entry['ocrModel']) ?? service
    if (!service || !model) continue

    mergePatch(rows, {
      category: articleRoute || method.startsWith('html+') || metric.args.includes('--all-url') || metric.args.includes('--url-backend')
        ? 'url'
        : 'document',
      serviceName: service,
      modelName: model,
      actualProcessingTimeMs: processingTime,
    })
  }
}

const mergeGenericMetadataRows = (
  rows: Map<string, PartialDashboardRow>,
  metadata: Record<string, unknown>
): void => {
  const groups: Array<{
    value: unknown
    category: DashboardCategory
    serviceField: string
    modelField: string
    alternateServiceField?: string
    alternateModelField?: string
  }> = [
    { value: metadata['step3'], category: 'llm', serviceField: 'llmService', modelField: 'llmModel' },
    { value: metadata['step4'], category: 'tts', serviceField: 'ttsService', modelField: 'ttsModel' },
    { value: metadata['tts'], category: 'tts', serviceField: 'ttsService', modelField: 'ttsModel' },
    { value: metadata['step5'], category: 'image', serviceField: 'imageService', modelField: 'imageModel' },
    { value: metadata['image'], category: 'image', serviceField: 'imageService', modelField: 'imageModel' },
    {
      value: metadata['video'],
      category: 'video',
      serviceField: 'videoService',
      modelField: 'videoModel',
      alternateServiceField: 'videoGenService',
      alternateModelField: 'videoGenModel',
    },
    { value: metadata['music'], category: 'music', serviceField: 'musicService', modelField: 'musicModel' },
  ]

  for (const group of groups) {
    for (const entry of toRecordArray(group.value)) {
      const service = getString(entry[group.serviceField])
        ?? (group.alternateServiceField ? getString(entry[group.alternateServiceField]) : null)
      const model = getString(entry[group.modelField])
        ?? (group.alternateModelField ? getString(entry[group.alternateModelField]) : null)
        ?? service
      if (!service || !model) continue
      mergePatch(rows, {
        category: group.category,
        serviceName: service,
        modelName: model,
        actualProcessingTimeMs: getFiniteNumber(entry['processingTime']),
      })
    }
  }
}

const mergeRequestedUrlBackends = (
  rows: Map<string, PartialDashboardRow>,
  metadata: Record<string, unknown>
): void => {
  const resolvedStep2 = isRecord(metadata['resolvedStep2']) ? metadata['resolvedStep2'] : null
  if (resolvedStep2?.['route'] !== 'article') return

  const requested = [
    ...toRecordArray(metadata['requestedProviders']),
    ...toRecordArray(metadata['providerStates']),
  ]

  for (const entry of requested) {
    const service = getString(entry['service'])
    const model = getString(entry['model']) ?? service
    if (!service || !model || !URL_BACKENDS.has(service)) continue
    mergePatch(rows, {
      category: 'url',
      serviceName: service,
      modelName: model,
    })
  }
}

const unwrapRunMetadata = (manifest: Record<string, unknown>): Record<string, unknown> | null => {
  const metadata = manifest['metadata']
  if (isRecord(metadata)) return metadata
  return manifest
}

const rowsFromManifest = (
  manifest: Record<string, unknown>,
  metric: ParsedCommandMetric,
  allowedCategories: Set<DashboardCategory> | null
): PartialDashboardRow[] => {
  const metadata = unwrapRunMetadata(manifest)
  if (!metadata) return []

  const rows = new Map<string, PartialDashboardRow>()
  mergeCostSteps(rows, metadata, metric, 'estimated')
  mergeCostSteps(rows, metadata, metric, 'actual')
  mergeTimingSteps(rows, metadata, metric, 'estimated')
  mergeTimingSteps(rows, metadata, metric, 'actual')
  mergeStep2MetadataRows(rows, metadata, metric)
  mergeGenericMetadataRows(rows, metadata)
  mergeRequestedUrlBackends(rows, metadata)

  const out = [...rows.values()]
  return allowedCategories ? out.filter(row => allowedCategories.has(row.category)) : out
}

const collectManifestPaths = async (artifacts: TestRunArtifacts): Promise<Map<string, string>> => {
  const out = new Map<string, string>()

  for (const dir of [resolve(artifacts.runDir, 'run'), artifacts.metadataDirPath]) {
    let entries
    try {
      entries = await readdir(dir, { withFileTypes: true })
    } catch {
      continue
    }

    for (const entry of entries) {
      if (!entry.isFile() || !entry.name.endsWith('.json')) continue
      const key = entry.name.replace(/\.json$/, '')
      if (!out.has(key)) {
        out.set(key, resolve(dir, entry.name))
      }
    }
  }

  return out
}

const readManifest = async (
  path: string,
  cache: Map<string, Record<string, unknown> | null>
): Promise<Record<string, unknown> | null> => {
  if (cache.has(path)) return cache.get(path) ?? null

  try {
    const parsed = JSON.parse(await readFile(path, 'utf8')) as unknown
    const record = isRecord(parsed) ? parsed : null
    cache.set(path, record)
    return record
  } catch {
    cache.set(path, null)
    return null
  }
}

const metricRunAt = (metric: ParsedCommandMetric, fallbackIso: string): string => {
  if (!metric.at) return fallbackIso
  const atMs = Date.parse(metric.at)
  if (!Number.isFinite(atMs)) return fallbackIso
  return new Date(Math.max(0, atMs - metric.durationMs)).toISOString()
}

const fallbackRowsFromMetric = async (
  metric: ParsedCommandMetric,
  testCase: ParsedJunitCase,
  artifacts: TestRunArtifacts,
  metadataCache: Map<string, Record<string, unknown> | null>
): Promise<PartialDashboardRow[]> => {
  const metricContext = await buildMetricContext(metric, artifacts, metadataCache)
  const primaryPairs = selectPrimaryPairs(testCase, metricContext.pairs)
  if (primaryPairs.length === 0) {
    return []
  }

  const useMetricTotals = primaryPairs.length === 1
  return primaryPairs.map(pair => ({
    category: categoryFromKind(pair.kind ?? metricContext.kind, pair.service, metric),
    serviceName: pair.service,
    modelName: pair.model ?? pair.service,
    estimatedCostCents: useMetricTotals ? metric.estimatedCostCents : null,
    actualCostCents: useMetricTotals ? metric.actualCostCents : null,
    estimatedProcessingTimeMs: useMetricTotals ? metric.estimatedProcessingTimeMs : null,
    actualProcessingTimeMs: useMetricTotals ? metric.actualProcessingTimeMs : null,
  }))
}

export const buildDashboardReportData = async (
  junitCases: ParsedJunitCase[],
  metrics: ParsedCommandMetric[],
  artifacts: TestRunArtifacts,
  endedAtIso: string,
  endedAtMs: number,
  argv: string[]
): Promise<Record<string, unknown>> => {
  const { matched } = await matchMetricsToTests(metrics, junitCases, artifacts)
  const historical = await readHistoricalLookups(artifacts)
  const manifestPaths = await collectManifestPaths(artifacts)
  const manifestCache = new Map<string, Record<string, unknown> | null>()
  const metadataCache = new Map<string, Record<string, unknown> | null>()
  const rows: DashboardRow[] = []

  for (const testCase of junitCases) {
    if (!isE2ETestFile(testCase.file) || isControlE2ETest(testCase.name)) {
      continue
    }

    const linked = matched.get(testCase.id)?.metrics ?? []
    for (const [metricIndex, metric] of linked.entries()) {
      const outputKey = metric.outputDir ? basename(metric.outputDir) : null
      const manifestPath = outputKey ? manifestPaths.get(outputKey) : undefined
      const manifest = manifestPath ? await readManifest(manifestPath, manifestCache) : null
      const allowedCategories = allowedCategoriesForTest(testCase)
      const manifestRows = manifest ? rowsFromManifest(manifest, metric, allowedCategories) : []
      const usesManifestRows = manifestRows.length > 0
      const partialRows = usesManifestRows
        ? manifestRows
        : await fallbackRowsFromMetric(metric, testCase, artifacts, metadataCache)
      const dedupePrefix = `${testCase.id}::${metricIndex}`
      const seen = new Set<string>()

      for (const partial of partialRows) {
        const dedupeKey = `${dedupePrefix}::${partial.category}::${partial.serviceName}::${partial.modelName}`
        if (seen.has(dedupeKey)) continue
        seen.add(dedupeKey)

        rows.push({
          category: partial.category,
          serviceName: partial.serviceName,
          modelName: partial.modelName,
          runAt: metricRunAt(metric, artifacts.startedAtIso),
          status: testCase.status,
          testFile: testCase.file,
          testName: testCase.name,
          command: metric.command || null,
          durations: {
            endToEnd: {
              estimatedMs: historical.durationById.get(testCase.id) ?? null,
              actualMs: metric.durationMs,
            },
            primaryStep: {
              estimatedMs: partial.estimatedProcessingTimeMs,
              actualMs: partial.actualProcessingTimeMs ?? (usesManifestRows ? null : metric.actualProcessingTimeMs),
            },
          },
          cost: {
            estimatedUsd: centsToUsd(partial.estimatedCostCents),
            runtimeEstimatedUsd: centsToUsd(partial.actualCostCents),
          },
        })
      }
    }
  }

  rows.sort((left, right) =>
    left.category.localeCompare(right.category)
    || left.serviceName.localeCompare(right.serviceName)
    || left.modelName.localeCompare(right.modelName)
    || left.testFile.localeCompare(right.testFile)
    || left.testName.localeCompare(right.testName)
  )

  return {
    schemaVersion: DASHBOARD_SCHEMA_VERSION,
    generatedAt: new Date().toISOString(),
    run: {
      id: artifacts.runId,
      mode: 'test',
      startedAt: artifacts.startedAtIso,
      endedAt: endedAtIso,
      durationMs: Math.max(0, endedAtMs - artifacts.startedAtMs),
      argv,
      artifactDir: normalizeRepoPath(artifacts.runDir),
    },
    summary: {
      total: rows.length,
      passed: rows.filter(row => row.status === 'passed').length,
      failed: rows.filter(row => row.status === 'failed').length,
      skipped: rows.filter(row => row.status === 'skipped').length,
    },
    tests: rows,
  }
}
