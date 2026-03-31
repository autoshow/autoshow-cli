import { readdir, readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { MODEL_CONFIG_PATHS } from '~/cli/commands/models/model-loader'
import { parseDurationToSeconds } from '~/utils/pricing/compute-costs'
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
  unitValue: number | null
}

type CalibrationUpdate = {
  kind: CalibrationKind
  service: string
  model: string
  costSamples: number
  timeSamples: number
  oldCostMultiplier: number | null
  newCostMultiplier: number | null
  medianCostMultiplier: number | null
  timeField: string
  oldTimeValue: number | null
  newTimeValue: number | null
  medianTimeValue: number | null
}

export type CalibrationReport = {
  generatedAt: string
  rootDir: string
  runsScanned: number
  metadataFilesScanned: number
  updatedModels: number
  updates: CalibrationUpdate[]
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


const toRecordArray = (value: unknown): Record<string, unknown>[] => {
  if (Array.isArray(value)) {
    return value.filter(isRecord)
  }
  return isRecord(value) ? [value] : []
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

const getTimingActualSteps = (metadata: Record<string, unknown>): Map<string, { processingTimeMs: number, unitValue: number | null }> => {
  const timing = metadata['timing']
  if (!isRecord(timing)) return new Map()
  const actual = timing['actual']
  if (!isRecord(actual)) return new Map()
  const steps = Array.isArray(actual['steps']) ? actual['steps'] : []
  const out = new Map<string, { processingTimeMs: number, unitValue: number | null }>()

  for (const rawStep of steps) {
    if (!isRecord(rawStep)) continue
    const kind = typeof rawStep['step'] === 'string' ? rawStep['step'] : ''
    const service = typeof rawStep['provider'] === 'string' ? rawStep['provider'] : ''
    const model = typeof rawStep['model'] === 'string' ? rawStep['model'] : ''
    const normalized = normalizeStepShape(kind, service, model)
    const processingTimeMs = getFiniteNumber(rawStep['processingTimeMs'])
    if (!normalized || processingTimeMs === null) continue

    const metric = typeof rawStep['inputMetric'] === 'string' ? rawStep['inputMetric'] : null
    const inputValue = normalizeUnitValue(normalized.kind, metric, getFiniteNumber(rawStep['inputValue']))
    out.set(buildStepKey(normalized), { processingTimeMs, unitValue: inputValue })
  }

  return out
}

const getLegacyTimingSteps = (metadata: Record<string, unknown>): Map<string, { processingTimeMs: number, unitValue: number | null }> => {
  const out = new Map<string, { processingTimeMs: number, unitValue: number | null }>()
  const step1 = isRecord(metadata['step1']) ? metadata['step1'] : null
  const step2 = isRecord(metadata['step2']) ? metadata['step2'] : null
  const step3Raw = metadata['step3']
  const step4Entries = [
    ...toRecordArray(metadata['step4']),
    ...toRecordArray(metadata['tts'])
  ]
  const step5Entries = [
    ...toRecordArray(metadata['step5']),
    ...toRecordArray(metadata['image'])
  ]
  const step6 = isRecord(metadata['step6']) ? metadata['step6'] : isRecord(metadata['video']) ? metadata['video'] : null
  const step7 = isRecord(metadata['step7']) ? metadata['step7'] : isRecord(metadata['music']) ? metadata['music'] : null

  if (step2 && typeof step2['transcriptionService'] === 'string' && typeof step2['transcriptionModel'] === 'string') {
    const service = step2['transcriptionService']
    const model = typeof step2['transcriptionModelName'] === 'string'
      ? step2['transcriptionModelName']
      : step2['transcriptionModel']
    const normalized = normalizeStepShape('stt', service, model)
    const processingTimeMs = getFiniteNumber(step2['processingTime'])
    const duration = step1 && typeof step1['duration'] === 'string'
      ? parseDurationToSeconds(step1['duration'])
      : null
    if (normalized && processingTimeMs !== null) {
      out.set(buildStepKey(normalized), { processingTimeMs, unitValue: duration })
    }
  } else if (step2 && typeof step2['extractionMethod'] === 'string' && String(step2['extractionMethod']).includes('mistral-ocr') && typeof step2['ocrModel'] === 'string') {
    const normalized = normalizeStepShape('extract', 'mistral', step2['ocrModel'])
    const processingTimeMs = getFiniteNumber(step2['processingTime'])
    const pageCount = getFiniteNumber(step2['totalPages'])
    if (normalized && processingTimeMs !== null) {
      out.set(buildStepKey(normalized), { processingTimeMs, unitValue: pageCount })
    }
  }

  const step3Array = Array.isArray(step3Raw)
    ? step3Raw.filter(isRecord)
    : isRecord(step3Raw)
      ? [step3Raw]
      : []

  for (const step3 of step3Array) {
    if (typeof step3['llmService'] !== 'string' || typeof step3['llmModel'] !== 'string') continue
    const normalized = normalizeStepShape('llm', step3['llmService'], step3['llmModel'])
    const processingTimeMs = getFiniteNumber(step3['processingTime'])
    const tokenCount = (getFiniteNumber(step3['inputTokenCount']) ?? 0) + (getFiniteNumber(step3['outputTokenCount']) ?? 0)
    if (normalized && processingTimeMs !== null) {
      out.set(buildStepKey(normalized), { processingTimeMs, unitValue: tokenCount > 0 ? tokenCount : null })
    }
  }

  for (const step4 of step4Entries) {
    if (typeof step4['ttsService'] !== 'string' || typeof step4['ttsModel'] !== 'string') {
      continue
    }
    const normalized = normalizeStepShape('tts', step4['ttsService'], step4['ttsModel'])
    const processingTimeMs = getFiniteNumber(step4['processingTime'])
    if (normalized && processingTimeMs !== null) {
      out.set(buildStepKey(normalized), { processingTimeMs, unitValue: null })
    }
  }

  for (const step5 of step5Entries) {
    if (typeof step5['imageService'] !== 'string' || typeof step5['imageModel'] !== 'string') {
      continue
    }

    const normalized = normalizeStepShape('image', step5['imageService'], step5['imageModel'])
    const processingTimeMs = getFiniteNumber(step5['processingTime'])
    const imageCount = normalizeUnitValue('image', 'images', getFiniteNumber(step5['imageCount']))
    if (normalized && processingTimeMs !== null) {
      out.set(buildStepKey(normalized), { processingTimeMs, unitValue: imageCount })
    }
  }

  if (step6 && typeof step6['videoGenService'] === 'string' && typeof step6['videoGenModel'] === 'string') {
    const normalized = normalizeStepShape('video', step6['videoGenService'], step6['videoGenModel'])
    const processingTimeMs = getFiniteNumber(step6['processingTime'])
    const durationSeconds = normalizeUnitValue('video', 'durationSeconds', getFiniteNumber(step6['videoDuration']))
    if (normalized && processingTimeMs !== null) {
      out.set(buildStepKey(normalized), { processingTimeMs, unitValue: durationSeconds })
    }
  }

  if (step7 && typeof step7['musicService'] === 'string' && typeof step7['musicModel'] === 'string') {
    const normalized = normalizeStepShape('music', step7['musicService'], step7['musicModel'])
    const processingTimeMs = getFiniteNumber(step7['processingTime'])
    const durationSeconds = normalizeUnitValue('music', 'durationMs', getFiniteNumber(step7['musicDurationMs']))
    if (normalized && processingTimeMs !== null) {
      out.set(buildStepKey(normalized), { processingTimeMs, unitValue: durationSeconds })
    }
  }

  return out
}

const collectObservationsFromMetadata = (metadata: Record<string, unknown>): StepObservation[] => {
  const estimatedCostSteps = getEstimatedCostSteps(metadata)
  const actualCostSteps = getActualCostSteps(metadata)
  const timingSteps = getTimingActualSteps(metadata)
  const legacyTimingSteps = timingSteps.size > 0 ? timingSteps : getLegacyTimingSteps(metadata)
  const keys = new Set<string>([
    ...estimatedCostSteps.keys(),
    ...actualCostSteps.keys(),
    ...legacyTimingSteps.keys(),
  ])

  const out: StepObservation[] = []

  for (const key of keys) {
    const [kind, service, model] = key.split('::')
    if (!kind || !service || !model) continue

    const estimatedCost = estimatedCostSteps.get(key)
    const actualCost = actualCostSteps.get(key)
    const timing = legacyTimingSteps.get(key)
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

const setEstimationValue = (modelEntry: MutableJson, fieldName: string, value: number): void => {
  const estimationRaw = modelEntry['estimation']
  const estimation = isRecord(estimationRaw) ? estimationRaw : {}
  estimation[fieldName] = value
  modelEntry['estimation'] = estimation
}

export const applyModelConfigCalibrations = async (
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
      updatedModels: 0,
      updates: [],
    }
  }

  for (const entry of runEntries) {
    if (!entry.isDirectory()) continue
    runsScanned += 1
    const metadataDir = resolve(rootDir, entry.name, 'metadata')
    let metadataEntries
    try {
      metadataEntries = await readdir(metadataDir, { withFileTypes: true })
    } catch {
      continue
    }

    for (const metadataEntry of metadataEntries) {
      if (!metadataEntry.isFile() || !metadataEntry.name.endsWith('.json')) continue
      const metadataPath = resolve(metadataDir, metadataEntry.name)
      let parsed: unknown
      try {
        parsed = JSON.parse(await readFile(metadataPath, 'utf8')) as unknown
      } catch {
        continue
      }
      if (!isRecord(parsed)) continue

      metadataFilesScanned += 1
      observations.push(...collectObservationsFromMetadata(parsed))
    }
  }

  const grouped = new Map<string, StepObservation[]>()
  for (const observation of observations) {
    const key = buildStepKey(observation)
    const list = grouped.get(key) ?? []
    list.push(observation)
    grouped.set(key, list)
  }

  const parsedConfigCache = new Map<CalibrationKind, MutableJson>()
  const changedKinds = new Set<CalibrationKind>()
  const updates: CalibrationUpdate[] = []

  for (const [key, group] of grouped) {
    const [kind, service, model] = key.split('::')
    if (!kind || !service || !model) continue
    const configPath = configPaths[kind as CalibrationKind]
    if (!configPath) continue

    let parsedConfig = parsedConfigCache.get(kind as CalibrationKind)
    if (!parsedConfig) {
      try {
        const raw = JSON.parse(await readFile(configPath, 'utf8')) as unknown
        if (!isRecord(raw)) continue
        parsedConfig = raw
        parsedConfigCache.set(kind as CalibrationKind, parsedConfig)
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
        if (obs.actualProcessingTimeMs === null || obs.unitValue === null) return null
        return computeObservedTimeRate(obs.kind, obs.actualProcessingTimeMs, obs.unitValue)
      })
      .filter((value): value is number => value !== null && Number.isFinite(value) && value > 0)

    const medianCost = median(costRatios)
    const medianTime = median(timeRates)
    const oldCost = readCurrentCostMultiplier(modelEntry)
    const timeField = getTimeFieldName(kind as CalibrationKind)
    const oldTime = readCurrentTimeValue(modelEntry, timeField)

    let newCost: number | null = null
    let newTime: number | null = null

    if (medianCost !== null) {
      const next = roundCostMultiplier(smoothValue(oldCost, medianCost))
      const baseline = oldCost ?? 1
      const drift = Math.abs((next - baseline) / baseline)
      if (oldCost === null || drift >= COST_DRIFT_THRESHOLD) {
        setEstimationValue(modelEntry, 'costMultiplier', next)
        newCost = next
      }
    }

    if (medianTime !== null) {
      const next = roundTimeValue(smoothValue(oldTime, medianTime))
      const baseline = oldTime ?? medianTime
      const drift = baseline > 0 ? Math.abs((next - baseline) / baseline) : 1
      if (oldTime === null || drift >= TIME_DRIFT_THRESHOLD) {
        setEstimationValue(modelEntry, timeField, next)
        newTime = next
      }
    }

    if (newCost !== null || newTime !== null) {
      changedKinds.add(kind as CalibrationKind)
      updates.push({
        kind: kind as CalibrationKind,
        service,
        model,
        costSamples: costRatios.length,
        timeSamples: timeRates.length,
        oldCostMultiplier: oldCost,
        newCostMultiplier: newCost,
        medianCostMultiplier: medianCost,
        timeField,
        oldTimeValue: oldTime,
        newTimeValue: newTime,
        medianTimeValue: medianTime,
      })
    }
  }

  for (const kind of changedKinds) {
    const parsedConfig = parsedConfigCache.get(kind)
    const configPath = configPaths[kind]
    if (!parsedConfig || !configPath) continue
    await writeFile(configPath, `${JSON.stringify(parsedConfig, null, 2)}\n`)
  }

  return {
    generatedAt: new Date().toISOString(),
    rootDir: resolve(rootDir),
    runsScanned,
    metadataFilesScanned,
    updatedModels: updates.length,
    updates,
  }
}
