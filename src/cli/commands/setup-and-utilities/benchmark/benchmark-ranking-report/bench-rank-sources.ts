import { dirname, join, relative } from 'node:path'
import { getModelRegistry } from '../../models/model-loader'
import {
  DASHBOARD_STEP_BY_CATEGORY,
  EXCLUDED_SERVICES,
  QUALITY_METRIC_BY_RAW_TYPE,
  QUALITY_STEPS,
  RAW_BENCHMARKS_DIR,
  RAW_STEP_BY_TYPE,
  RESULTS_DIR,
  STT_DIARIZATION_GROUP_BY_SERVICE
} from './bench-rank-config'
import {
  firstPathSegment,
  getArray,
  getBoolean,
  getNestedNumber,
  getNumber,
  getObject,
  getObjectArray,
  getString,
  isObject,
  listFilesRecursive,
  parentDirectoryName,
  readJson,
  relativeToProject
} from './bench-rank-io'
import type { ModelRegistry } from '~/types'
import type {
  DashboardFile,
  JsonObject,
  ProviderAggregate,
  RawReportFile,
  ReportStats,
  SourceSample,
  SttDiarizationGroup,
  StepKey
} from './bench-rank-types'

export const createStats = (): ReportStats => ({
  indexFiles: 0,
  benchmarkDashboardsSkipped: 0,
  benchmarkDashboardsWithoutDocsRaw: 0,
  dashboardReportsRead: 0,
  rawReportsRead: 0,
  totalRowsSeen: 0,
  includedRows: 0,
  excludedNonThirdPartyRows: 0,
  omittedFailedRows: 0,
  unsupportedCategoryRows: 0,
  noMetricRows: 0,
  priceRowsFilledFromRunEstimates: 0,
  missingPriceRows: 0,
  missingSpeedRows: 0,
  missingQualityRows: 0,
  contributedSources: new Set(),
  skippedBenchmarkDashboards: []
})

const serviceFromKey = (key: string): string => {
  const service = key.split('/')[0]
  return (service ?? key).trim().toLowerCase()
}

const sttDiarizationGroupFromService = (key: string): SttDiarizationGroup | undefined => {
  const group = STT_DIARIZATION_GROUP_BY_SERVICE.get(serviceFromKey(key))
  return group
}

export const isExcludedService = (keyOrService: string): boolean =>
  EXCLUDED_SERVICES.has(serviceFromKey(keyOrService))

const isLocalRawProvider = (provider: JsonObject, key: string): boolean => {
  const group = getString(provider, 'group')?.toLowerCase()
  const providerName = getString(provider, 'provider') ?? getString(provider, 'ttsService') ?? key
  return group === 'local' || isExcludedService(providerName) || isExcludedService(key)
}

const rawProviderKey = (provider: JsonObject): string => {
  const providerKey = getString(provider, 'providerKey')
  const providerName = getString(provider, 'provider') ?? getString(provider, 'ttsService') ?? 'unknown'
  const modelName = getString(provider, 'model') ?? getString(provider, 'ttsModel')

  if (providerKey && providerKey.includes('/')) {
    return providerKey
  }

  return modelName ? `${providerName}/${modelName}` : providerKey ?? providerName
}

const dashboardProviderKey = (test: JsonObject): string => {
  const serviceName = getString(test, 'serviceName') ?? 'unknown'
  const modelName = getString(test, 'modelName') ?? 'unknown'
  return `${serviceName}/${modelName}`
}

const REGISTRY_STEP_BY_RANKING_STEP = new Map<StepKey, keyof ModelRegistry>([
  ['documentOcr', 'extract'],
  ['transcription', 'stt'],
  ['llm', 'llm'],
  ['tts', 'tts'],
  ['image', 'image'],
  ['video', 'video'],
  ['music', 'music']
])

const splitProviderModelKey = (key: string): { service: string, model: string } | undefined => {
  const normalizedKey = key.split('#')[0] ?? key
  const [service, ...modelParts] = normalizedKey.split('/')
  if (!service || modelParts.length === 0) {
    return undefined
  }

  return {
    service,
    model: modelParts.join('/')
  }
}

const isCurrentRegistryModel = (step: StepKey, key: string): boolean => {
  const registryStep = REGISTRY_STEP_BY_RANKING_STEP.get(step)
  if (!registryStep) {
    return true
  }

  const providerModel = splitProviderModelKey(key)
  if (!providerModel) {
    return true
  }

  return getModelRegistry()[registryStep][providerModel.service]?.models[providerModel.model] !== undefined
}

export const buildEstimatedCostCentsByProviderModel = (runJson: unknown): Map<string, number> => {
  const costCentsByKey = new Map<string, number>()
  if (!isObject(runJson)) {
    return costCentsByKey
  }

  const metadata = getObject(runJson, 'metadata')
  const cost = metadata ? getObject(metadata, 'cost') : undefined
  const estimated = cost ? getObject(cost, 'estimated') : undefined
  const steps = estimated ? getObjectArray(estimated, 'steps') : []

  for (const step of steps) {
    const provider = getString(step, 'provider')
    const model = getString(step, 'model')
    const costCents = getNumber(step, 'cost') ?? getNumber(step, 'costCents') ?? getNumber(step, 'estimatedCostCents')

    if (provider && model && costCents !== undefined) {
      costCentsByKey.set(`${provider}/${model}`, costCents)
    }
  }

  return costCentsByKey
}

export const resolveRawCostUsd = (
  provider: Record<string, unknown>,
  estimatedCostCentsByKey: ReadonlyMap<string, number> = new Map()
): { priceUsd: number | undefined; usedEstimateFallback: boolean } => {
  const actualCostCents = getNumber(provider, 'actualCostCents')
  if (actualCostCents !== undefined && actualCostCents > 0) {
    return { priceUsd: actualCostCents / 100, usedEstimateFallback: false }
  }

  const costCents = getNumber(provider, 'costCents')
  if (costCents !== undefined && costCents > 0) {
    return { priceUsd: costCents / 100, usedEstimateFallback: false }
  }

  const estimatedCostCents = estimatedCostCentsByKey.get(rawProviderKey(provider))
  if (estimatedCostCents !== undefined && estimatedCostCents > 0) {
    return { priceUsd: estimatedCostCents / 100, usedEstimateFallback: true }
  }

  if (actualCostCents === 0 || costCents === 0) {
    return { priceUsd: 0, usedEstimateFallback: false }
  }

  return { priceUsd: undefined, usedEstimateFallback: false }
}

const readRawRunEstimatedCosts = async (report: RawReportFile): Promise<Map<string, number>> => {
  const runPath = join(dirname(report.absPath), 'run.json')
  if (!await Bun.file(runPath).exists()) {
    return new Map()
  }

  return buildEstimatedCostCentsByProviderModel(await readJson(runPath))
}

export const resolveRawSpeedMsForRanking = (provider: JsonObject): number | undefined =>
  getNumber(provider, 'msPerUnit') ?? getNumber(provider, 'actualProcessingTimeMs') ?? getNumber(provider, 'processingTimeMs')

const rawQualityScore = (provider: JsonObject, rawType: string): number | undefined => {
  if (rawType === 'url') {
    const accuracyScore = getNumber(provider, 'accuracyScore')
    if (accuracyScore !== undefined) {
      return accuracyScore <= 1 ? accuracyScore * 100 : accuracyScore
    }

    const metrics = getObject(provider, 'metrics')
    const wer = metrics ? getNumber(metrics, 'wer') : undefined
    const cer = metrics ? getNumber(metrics, 'cer') : undefined
    const contentCoverage = metrics ? getNumber(metrics, 'contentCoverage') : undefined
    if (wer !== undefined && cer !== undefined && contentCoverage !== undefined) {
      return Math.max(0, Math.min(100, ((1 - wer) * 0.5 + (1 - cer) * 0.25 + contentCoverage * 0.25) * 100))
    }

    return undefined
  }

  if (rawType === 'tts') {
    const metrics = getObject(provider, 'metrics')
    const qualityScore = getNumber(provider, 'qualityScore')
      ?? getNumber(provider, 'humanSpeechScore')
      ?? getNestedNumber(metrics, 'qualityScore')
      ?? getNestedNumber(metrics, 'humanSpeechScore')
    if (qualityScore !== undefined) {
      return qualityScore
    }
    const roundtripWer = getNumber(provider, 'roundtripWER')
    return roundtripWer === undefined ? undefined : Math.max(0, 100 * (1 - roundtripWer))
  }

  if (rawType === 'image' || rawType === 'video') {
    const metrics = getObject(provider, 'metrics')
    return getNumber(provider, 'qualityScore') ?? getNumber(provider, 'qualityValue') ?? getNestedNumber(metrics, 'qualityScore')
  }

  if (rawType === 'ocr' || rawType === 'stt') {
    return getNumber(provider, 'score')
  }

  return undefined
}

const rawQualityMetric = (rawType: string): string | undefined => {
  return QUALITY_METRIC_BY_RAW_TYPE.get(rawType)
}

const rawSttDiarizationGroup = (provider: JsonObject, key: string): SttDiarizationGroup | undefined => {
  const supportsDiarization = getBoolean(provider, 'supportsDiarization')
  if (supportsDiarization !== undefined) {
    return supportsDiarization ? 'diarization' : 'nonDiarization'
  }

  const diarizationSupport = getString(provider, 'diarizationSupport')?.toLowerCase()
  if (diarizationSupport === 'supported') {
    return 'diarization'
  }
  if (diarizationSupport === 'not-supported') {
    return 'nonDiarization'
  }

  return sttDiarizationGroupFromService(key)
}

const providerRowsFromRawReport = (json: unknown, rawType: string): JsonObject[] => {
  if (!isObject(json)) {
    return []
  }

  const providerGroups = getObject(json, 'providerGroups')
  const providerGroupRows = providerGroups
    ? Object.values(providerGroups).filter(isObject).flatMap((group) => getObjectArray(group, 'providers'))
    : []

  if (rawType === 'tts') {
    if (providerGroupRows.length > 0) {
      return providerGroupRows
    }

    const local = getObject(json, 'local')
    const cloud = getObject(json, 'cloud')
    return [
      ...(local ? getObjectArray(local, 'providers') : []),
      ...(cloud ? getObjectArray(cloud, 'providers') : [])
    ]
  }

  const overall = getObject(json, 'overall')
  if (overall) {
    const overallProviders = getObjectArray(overall, 'providers')
    if (overallProviders.length > 0) {
      return overallProviders
    }
  }

  const providers = getObjectArray(json, 'providers')
  if (providers.length > 0) {
    return providers
  }

  if (providerGroupRows.length > 0) {
    return providerGroupRows
  }

  return getArray(json, 'overall').filter(isObject)
}

export const resolveDashboardSpeedMsForRanking = (test: JsonObject): number | undefined => {
  const durations = getObject(test, 'durations')
  const primaryStep = durations ? getObject(durations, 'primaryStep') : undefined
  const endToEnd = durations ? getObject(durations, 'endToEnd') : undefined
  return getNestedNumber(primaryStep, 'actualMsPerUnit') ?? getNestedNumber(primaryStep, 'actualMs') ?? getNestedNumber(endToEnd, 'actualMs')
}

const dashboardCostUsd = (test: JsonObject): number | undefined => {
  const cost = getObject(test, 'cost')
  return getNestedNumber(cost, 'runtimeEstimatedUsd') ?? getNestedNumber(cost, 'estimatedUsd')
}

const hasMetric = (sample: SourceSample): boolean =>
  sample.priceUsd !== undefined || sample.speedMs !== undefined || sample.qualityScore !== undefined

const trackIncludedSample = (sample: SourceSample, stats: ReportStats): void => {
  stats.includedRows++
  stats.contributedSources.add(sample.sourcePath)

  if (sample.priceUsd === undefined) {
    stats.missingPriceRows++
  }
  if (sample.speedMs === undefined) {
    stats.missingSpeedRows++
  }
  if (QUALITY_STEPS.has(sample.step) && sample.qualityScore === undefined) {
    stats.missingQualityRows++
  }
}

const aggregateSample = (
  aggregates: Map<StepKey, Map<string, ProviderAggregate>>,
  sample: SourceSample
): void => {
  let stepAggregates = aggregates.get(sample.step)
  if (!stepAggregates) {
    stepAggregates = new Map()
    aggregates.set(sample.step, stepAggregates)
  }

  let aggregate = stepAggregates.get(sample.key)
  if (!aggregate) {
    aggregate = {
      key: sample.key,
      priceValues: [],
      speedValues: [],
      qualityValues: [],
      qualityMetrics: new Set(),
      sources: new Set(),
      sourceKinds: new Set(),
      sttDiarizationGroups: new Set()
    }
    stepAggregates.set(sample.key, aggregate)
  }

  if (sample.priceUsd !== undefined) {
    aggregate.priceValues.push(sample.priceUsd)
  }
  if (sample.speedMs !== undefined) {
    aggregate.speedValues.push(sample.speedMs)
  }
  if (sample.qualityScore !== undefined) {
    aggregate.qualityValues.push(sample.qualityScore)
  }
  if (sample.qualityMetric !== undefined) {
    aggregate.qualityMetrics.add(sample.qualityMetric)
  }
  if (sample.sttDiarizationGroup !== undefined) {
    aggregate.sttDiarizationGroups.add(sample.sttDiarizationGroup)
  }

  aggregate.sources.add(sample.sourcePath)
  aggregate.sourceKinds.add(sample.sourceKind)
}

const processSample = (
  aggregates: Map<StepKey, Map<string, ProviderAggregate>>,
  sample: SourceSample,
  stats: ReportStats
): void => {
  if (!hasMetric(sample)) {
    stats.noMetricRows++
    return
  }

  trackIncludedSample(sample, stats)
  aggregateSample(aggregates, sample)
}

export const processRawReport = async (
  report: RawReportFile,
  aggregates: Map<StepKey, Map<string, ProviderAggregate>>,
  stats: ReportStats
): Promise<void> => {
  const step = RAW_STEP_BY_TYPE.get(report.rawType)
  if (!step) {
    throw new Error(`Unsupported raw benchmark type: ${report.rawType}`)
  }

  stats.rawReportsRead++
  const json = await readJson(report.absPath)
  const providers = providerRowsFromRawReport(json, report.rawType)
  const estimatedCostCentsByKey = await readRawRunEstimatedCosts(report)

  for (const provider of providers) {
    stats.totalRowsSeen++
    const key = rawProviderKey(provider)

    if (isLocalRawProvider(provider, key)) {
      stats.excludedNonThirdPartyRows++
      continue
    }

    const status = getString(provider, 'status')?.toLowerCase()
    if (status === 'failed') {
      stats.omittedFailedRows++
      continue
    }

    if (!isCurrentRegistryModel(step, key)) {
      stats.unsupportedCategoryRows++
      continue
    }

    const sample: SourceSample = {
      step,
      key,
      sourcePath: report.relPath,
      sourceKind: 'raw'
    }

    if (step === 'transcription') {
      const sttDiarizationGroup = rawSttDiarizationGroup(provider, key)
      if (sttDiarizationGroup !== undefined) {
        sample.sttDiarizationGroup = sttDiarizationGroup
      }
    }

    const { priceUsd, usedEstimateFallback } = resolveRawCostUsd(provider, estimatedCostCentsByKey)
    if (priceUsd !== undefined) {
      sample.priceUsd = priceUsd
      if (usedEstimateFallback) {
        stats.priceRowsFilledFromRunEstimates++
      }
    }

    const speedMs = resolveRawSpeedMsForRanking(provider)
    if (speedMs !== undefined) {
      sample.speedMs = speedMs
    }

    const qualityScore = rawQualityScore(provider, report.rawType)
    if (qualityScore !== undefined) {
      sample.qualityScore = qualityScore
      const qualityMetric = rawQualityMetric(report.rawType)
      if (qualityMetric) {
        sample.qualityMetric = qualityMetric
      }
    }

    processSample(aggregates, sample, stats)
  }
}

export const processDashboardReport = async (
  report: DashboardFile,
  aggregates: Map<StepKey, Map<string, ProviderAggregate>>,
  stats: ReportStats
): Promise<void> => {
  stats.dashboardReportsRead++
  const json = await readJson(report.absPath)
  if (!isObject(json)) {
    return
  }

  for (const test of getObjectArray(json, 'tests')) {
    stats.totalRowsSeen++
    const key = dashboardProviderKey(test)
    const status = getString(test, 'status')?.toLowerCase()

    if (status !== 'passed') {
      stats.omittedFailedRows++
      continue
    }

    if (isExcludedService(key)) {
      stats.excludedNonThirdPartyRows++
      continue
    }

    const category = getString(test, 'category') ?? 'unknown'
    const step = DASHBOARD_STEP_BY_CATEGORY.get(category)
    if (!step) {
      stats.unsupportedCategoryRows++
      continue
    }

    if (!isCurrentRegistryModel(step, key)) {
      stats.unsupportedCategoryRows++
      continue
    }

    const sample: SourceSample = {
      step,
      key,
      sourcePath: report.relPath,
      sourceKind: 'dashboard'
    }

    if (step === 'transcription') {
      const sttDiarizationGroup = sttDiarizationGroupFromService(key)
      if (sttDiarizationGroup !== undefined) {
        sample.sttDiarizationGroup = sttDiarizationGroup
      }
    }

    const priceUsd = dashboardCostUsd(test)
    if (priceUsd !== undefined) {
      sample.priceUsd = priceUsd
    }

    const speedMs = resolveDashboardSpeedMsForRanking(test)
    if (speedMs !== undefined) {
      sample.speedMs = speedMs
    }

    processSample(aggregates, sample, stats)
  }
}

export const dashboardFilesFromIndex = async (stats: ReportStats): Promise<DashboardFile[]> => {
  const indexPath = join(RESULTS_DIR, 'index.json')
  const indexJson = await readJson(indexPath)
  if (!isObject(indexJson)) {
    throw new Error('project/reports/results/index.json is not an object')
  }

  const files = getArray(indexJson, 'files').filter((value): value is string => typeof value === 'string')
  stats.indexFiles = files.length

  const dashboardFiles: DashboardFile[] = []
  for (const fileName of files) {
    const absPath = join(RESULTS_DIR, fileName)
    if (!await Bun.file(absPath).exists()) {
      throw new Error(`Index references missing report file: ${fileName}`)
    }

    const json = await readJson(absPath)
    const mode = isObject(json) ? getString(getObject(json, 'run') ?? {}, 'mode') ?? 'benchmark' : 'benchmark'
    const relPath = relativeToProject(absPath)

    if (fileName.endsWith('-benchmark-dashboard-report.json')) {
      stats.benchmarkDashboardsSkipped++
      stats.skippedBenchmarkDashboards.push(relPath)
      continue
    }

    dashboardFiles.push({ fileName, absPath, relPath, mode })
  }

  return dashboardFiles
}

export const rawReportFiles = async (): Promise<RawReportFile[]> => {
  const files = await listFilesRecursive(RAW_BENCHMARKS_DIR)
  return files
    .filter((file) => file.endsWith('provider-comparison-report.json') || file.endsWith('reference-comparison-report.json'))
    .flatMap((absPath): RawReportFile[] => {
      const rawRelative = relative(RAW_BENCHMARKS_DIR, absPath)
      const rawType = firstPathSegment(rawRelative)
      if (!rawType) {
        throw new Error(`Cannot determine raw benchmark type for ${absPath}`)
      }

      if (!RAW_STEP_BY_TYPE.has(rawType)) {
        return []
      }

      return [{
        absPath,
        relPath: relativeToProject(absPath),
        rawType,
        runId: parentDirectoryName(rawRelative)
      }]
    })
    .sort((left, right) => left.relPath.localeCompare(right.relPath))
}

export const reconcileRawReports = (rawReports: RawReportFile[], stats: ReportStats): void => {
  const rawRunIds = new Set(rawReports.map((report) => report.runId))
  const benchmarkRunIds = stats.skippedBenchmarkDashboards.map((path) =>
    path.replace(/^project\/reports\/results\//, '').replace(/-benchmark-dashboard-report\.json$/, '')
  )

  for (const runId of benchmarkRunIds) {
    if (!rawRunIds.has(runId)) {
      stats.benchmarkDashboardsWithoutDocsRaw++
    }
  }
}
