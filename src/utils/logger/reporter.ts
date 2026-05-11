import { basename } from 'node:path'
import { assertNever } from '~/utils/validate/assert-never'
import { formatCost, formatDuration, formatEstimatedCost, formatEstimatedCostWithExactCents } from '~/utils/logger/formatters'
import { createHumanTable, logLocationsTable, toHumanTableCell } from '~/utils/logger/human-table'
import { emitResult } from '~/utils/logger/result-emitter'
import { resolveReverbModelLabel } from '~/cli/commands/process-steps/step-2-extract/step-2-stt/stt-model-labels'
import type {
  AggregatedPriceEstimate,
  CompleteOptions,
  EstimateMode,
  HumanCompletionTables,
  HumanLogTableRow,
  Logger,
  Reporter,
  ReporterMetricValue,
  StepEstimate,
  StepSummaryEntry,
  StepTimingCost,
  TimingStepEntry
} from '~/types'

const formatSttProvider = (provider: string): string => {
  return provider === 'whisper' ? 'whisper.cpp' : provider
}

const costField = (mode: EstimateMode, cents: number): string | number =>
  mode === 'human' ? formatEstimatedCost(cents) : cents

const costKey = (mode: EstimateMode): string =>
  mode === 'human' ? 'cost' : 'totalCostCents'

const mapStepEstimate = (estimate: StepEstimate, mode: EstimateMode): Record<string, string | number> => {
  const base = { step: estimate.step, provider: estimate.provider, model: estimate.model }

  switch (estimate.step) {
    case 'stt': {
      const entry: Record<string, string | number> = {
        ...base,
        provider: formatSttProvider(estimate.provider),
        model: estimate.provider === 'reverb' ? resolveReverbModelLabel(estimate.model) : estimate.model,
        [costKey(mode)]: costField(mode, estimate.totalCost)
      }
      return entry
    }
    case 'llm': {
      const entry: Record<string, string | number> = { ...base }
      if (mode === 'human') {
        entry['inputRate'] = `${formatEstimatedCost(estimate.inputCostPer1MCents)}/1M`
        entry['outputRate'] = `${formatEstimatedCost(estimate.outputCostPer1MCents)}/1M`
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
          entry['rate'] = `${formatEstimatedCost(estimate.costPer1kPagesCents)}/1K pages`
        } else if (typeof estimate.costPer1kOutputCharsCents === 'number') {
          entry['rate'] = `${formatEstimatedCost(estimate.costPer1kOutputCharsCents)}/1K output chars`
        } else if (typeof estimate.inputCostPer1MCents === 'number' && typeof estimate.outputCostPer1MCents === 'number') {
          entry['inputRate'] = `${formatEstimatedCost(estimate.inputCostPer1MCents)}/1M`
          entry['outputRate'] = `${formatEstimatedCost(estimate.outputCostPer1MCents)}/1M`
        }
      } else {
        if (typeof estimate.costPer1kPagesCents === 'number') entry['costPer1kPagesCents'] = estimate.costPer1kPagesCents
        if (typeof estimate.costPer1kOutputCharsCents === 'number') entry['costPer1kOutputCharsCents'] = estimate.costPer1kOutputCharsCents
        if (typeof estimate.inputCostPer1MCents === 'number') entry['inputCostPer1MCents'] = estimate.inputCostPer1MCents
        if (typeof estimate.outputCostPer1MCents === 'number') entry['outputCostPer1MCents'] = estimate.outputCostPer1MCents
      }
      if (typeof estimate.pageCount === 'number') entry['pages'] = estimate.pageCount
      if (typeof estimate.estimatedOutputChars === 'number') entry['estOutputChars'] = estimate.estimatedOutputChars
      if (typeof estimate.promptTokens === 'number') entry['promptTokens'] = estimate.promptTokens
      if (typeof estimate.completionTokens === 'number') entry['completionTokens'] = estimate.completionTokens
      if (typeof estimate.estimateType === 'string') entry['estimateType'] = estimate.estimateType
      entry[costKey(mode)] = costField(mode, estimate.totalCost)
      return entry
    }
    case 'tts': {
      const entry: Record<string, string | number> = { ...base }
      if (mode === 'human') {
        if (typeof estimate.inputCostPer1MCharactersCents === 'number' && typeof estimate.outputCostPer1MCharactersCents === 'number') {
          entry['inputRate'] = `${formatEstimatedCost(estimate.inputCostPer1MCharactersCents)}/1M chars`
          entry['outputRate'] = `${formatEstimatedCost(estimate.outputCostPer1MCharactersCents)}/1M chars`
        } else if (typeof estimate.costPer1kCharactersCents === 'number') {
          entry['rate'] = `${formatEstimatedCost(estimate.costPer1kCharactersCents)}/1K chars`
        }
      }
      if (typeof estimate.characterCount === 'number') entry['characters'] = estimate.characterCount
      if (typeof estimate.setupCostCents === 'number') {
        if (mode === 'human') entry['setup'] = formatEstimatedCost(estimate.setupCostCents)
        else entry['setupCostCents'] = estimate.setupCostCents
      }
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
      return entry
    }
    default:
      assertNever(estimate)
  }
}

const mapTimingEstimate = (timing: TimingStepEntry): Record<string, string | number> => ({
  step: timing.step,
  provider: timing.provider,
  model: timing.model,
  ...(typeof timing.inputMetric === 'string' && typeof timing.inputValue === 'number'
    ? { input: `${timing.inputValue} ${timing.inputMetric}` }
    : {}),
  estimatedTime: formatDuration(timing.processingTimeMs)
})

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
  files: Record<string, string>
): HumanLogTableRow[] =>
  Object.entries(files)
    .filter(([, file]) => !file.startsWith('providers/'))
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([artifact, file]) => ({
      artifact,
      path: basename(file)
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

const buildHumanCompletionTables = (
  outputDir: string,
  files: Record<string, string>,
  options?: CompleteOptions
): HumanCompletionTables => {
  const artifactRows = buildHumanArtifactRows(files)
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

const formatRate = (amount: number, unit: string): string =>
  `${formatEstimatedCost(amount)}/${unit}`

const buildEstimateDetails = (estimate: StepEstimate): string => {
  const details: string[] = []

  switch (estimate.step) {
    case 'stt':
      details.push(`duration ${estimate.durationSeconds}s`)
      if (typeof estimate.estimateType === 'string') details.push(`type ${estimate.estimateType}`)
      break
    case 'llm':
      details.push(`input ${formatRate(estimate.inputCostPer1MCents, '1M')}`)
      details.push(`output ${formatRate(estimate.outputCostPer1MCents, '1M')}`)
      if (typeof estimate.estimatedInputTokens === 'number') details.push(`est input ${estimate.estimatedInputTokens} tokens`)
      if (typeof estimate.estimatedOutputTokens === 'number') details.push(`est output ${estimate.estimatedOutputTokens} tokens`)
      break
    case 'extract':
      if (typeof estimate.costPer1kPagesCents === 'number') {
        details.push(`rate ${formatRate(estimate.costPer1kPagesCents, '1K pages')}`)
      } else if (typeof estimate.costPer1kOutputCharsCents === 'number') {
        details.push(`rate ${formatRate(estimate.costPer1kOutputCharsCents, '1K output chars')}`)
      } else if (typeof estimate.inputCostPer1MCents === 'number' && typeof estimate.outputCostPer1MCents === 'number') {
        details.push(`input ${formatRate(estimate.inputCostPer1MCents, '1M')}`)
        details.push(`output ${formatRate(estimate.outputCostPer1MCents, '1M')}`)
      }
      if (typeof estimate.pageCount === 'number') details.push(`pages ${estimate.pageCount}`)
      if (typeof estimate.estimatedOutputChars === 'number') details.push(`est output ${estimate.estimatedOutputChars} chars`)
      if (typeof estimate.promptTokens === 'number') details.push(`prompt ${estimate.promptTokens} tokens`)
      if (typeof estimate.completionTokens === 'number') details.push(`completion ${estimate.completionTokens} tokens`)
      if (typeof estimate.estimateType === 'string') details.push(`type ${estimate.estimateType}`)
      break
    case 'tts':
      if (typeof estimate.inputCostPer1MCharactersCents === 'number' && typeof estimate.outputCostPer1MCharactersCents === 'number') {
        details.push(`input ${formatRate(estimate.inputCostPer1MCharactersCents, '1M chars')}`)
        details.push(`output ${formatRate(estimate.outputCostPer1MCharactersCents, '1M chars')}`)
      } else if (typeof estimate.costPer1kCharactersCents === 'number') {
        details.push(`rate ${formatRate(estimate.costPer1kCharactersCents, '1K chars')}`)
      }
      if (typeof estimate.characterCount === 'number') details.push(`characters ${estimate.characterCount}`)
      if (typeof estimate.setupCostCents === 'number') details.push(`setup ${formatEstimatedCost(estimate.setupCostCents)}`)
      if (typeof estimate.estimateType === 'string') details.push(`type ${estimate.estimateType}`)
      break
    case 'image':
    case 'video':
      break
    case 'music':
      details.push(`lyrics ${estimate.lyricsSource}`)
      break
    default:
      assertNever(estimate)
  }

  return details.join(', ')
}

const buildHumanEstimateRows = (
  estimate: AggregatedPriceEstimate
): HumanLogTableRow[] =>
  estimate.steps.map((step) => {
    const details = buildEstimateDetails(step)
    return {
      step: step.step,
      provider: step.step === 'stt' ? formatSttProvider(step.provider) : step.provider,
      model: step.step === 'stt' && step.provider === 'reverb'
        ? resolveReverbModelLabel(step.model)
        : step.model,
      ...(details.length > 0 ? { details } : {}),
      cost: formatEstimatedCost(step.totalCost)
    }
  })

const buildHumanEstimateTable = (
  rows: readonly HumanLogTableRow[]
) => {
  const columns = [
    'step',
    'provider',
    'model',
    ...(rows.some(row => row['details'] !== undefined) ? ['details'] : []),
    'cost'
  ]

  return createHumanTable(rows, columns, { align: { cost: 'right' } })
}

const buildCompleteResultData = (
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
    expectedOutput: (_outputDir, files) => {
      logger.write('info', 'Expected files', {
        category: 'command',
        humanTable: createHumanTable(files.map(file => ({ file })), ['file'])
      })
    },
    estimate: (estimate) => {
      const estimateRows = buildHumanEstimateRows(estimate)

      logger.write('info', `Total estimated cost: ${formatEstimatedCostWithExactCents(estimate.totalEstimatedCost)}`, { category: 'pricing' })
      logger.write('info', 'Cost Estimate', {
        category: 'pricing',
        humanTable: buildHumanEstimateTable(estimateRows)
      })
      if (estimate.timing && estimate.timing.steps.length > 0) {
        logger.write('info', `Total estimated processing time: ${formatDuration(estimate.timing.totalProcessingTimeMs)}`, { category: 'pricing' })
        logger.write('info', 'Processing Time Estimate', {
          category: 'pricing',
          humanTable: createHumanTable(estimate.timing.steps.map(mapTimingEstimate), ['step', 'provider', 'model', 'input', 'estimatedTime'])
        })
      }

      emitResult({
        dryRun: true,
        estimate: {
          steps: estimate.steps.map(s => mapStepEstimate(s, 'raw')),
          totalEstimatedCostCents: estimate.totalEstimatedCost,
          ...(estimate.timing ? { timing: estimate.timing } : {})
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
