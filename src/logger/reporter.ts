import type { AggregatedPriceEstimate, StepEstimate } from '~/utils/pricing/aggregate-pricing'
import { assertNever } from '~/utils/validate/assert-never'
import { formatCost, formatDuration } from '~/logger/formatters'
import { createHumanTable, logLocationsTable, toHumanTableCell } from '~/logger/human-table'
import { emitResult } from '~/logger/result-emitter'
import type { HumanLogTable, HumanLogTableRow, Logger } from '~/logger/types'

export type StepTimingCost = {
  label: string
  providerModel?: string
  processingTime: number
  cost: number
}

export type ReporterMetricValue = string | number | boolean | null

export type HumanCompletionSection = keyof HumanCompletionTables

export type CompleteOptions = {
  metrics?: Record<string, ReporterMetricValue>
  steps?: StepTimingCost[]
  totalTimeMs?: number
  totalCost?: number
  summaryMessage?: string
  hideHumanSections?: readonly HumanCompletionSection[]
}

export type Reporter = {
  expectedOutput: (outputDir: string, files: string[]) => void
  estimate: (estimate: AggregatedPriceEstimate) => void
  complete: (outputDir: string, files: Record<string, string>, options?: CompleteOptions) => void
}

const formatSttProvider = (provider: string): string => {
  return provider === 'whisper' ? 'whisper.cpp' : provider
}

type EstimateMode = 'human' | 'raw'

const costField = (mode: EstimateMode, cents: number): string | number =>
  mode === 'human' ? formatCost(cents) : cents

const costKey = (mode: EstimateMode): string =>
  mode === 'human' ? 'cost' : 'totalCostCents'

const mapStepEstimate = (estimate: StepEstimate, mode: EstimateMode): Record<string, string | number> => {
  const base = { step: estimate.step, provider: estimate.provider, model: estimate.model }

  switch (estimate.step) {
    case 'stt':
      return { ...base, provider: formatSttProvider(estimate.provider), [costKey(mode)]: costField(mode, estimate.totalCost) }
    case 'llm': {
      const entry: Record<string, string | number> = { ...base }
      if (mode === 'human') {
        entry['inputRate'] = `${estimate.inputCostPer1MCents.toFixed(2)}¢/1M`
        entry['outputRate'] = `${estimate.outputCostPer1MCents.toFixed(2)}¢/1M`
      } else {
        entry['inputCostPer1MCents'] = estimate.inputCostPer1MCents
        entry['outputCostPer1MCents'] = estimate.outputCostPer1MCents
      }
      if (typeof estimate.estimatedInputTokens === 'number') entry['estInputTokens'] = estimate.estimatedInputTokens
      if (typeof estimate.estimatedOutputTokens === 'number') entry['estOutputTokens'] = estimate.estimatedOutputTokens
      entry[costKey(mode)] = costField(mode, estimate.totalCost)
      return entry
    }
    case 'extract': {
      const entry: Record<string, string | number> = { ...base }
      if (mode === 'human') {
        if (typeof estimate.costPer1kPagesCents === 'number') {
          entry['rate'] = `${estimate.costPer1kPagesCents.toFixed(4)}¢/1K pages`
        } else if (typeof estimate.inputCostPer1MCents === 'number' && typeof estimate.outputCostPer1MCents === 'number') {
          entry['inputRate'] = `${estimate.inputCostPer1MCents.toFixed(2)}¢/1M`
          entry['outputRate'] = `${estimate.outputCostPer1MCents.toFixed(2)}¢/1M`
        }
      } else {
        if (typeof estimate.costPer1kPagesCents === 'number') entry['costPer1kPagesCents'] = estimate.costPer1kPagesCents
        if (typeof estimate.inputCostPer1MCents === 'number') entry['inputCostPer1MCents'] = estimate.inputCostPer1MCents
        if (typeof estimate.outputCostPer1MCents === 'number') entry['outputCostPer1MCents'] = estimate.outputCostPer1MCents
      }
      if (typeof estimate.pageCount === 'number') entry['pages'] = estimate.pageCount
      if (typeof estimate.promptTokens === 'number') entry['promptTokens'] = estimate.promptTokens
      if (typeof estimate.completionTokens === 'number') entry['completionTokens'] = estimate.completionTokens
      if (typeof estimate.estimateType === 'string') entry['estimateType'] = estimate.estimateType
      if (mode === 'human' && estimate.note) entry['note'] = estimate.note
      entry[costKey(mode)] = costField(mode, estimate.totalCost)
      return entry
    }
    case 'tts': {
      const entry: Record<string, string | number> = { ...base }
      if (mode === 'human') {
        if (typeof estimate.inputCostPer1MCharactersCents === 'number' && typeof estimate.outputCostPer1MCharactersCents === 'number') {
          entry['inputRate'] = `${estimate.inputCostPer1MCharactersCents.toFixed(2)}¢/1M chars`
          entry['outputRate'] = `${estimate.outputCostPer1MCharactersCents.toFixed(2)}¢/1M chars`
        } else if (typeof estimate.costPer1kCharactersCents === 'number') {
          entry['rate'] = `${estimate.costPer1kCharactersCents.toFixed(4)}¢/1K chars`
        }
      }
      if (typeof estimate.characterCount === 'number') entry['characters'] = estimate.characterCount
      entry[costKey(mode)] = costField(mode, estimate.totalCost)
      return entry
    }
    case 'image':
      return { ...base, [costKey(mode)]: costField(mode, estimate.totalCost) }
    case 'video':
      return { ...base, [costKey(mode)]: costField(mode, estimate.totalCost) }
    case 'music': {
      const entry: Record<string, string | number> = { ...base }
      if (mode === 'human') entry['lyrics'] = estimate.lyricsSource
      entry[costKey(mode)] = costField(mode, estimate.totalCost)
      if (mode === 'human' && estimate.note) entry['note'] = estimate.note
      return entry
    }
    default:
      assertNever(estimate)
  }
}

type StepSummaryEntry = {
  step: string
  providerModel?: string
  time: string
  cost: string
}

export type HumanCompletionTables = {
  artifacts?: HumanLogTable
  providers?: HumanLogTable
  metrics?: HumanLogTable
  timing?: HumanLogTable
}

const collectColumns = (rows: ReadonlyArray<Record<string, unknown>>): string[] => {
  const columns: string[] = []
  for (const row of rows) {
    for (const key of Object.keys(row)) {
      if (!columns.includes(key)) {
        columns.push(key)
      }
    }
  }
  return columns
}

const formatStepSummary = (steps: StepTimingCost[], totalTimeMs: number, totalCost: number) => {
  const entries: StepSummaryEntry[] = steps.map(step => ({
    step: step.label,
    ...(step.providerModel ? { providerModel: step.providerModel } : {}),
    time: formatDuration(step.processingTime),
    cost: formatCost(step.cost)
  }))
  return {
    steps: entries,
    total: {
      step: 'Total',
      providerModel: '',
      time: formatDuration(totalTimeMs),
      cost: formatCost(totalCost)
    } satisfies StepSummaryEntry
  }
}

const buildHumanArtifactRows = (
  outputDir: string,
  files: Record<string, string>
): HumanLogTableRow[] =>
  Object.entries(files)
    .filter(([, file]) => !file.startsWith('providers/'))
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([artifact, file]) => ({
      artifact,
      path: `${outputDir}/${file}`
    }))

const buildHumanProviderRows = (
  outputDir: string,
  files: Record<string, string>
): HumanLogTableRow[] => {
  const providerFiles = Object.entries(files).filter(([, file]) => file.startsWith('providers/'))
  if (providerFiles.length === 0) {
    return []
  }

  return [{
    dir: `${outputDir}/providers`,
    transcripts: providerFiles.filter(([key]) => key.startsWith('transcript-')).length,
    results: providerFiles.filter(([key]) => key.startsWith('result-')).length
  }]
}

const buildMetricRows = (
  metrics: Record<string, ReporterMetricValue>
): HumanLogTableRow[] =>
  Object.entries(metrics).map(([metric, value]) => ({
    metric,
    value: toHumanTableCell(value)
  }))

const buildTimingRows = (
  steps: StepTimingCost[],
  totalTimeMs: number,
  totalCost: number
): HumanLogTableRow[] => {
  const { steps: summarySteps, total } = formatStepSummary(steps, totalTimeMs, totalCost)
  return [...summarySteps, total].map((entry) => ({
    step: entry.step,
    providerModel: entry.providerModel ?? '',
    time: entry.time,
    cost: entry.cost
  }))
}

export const buildHumanCompletionTables = (
  outputDir: string,
  files: Record<string, string>,
  options?: CompleteOptions
): HumanCompletionTables => {
  const artifactRows = buildHumanArtifactRows(outputDir, files)
  const providerRows = buildHumanProviderRows(outputDir, files)
  const metricRows = options?.metrics ? buildMetricRows(options.metrics) : []
  const timingRows = options?.steps !== undefined && options.totalTimeMs !== undefined && options.totalCost !== undefined
    ? buildTimingRows(options.steps, options.totalTimeMs, options.totalCost)
    : []

  return {
    ...(artifactRows.length > 0 ? { artifacts: createHumanTable(artifactRows, ['artifact', 'path']) } : {}),
    ...(providerRows.length > 0 ? { providers: createHumanTable(providerRows, ['dir', 'transcripts', 'results']) } : {}),
    ...(metricRows.length > 0 ? { metrics: createHumanTable(metricRows, ['metric', 'value']) } : {}),
    ...(timingRows.length > 0 ? { timing: createHumanTable(timingRows, ['step', 'providerModel', 'time', 'cost']) } : {})
  }
}

const buildEstimateRows = (estimate: AggregatedPriceEstimate): HumanLogTableRow[] =>
  estimate.steps.map((step) =>
    Object.fromEntries(
      Object.entries(mapStepEstimate(step, 'human')).map(([key, value]) => [key, toHumanTableCell(value)])
    ) as HumanLogTableRow
  )

export const buildCompleteResultData = (
  outputDir: string,
  files: Record<string, string>,
  options?: CompleteOptions
): Record<string, unknown> => {
  const resultData: Record<string, unknown> = {
    dryRun: false,
    outputDir,
    files: Object.fromEntries(
      Object.entries(files).map(([key, name]) => [key, `${outputDir}/${name}`])
    )
  }
  if (options?.steps !== undefined && options.totalTimeMs !== undefined && options.totalCost !== undefined) {
    resultData['timing'] = {
      totalMs: options.totalTimeMs,
      steps: options.steps.map(s => ({
        label: s.label,
        ...(s.providerModel ? { providerModel: s.providerModel } : {}),
        processingTimeMs: s.processingTime,
        costCents: s.cost
      })),
      totalCostCents: options.totalCost
    }
  }
  if (options?.metrics !== undefined) {
    resultData['metrics'] = options.metrics
  }
  return resultData
}

export const createReporter = (logger: Logger): Reporter => {
  return {
    expectedOutput: (outputDir, files) => {
      logger.write('info', `Expected output directory: ${outputDir}`, { category: 'command' })
      logger.write('info', 'Expected files', {
        category: 'command',
        humanTable: createHumanTable(files.map(file => ({ file })), ['file'])
      })
    },
    estimate: (estimate) => {
      const estimateRows = buildEstimateRows(estimate)
      logger.write('info', `Total estimated cost: ${formatCost(estimate.totalEstimatedCost)}`, { category: 'pricing' })
      logger.write('info', 'Cost Estimate', {
        category: 'pricing',
        humanTable: createHumanTable(estimateRows, collectColumns(estimateRows))
      })
      if (estimate.notes && estimate.notes.length > 0) {
        for (const note of estimate.notes) {
          logger.write('info', `Note: ${note}`, { category: 'pricing' })
        }
      }

      emitResult({
        dryRun: true,
        estimate: {
          steps: estimate.steps.map(s => mapStepEstimate(s, 'raw')),
          totalEstimatedCostCents: estimate.totalEstimatedCost,
          ...(estimate.notes && estimate.notes.length > 0 ? { notes: estimate.notes } : {})
        }
      })
    },
    complete: (outputDir, files, options) => {
      logLocationsTable(logger, [{ artifact: 'outputDir', path: outputDir }], { category: 'artifact' })
      logger.write('success', options?.summaryMessage ?? 'Complete!', { category: 'artifact' })
      const tables = buildHumanCompletionTables(outputDir, files, options)
      const hiddenSections = new Set(options?.hideHumanSections ?? [])
      if (tables.artifacts && !hiddenSections.has('artifacts')) {
        logger.write('info', 'Artifacts', { category: 'artifact', humanTable: tables.artifacts })
      }
      if (tables.providers && !hiddenSections.has('providers')) {
        logger.write('info', 'Providers', { category: 'artifact', humanTable: tables.providers })
      }
      if (tables.metrics && !hiddenSections.has('metrics')) {
        logger.write('info', 'Metrics', { category: 'artifact', humanTable: tables.metrics })
      }
      if (tables.timing && !hiddenSections.has('timing')) {
        logger.write('info', 'Timing', { category: 'artifact', humanTable: tables.timing })
      }

      emitResult(buildCompleteResultData(outputDir, files, options))
    }
  }
}
