import { readdir, readFile, stat } from 'node:fs/promises'
import { resolve } from 'node:path'
import { MODEL_CONFIG_FRAGMENT_PREFIXES, MODEL_CONFIG_PATHS } from '~/cli/commands/setup-and-utilities/models/model-loader'
import { getFiniteNumber } from './utils'

type CalibrationKind = 'stt' | 'extract' | 'llm' | 'tts' | 'image' | 'video' | 'music'

type ConfigPaths = Partial<Record<CalibrationKind, string>>

type StepObservation = {
  kind: CalibrationKind
  service: string
  model: string
  estimatedCostCents: number | null
  rawEstimatedCostCents: number | null
  actualCostCents: number | null
  actualProcessingTimeMs: number | null
  actualMsPerUnit: number | null
  unitValue: number | null
}

type CalibrationRecommendation = {
  kind: CalibrationKind
  service: string
  model: string
  costSamples: number
  timeSamples: number
  oldCostMultiplier: number | null
  recommendedCostMultiplier: number | null
  medianCostMultiplier: number | null
  timeField: string
  oldTimeValue: number | null
  recommendedTimeValue: number | null
  medianTimeValue: number | null
  notes?: string[]
}

type CalibrationReport = {
  generatedAt: string
  rootDir: string
  runsScanned: number
  metadataFilesScanned: number
  recommendedModels: number
  recommendations: CalibrationRecommendation[]
}

type StepShape = {
  kind: CalibrationKind
  service: string
  model: string
}

type MutableJson = Record<string, unknown>

const COST_DRIFT_THRESHOLD = 0.1
const TIME_DRIFT_THRESHOLD = 0.1
const SMOOTHING_FACTOR = 0.35
const MAX_CHANGE_FACTOR = 0.5

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

const normalizeLlmService = (service: string): string => {
  return service === 'llama.cpp' ? 'llama' : service
}

const buildStepKey = (step: Pick<StepShape, 'kind' | 'service' | 'model'>): string => {
  return `${step.kind}::${step.service}::${step.model}`
}

const median = (values: number[]): number | null => {
  if (values.length === 0) return null
  const sorted = [...values].sort((a, b) => a - b)
  const middle = Math.floor(sorted.length / 2)
  if (sorted.length % 2 === 1) {
    return sorted[middle] ?? null
  }
  const left = sorted[middle - 1]
  const right = sorted[middle]
  if (left === undefined || right === undefined) return null
  return (left + right) / 2
}

const clampChange = (current: number, next: number): number => {
  const min = current * (1 - MAX_CHANGE_FACTOR)
  const max = current * (1 + MAX_CHANGE_FACTOR)
  return Math.min(max, Math.max(min, next))
}

const smoothValue = (current: number | null, observed: number): number => {
  if (current === null || !Number.isFinite(current) || current <= 0) {
    return observed
  }
  return clampChange(current, current + ((observed - current) * SMOOTHING_FACTOR))
}

const roundCostMultiplier = (value: number): number => Math.round(value * 10_000) / 10_000
const roundTimeValue = (value: number): number => Math.max(1, Math.round(value))

const normalizeStepShape = (
  kind: string,
  service: string,
  model: string
): StepShape | null => {
  const normalizedKind = kind === 'extract' || kind === 'stt' || kind === 'llm' || kind === 'tts' || kind === 'image' || kind === 'video' || kind === 'music'
    ? kind
    : null
  if (!normalizedKind || service.length === 0 || model.length === 0) {
    return null
  }

  return {
    kind: normalizedKind,
    service: normalizedKind === 'llm' ? normalizeLlmService(service) : service,
    model,
  }
}

const normalizeUnitValue = (
  kind: CalibrationKind,
  metric: string | null,
  value: number | null
): number | null => {
  if (value === null || value <= 0) return null

  switch (kind) {
    case 'stt':
    case 'video':
    case 'music':
      if (metric === 'durationMs') return value / 1000
      if (metric === 'durationSeconds') return value
      return null
    case 'extract':
      return metric === 'pages' ? value : null
    case 'llm':
      return metric === 'tokens' ? value : null
    case 'tts':
      return metric === 'characters' ? value : null
    case 'image':
      return metric === 'images' ? value : null
  }
}

const computeObservedTimeRate = (kind: CalibrationKind, actualProcessingTimeMs: number, unitValue: number): number | null => {
  if (!Number.isFinite(actualProcessingTimeMs) || actualProcessingTimeMs <= 0 || !Number.isFinite(unitValue) || unitValue <= 0) {
    return null
  }

  switch (kind) {
    case 'llm':
    case 'tts':
      return (actualProcessingTimeMs / unitValue) * 1000
    case 'stt':
    case 'extract':
    case 'image':
    case 'video':
    case 'music':
      return actualProcessingTimeMs / unitValue
  }
}

const getTimeFieldName = (kind: CalibrationKind): string => {
  switch (kind) {
    case 'llm':
      return 'msPer1KTokens'
    case 'tts':
      return 'msPer1KChars'
    case 'image':
      return 'msPerImage'
    case 'stt':
    case 'video':
    case 'music':
      return 'msPerSecond'
    case 'extract':
      return 'msPerPage'
  }
}

const getActualCostSteps = (metadata: Record<string, unknown>): Map<string, { cost: number, unitValue: number | null }> => {
  const cost = metadata['cost']
  if (!isRecord(cost)) return new Map()
  const actual = cost['actual']
  if (!isRecord(actual)) return new Map()
  const steps = Array.isArray(actual['steps']) ? actual['steps'] : []
  const out = new Map<string, { cost: number, unitValue: number | null }>()

  for (const rawStep of steps) {
    if (!isRecord(rawStep)) continue
    const kind = typeof rawStep['step'] === 'string' ? rawStep['step'] : ''
    const service = typeof rawStep['provider'] === 'string' ? rawStep['provider'] : ''
    const model = typeof rawStep['model'] === 'string' ? rawStep['model'] : ''
    const normalized = normalizeStepShape(kind, service, model)
    const costValue = getFiniteNumber(rawStep['cost'])
    if (!normalized || costValue === null) continue

    const metric = typeof rawStep['inputMetric'] === 'string' ? rawStep['inputMetric'] : null
    const inputValue = normalizeUnitValue(normalized.kind, metric, getFiniteNumber(rawStep['inputValue']))
    out.set(buildStepKey(normalized), { cost: costValue, unitValue: inputValue })
  }

  return out
}

const getEstimatedCostSteps = (metadata: Record<string, unknown>): Map<string, { cost: number, rawCost: number }> => {
  const cost = metadata['cost']
  if (!isRecord(cost)) return new Map()
  const estimated = cost['estimated']
  if (!isRecord(estimated)) return new Map()
  const steps = Array.isArray(estimated['steps']) ? estimated['steps'] : []
  const out = new Map<string, { cost: number, rawCost: number }>()

  for (const rawStep of steps) {
    if (!isRecord(rawStep)) continue
    const kind = typeof rawStep['step'] === 'string' ? rawStep['step'] : ''
    const service = typeof rawStep['provider'] === 'string' ? rawStep['provider'] : ''
    const model = typeof rawStep['model'] === 'string' ? rawStep['model'] : ''
    const normalized = normalizeStepShape(kind, service, model)
    const costValue = getFiniteNumber(rawStep['cost'])
    if (!normalized || costValue === null) continue

    const multiplier = getFiniteNumber(rawStep['costMultiplier']) ?? 1
    const rawCost = multiplier > 0 ? costValue / multiplier : costValue
    out.set(buildStepKey(normalized), { cost: costValue, rawCost })
  }

  return out
}

const getTimingActualSteps = (metadata: Record<string, unknown>): Map<string, { processingTimeMs: number, msPerUnit: number | null, unitValue: number | null }> => {
  const timing = metadata['timing']
  if (!isRecord(timing)) return new Map()
  const actual = timing['actual']
  if (!isRecord(actual)) return new Map()
  const steps = Array.isArray(actual['steps']) ? actual['steps'] : []
  const out = new Map<string, { processingTimeMs: number, msPerUnit: number | null, unitValue: number | null }>()

  for (const rawStep of steps) {
    if (!isRecord(rawStep)) continue
    const timingScope = typeof rawStep['timingScope'] === 'string' ? rawStep['timingScope'] : null
    if (timingScope !== null && timingScope !== 'wall') continue
    const kind = typeof rawStep['step'] === 'string' ? rawStep['step'] : ''
    const service = typeof rawStep['provider'] === 'string' ? rawStep['provider'] : ''
    const model = typeof rawStep['model'] === 'string' ? rawStep['model'] : ''
    const normalized = normalizeStepShape(kind, service, model)
    const processingTimeMs = getFiniteNumber(rawStep['processingTimeMs'])
    if (!normalized || processingTimeMs === null) continue

    const metric = typeof rawStep['inputMetric'] === 'string' ? rawStep['inputMetric'] : null
    const inputValue = normalizeUnitValue(normalized.kind, metric, getFiniteNumber(rawStep['inputValue']))
    out.set(buildStepKey(normalized), {
      processingTimeMs,
      msPerUnit: getFiniteNumber(rawStep['msPerUnit']),
      unitValue: inputValue
    })
  }

  return out
}
const collectObservationsFromMetadata = (metadata: Record<string, unknown>): StepObservation[] => {
  const estimatedCostSteps = getEstimatedCostSteps(metadata)
  const actualCostSteps = getActualCostSteps(metadata)
  const timingSteps = getTimingActualSteps(metadata)
  const keys = new Set<string>([
    ...estimatedCostSteps.keys(),
    ...actualCostSteps.keys(),
    ...timingSteps.keys(),
  ])

  const out: StepObservation[] = []

  for (const key of keys) {
    const [kind, service, model] = key.split('::')
    if (!kind || !service || !model) continue

    const estimatedCost = estimatedCostSteps.get(key)
    const actualCost = actualCostSteps.get(key)
    const timing = timingSteps.get(key)
    const normalized = normalizeStepShape(kind, service, model)
    if (!normalized) continue

    out.push({
      kind: normalized.kind,
      service: normalized.service,
      model: normalized.model,
      estimatedCostCents: estimatedCost?.cost ?? null,
      rawEstimatedCostCents: estimatedCost?.rawCost ?? null,
      actualCostCents: actualCost?.cost ?? null,
      actualProcessingTimeMs: timing?.processingTimeMs ?? null,
      actualMsPerUnit: timing?.msPerUnit ?? null,
      unitValue: timing?.unitValue ?? actualCost?.unitValue ?? null,
    })
  }

  return out
}

const getModelEntry = (
  parsed: MutableJson,
  service: string,
  model: string
): MutableJson | null => {
  const serviceEntry = parsed[service]
  if (!isRecord(serviceEntry)) return null
  const models = serviceEntry['models']
  if (!isRecord(models)) return null
  const modelEntry = models[model]
  return isRecord(modelEntry) ? modelEntry : null
}

const readCurrentTimeValue = (modelEntry: MutableJson, fieldName: string): number | null => {
  const estimation = modelEntry['estimation']
  if (!isRecord(estimation)) return null
  return getFiniteNumber(estimation[fieldName])
}

const readCurrentCostMultiplier = (modelEntry: MutableJson): number | null => {
  const estimation = modelEntry['estimation']
  if (!isRecord(estimation)) return null
  return getFiniteNumber(estimation['costMultiplier'])
}

const getConfigFragmentFilenamePrefix = (kind: CalibrationKind): string | null => {
  switch (kind) {
    case 'stt':
      return MODEL_CONFIG_FRAGMENT_PREFIXES.stt
    case 'tts':
      return MODEL_CONFIG_FRAGMENT_PREFIXES.tts
    case 'extract':
    case 'llm':
    case 'image':
    case 'video':
    case 'music':
      return null
  }
}

const resolveCalibrationConfigFilePath = async (
  kind: CalibrationKind,
  configPath: string,
  service: string
): Promise<string | null> => {
  let isFile = false
  let isDirectory = false
  try {
    const pathStat = await stat(configPath)
    isFile = pathStat.isFile()
    isDirectory = pathStat.isDirectory()
  } catch {
    return null
  }

  if (isFile) {
    return configPath
  }

  if (!isDirectory) {
    return null
  }

  const fragmentFilenamePrefix = getConfigFragmentFilenamePrefix(kind)
  if (fragmentFilenamePrefix === null) {
    return null
  }

  return resolve(configPath, `${fragmentFilenamePrefix}-${service}.json`)
}

const unwrapCalibrationMetadata = (parsed: Record<string, unknown>): Record<string, unknown> => {
  const metadata = parsed['metadata']
  return isRecord(metadata) ? metadata : parsed
}

const collectJsonFiles = async (dir: string): Promise<string[]> => {
  let entries
  try {
    entries = await readdir(dir, { withFileTypes: true })
  } catch {
    return []
  }

  return entries
    .filter((entry) => entry.isFile() && entry.name.endsWith('.json'))
    .map((entry) => resolve(dir, entry.name))
}

const collectCalibrationManifestPaths = async (runDir: string): Promise<string[]> => {
  const [runManifests, metadataManifests] = await Promise.all([
    collectJsonFiles(resolve(runDir, 'run')),
    collectJsonFiles(resolve(runDir, 'metadata')),
  ])

  return [...runManifests, ...metadataManifests]
}

export const buildModelCalibrationReport = async (
  rootDir: string,
  configPaths: ConfigPaths = MODEL_CONFIG_PATHS
): Promise<CalibrationReport> => {
  const observations: StepObservation[] = []
  let runsScanned = 0
  let metadataFilesScanned = 0

  let runEntries
  try {
    runEntries = await readdir(rootDir, { withFileTypes: true })
  } catch {
    return {
      generatedAt: new Date().toISOString(),
      rootDir: resolve(rootDir),
      runsScanned,
      metadataFilesScanned,
      recommendedModels: 0,
      recommendations: [],
    }
  }

  for (const entry of runEntries) {
    if (!entry.isDirectory()) continue
    runsScanned += 1
    const manifestPaths = await collectCalibrationManifestPaths(resolve(rootDir, entry.name))

    for (const metadataPath of manifestPaths) {
      let parsed: unknown
      try {
        parsed = JSON.parse(await readFile(metadataPath, 'utf8')) as unknown
      } catch {
        continue
      }
      if (!isRecord(parsed)) continue

      metadataFilesScanned += 1
      observations.push(...collectObservationsFromMetadata(unwrapCalibrationMetadata(parsed)))
    }
  }

  const grouped = new Map<string, StepObservation[]>()
  for (const observation of observations) {
    const key = buildStepKey(observation)
    const list = grouped.get(key) ?? []
    list.push(observation)
    grouped.set(key, list)
  }

  const parsedConfigCache = new Map<string, MutableJson>()
  const recommendations: CalibrationRecommendation[] = []

  for (const [key, group] of grouped) {
    const [kind, service, model] = key.split('::')
    if (!kind || !service || !model) continue
    const calibrationKind = kind as CalibrationKind
    const configPath = configPaths[calibrationKind]
    if (!configPath) continue
    const configFilePath = await resolveCalibrationConfigFilePath(calibrationKind, configPath, service)
    if (!configFilePath) continue

    let parsedConfig = parsedConfigCache.get(configFilePath)
    if (!parsedConfig) {
      try {
        const raw = JSON.parse(await readFile(configFilePath, 'utf8')) as unknown
        if (!isRecord(raw)) continue
        parsedConfig = raw
        parsedConfigCache.set(configFilePath, parsedConfig)
      } catch {
        continue
      }
    }

    const modelEntry = getModelEntry(parsedConfig, service, model)
    if (!modelEntry) continue

    const costRatios = group
      .filter(obs => (obs.rawEstimatedCostCents ?? 0) > 0 && (obs.actualCostCents ?? 0) >= 0)
      .map(obs => (obs.actualCostCents as number) / (obs.rawEstimatedCostCents as number))
      .filter(value => Number.isFinite(value) && value > 0)

    const timeRates = group
      .map(obs => {
        if (obs.actualMsPerUnit !== null) return obs.actualMsPerUnit
        if (obs.actualProcessingTimeMs === null || obs.unitValue === null) return null
        return computeObservedTimeRate(obs.kind, obs.actualProcessingTimeMs, obs.unitValue)
      })
      .filter((value): value is number => value !== null && Number.isFinite(value) && value > 0)

    const medianCost = median(costRatios)
    const medianTime = median(timeRates)
    const oldCost = readCurrentCostMultiplier(modelEntry)
    const timeField = getTimeFieldName(calibrationKind)
    const oldTime = readCurrentTimeValue(modelEntry, timeField)

    let recommendedCost: number | null = null
    let recommendedTime: number | null = null

    if (medianCost !== null) {
      const next = roundCostMultiplier(smoothValue(oldCost, medianCost))
      const baseline = oldCost ?? 1
      const drift = Math.abs((next - baseline) / baseline)
      if (oldCost === null || drift >= COST_DRIFT_THRESHOLD) {
        recommendedCost = next
      }
    }

    if (medianTime !== null) {
      const next = roundTimeValue(smoothValue(oldTime, medianTime))
      const baseline = oldTime ?? medianTime
      const drift = baseline > 0 ? Math.abs((next - baseline) / baseline) : 1
      if (oldTime === null || drift >= TIME_DRIFT_THRESHOLD) {
        recommendedTime = next
      }
    }

    if (recommendedCost !== null || recommendedTime !== null) {
      const notes = recommendedTime !== null && timeRates.length > 0
        ? ['Timing calibration uses wall-clock latency observations.']
        : []
      recommendations.push({
        kind: calibrationKind,
        service,
        model,
        costSamples: costRatios.length,
        timeSamples: timeRates.length,
        oldCostMultiplier: oldCost,
        recommendedCostMultiplier: recommendedCost,
        medianCostMultiplier: medianCost,
        timeField,
        oldTimeValue: oldTime,
        recommendedTimeValue: recommendedTime,
        medianTimeValue: medianTime,
        ...(notes.length > 0 ? { notes } : {}),
      })
    }
  }

  return {
    generatedAt: new Date().toISOString(),
    rootDir: resolve(rootDir),
    runsScanned,
    metadataFilesScanned,
    recommendedModels: recommendations.length,
    recommendations,
  }
}
