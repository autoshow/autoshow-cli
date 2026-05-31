import { l } from '~/utils/logger'
import { formatCost, formatDuration } from '~/utils/logger/formatters'
import { createHumanTable, createKeyValueTable } from '~/utils/logger/human-table'
import { resolveExtractionProviderModel } from '~/utils/extraction-provider-model'
import { resolveReverbModelLabel } from './step-2-extract/step-2-stt/stt-model-labels'
import type {
  ActualCostBreakdown,
  EstimatedCostBreakdown,
  ExtractionMetadata,
  Logger,
  OcrCostCalculationRow,
  OcrCostCalculationSection,
  Step2Metadata,
  Step3Metadata,
  Step4Metadata,
  Step5Metadata,
  Step6VideoMetadata,
  Step7MusicMetadata,
  CostSource,
  CostEntryLike,
  IndexedRow,
  PromptUsageSection,
  SummaryBaseRow,
  SummarySection,
  TimingEntryLike,
  WriteManifestConsoleSummary,
  WriteManifestMetadata,
  WriteManifestSourceRefs,
  WritePromptUsageRow,
  WriteRunSummaryRow,
  WriteStepKind,
} from '~/types'

const SUMMARY_COLUMNS = ['step', 'providerModel', 'predCost', 'actCost', 'actSource', 'predTime', 'actTime', 'predSpeed', 'actSpeed'] as const
const PROMPT_USAGE_COLUMNS = ['step', 'providerModel', 'promptSource', 'usage'] as const
const OCR_COST_COLUMNS = ['providerModel', 'pages', 'predInputs', 'actInputs', 'rates', 'predCost', 'actCost', 'delta'] as const
const WHISPER_MODEL_PATH_PATTERN = /ggml-([a-z0-9.-]+)\.bin/i

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const isStep2Metadata = (value: unknown): value is Step2Metadata =>
  isRecord(value)
  && typeof value['transcriptionService'] === 'string'
  && typeof value['transcriptionModel'] === 'string'

const isExtractionMetadata = (value: unknown): value is ExtractionMetadata =>
  isRecord(value)
  && typeof value['extractionMethod'] === 'string'
  && typeof value['processingTime'] === 'number'

const isStep3Metadata = (value: unknown): value is Step3Metadata =>
  isRecord(value)
  && typeof value['llmService'] === 'string'
  && typeof value['llmModel'] === 'string'

const isStep4Metadata = (value: unknown): value is Step4Metadata =>
  isRecord(value)
  && typeof value['ttsService'] === 'string'
  && typeof value['ttsModel'] === 'string'

const isStep5Metadata = (value: unknown): value is Step5Metadata =>
  isRecord(value)
  && typeof value['imageService'] === 'string'
  && typeof value['imageModel'] === 'string'

const isStep6Metadata = (value: unknown): value is Step6VideoMetadata =>
  isRecord(value)
  && typeof value['videoGenService'] === 'string'
  && typeof value['videoGenModel'] === 'string'

const isStep7Metadata = (value: unknown): value is Step7MusicMetadata =>
  isRecord(value)
  && typeof value['musicService'] === 'string'
  && typeof value['musicModel'] === 'string'

const isCostEntry = (value: unknown): value is CostEntryLike =>
  isRecord(value)
  && typeof value['step'] === 'string'
  && typeof value['provider'] === 'string'
  && typeof value['model'] === 'string'
  && typeof value['cost'] === 'number'

const isTimingEntry = (value: unknown): value is TimingEntryLike =>
  isRecord(value)
  && typeof value['step'] === 'string'
  && typeof value['provider'] === 'string'
  && typeof value['model'] === 'string'
  && typeof value['processingTimeMs'] === 'number'

const COST_SOURCES = new Set<CostSource>([
  'provider_usage',
  'provider_quote',
  'response_header',
  'computed_usage',
  'registry_fallback',
  'heuristic',
  'local_zero'
])

const normalizeManifestCostSource = (value: unknown): CostSource =>
  typeof value === 'string' && COST_SOURCES.has(value as CostSource)
    ? value as CostSource
    : 'registry_fallback'

const toArray = <T,>(value: unknown, guard: (candidate: unknown) => candidate is T): T[] => {
  if (Array.isArray(value)) {
    return value.filter(guard)
  }

  return guard(value) ? [value] : []
}

const trimTrailingZeroes = (value: string): string =>
  value.replace(/\.0+($|[^0-9])/, '$1').replace(/(\.\d*?)0+($|[^0-9])/, '$1$2')

const formatNumber = (value: number): string => {
  if (value >= 100) {
    return value.toFixed(0)
  }
  if (value >= 10) {
    return trimTrailingZeroes(value.toFixed(1))
  }
  return trimTrailingZeroes(value.toFixed(2))
}

const formatCount = (value: number, singular: string, plural: string): string => {
  const rounded = Number.isInteger(value) ? value.toFixed(0) : trimTrailingZeroes(value.toFixed(1))
  return `${rounded} ${value === 1 ? singular : plural}`
}

const formatTokenCount = (value: number): string => {
  const rounded = Number.isInteger(value) ? value.toFixed(0) : trimTrailingZeroes(value.toFixed(1))
  return `${rounded} tok`
}

const formatSecondsShort = (value: number): string =>
  `${trimTrailingZeroes(value.toFixed(value >= 10 ? 0 : 1))}s`

const resolveWhisperModel = (value: string): string => {
  const primary = value.split(' | ')[0] ?? value
  const match = primary.match(WHISPER_MODEL_PATH_PATTERN)
  if (match?.[1]) {
    return match[1]
  }
  return primary
}

const normalizeProviderForMatch = (step: WriteStepKind, provider: string): string => {
  if (step === 'llm' && provider === 'llama.cpp') {
    return 'llama'
  }
  if (step === 'stt' && provider === 'whisper.cpp') {
    return 'whisper'
  }
  return provider
}

const normalizeModelForMatch = (step: WriteStepKind, provider: string, model: string): string => {
  if (step === 'stt' && provider === 'whisper') {
    return resolveWhisperModel(model)
  }
  if (step === 'stt' && provider === 'reverb') {
    return 'reverb'
  }
  return model
}

const buildMatchKey = (step: WriteStepKind, provider: string, model: string): string => {
  const normalizedProvider = normalizeProviderForMatch(step, provider)
  const normalizedModel = normalizeModelForMatch(step, normalizedProvider, model)
  return `${step}::${normalizedProvider}::${normalizedModel}`
}

const buildProviderModelLabel = (provider: string, model: string): string => {
  const displayProvider = provider === 'whisper' ? 'whisper.cpp' : provider
  const displayModel = provider === 'reverb' ? resolveReverbModelLabel(model) : model
  return `${displayProvider}/${displayModel}`
}

const buildStep2SummaryRows = (metadata: WriteManifestMetadata): SummaryBaseRow[] => {
  const extractionRows = toArray(metadata['step2'], isExtractionMetadata).map((entry) => {
    const { provider, model } = resolveExtractionProviderModel(entry)
    return {
      stepKey: 'extract' as const,
      step: 'Extract',
      provider,
      model,
      providerModel: buildProviderModelLabel(provider, model)
    }
  })
  if (extractionRows.length > 0) {
    return extractionRows
  }

  return toArray(metadata['step2'], isStep2Metadata).map((entry) => {
    const provider = entry.transcriptionService
    const model = provider === 'whisper'
      ? resolveWhisperModel(entry.transcriptionModel)
      : provider === 'reverb'
        ? resolveReverbModelLabel(entry.transcriptionModel)
        : entry.transcriptionModel
    return {
      stepKey: 'stt' as const,
      step: 'Transcribe',
      provider,
      model,
      providerModel: buildProviderModelLabel(provider, model)
    }
  })
}

const buildStep3SummaryRows = (metadata: WriteManifestMetadata): SummaryBaseRow[] =>
  toArray(metadata['step3'], isStep3Metadata).map((entry) => ({
    stepKey: 'llm' as const,
    step: 'LLM',
    provider: entry.llmService,
    model: entry.llmModel,
    providerModel: buildProviderModelLabel(entry.llmService, entry.llmModel)
  }))

const buildStep4SummaryRows = (metadata: WriteManifestMetadata): SummaryBaseRow[] =>
  toArray(metadata['step4'], isStep4Metadata).map((entry) => ({
    stepKey: 'tts' as const,
    step: 'TTS',
    provider: entry.ttsService,
    model: entry.ttsModel,
    providerModel: buildProviderModelLabel(entry.ttsService, entry.ttsModel)
  }))

const buildStep5SummaryRows = (metadata: WriteManifestMetadata): SummaryBaseRow[] =>
  toArray(metadata['step5'], isStep5Metadata).map((entry) => ({
    stepKey: 'image' as const,
    step: 'Image',
    provider: entry.imageService,
    model: entry.imageModel,
    providerModel: buildProviderModelLabel(entry.imageService, entry.imageModel)
  }))

const buildStep6SummaryRows = (metadata: WriteManifestMetadata): SummaryBaseRow[] =>
  toArray(metadata['step6'], isStep6Metadata).map((entry) => ({
    stepKey: 'video' as const,
    step: 'Video',
    provider: entry.videoGenService,
    model: entry.videoGenModel,
    providerModel: buildProviderModelLabel(entry.videoGenService, entry.videoGenModel)
  }))

const buildStep7SummaryRows = (metadata: WriteManifestMetadata): SummaryBaseRow[] =>
  toArray(metadata['step7'], isStep7Metadata).map((entry) => ({
    stepKey: 'music' as const,
    step: 'Music',
    provider: entry.musicService,
    model: entry.musicModel,
    providerModel: buildProviderModelLabel(entry.musicService, entry.musicModel)
  }))

const buildSummaryBaseRows = (metadata: WriteManifestMetadata): IndexedRow<SummaryBaseRow>[] => {
  const occurrenceByKey = new Map<string, number>()
  const orderedRows = [
    ...buildStep2SummaryRows(metadata),
    ...buildStep3SummaryRows(metadata),
    ...buildStep4SummaryRows(metadata),
    ...buildStep5SummaryRows(metadata),
    ...buildStep6SummaryRows(metadata),
    ...buildStep7SummaryRows(metadata)
  ]

  return orderedRows.map((row) => {
    const key = buildMatchKey(row.stepKey, row.provider, row.model)
    const occurrence = occurrenceByKey.get(key) ?? 0
    occurrenceByKey.set(key, occurrence + 1)
    return { key, occurrence, value: row }
  })
}

const getEstimatedCostBreakdown = (metadata: WriteManifestMetadata): EstimatedCostBreakdown | undefined => {
  const cost = metadata['cost']
  if (!isRecord(cost) || !isRecord(cost['estimated'])) {
    return undefined
  }

  const estimated = cost['estimated']
  const steps = Array.isArray(estimated['steps']) ? estimated['steps'].filter(isCostEntry) : []
  return typeof estimated['totalCost'] === 'number'
    ? { totalCost: estimated['totalCost'], steps }
    : undefined
}

const getActualCostBreakdown = (metadata: WriteManifestMetadata): ActualCostBreakdown | undefined => {
  const cost = metadata['cost']
  if (!isRecord(cost) || !isRecord(cost['actual'])) {
    return undefined
  }

  const actual = cost['actual']
  const steps = Array.isArray(actual['steps'])
    ? actual['steps'].filter(isCostEntry).map((entry) => ({
        ...entry,
        costSource: normalizeManifestCostSource(entry.costSource)
      }))
    : []
  return typeof actual['totalCost'] === 'number'
    ? { totalCost: actual['totalCost'], steps }
    : undefined
}

const getTimingEntries = (
  metadata: WriteManifestMetadata,
  kind: 'estimated' | 'actual'
): TimingEntryLike[] => {
  const timing = metadata['timing']
  if (!isRecord(timing) || !isRecord(timing[kind])) {
    return []
  }

  const section = timing[kind]
  return Array.isArray(section['steps']) ? section['steps'].filter(isTimingEntry) : []
}

const indexRows = <T extends { step: WriteStepKind, provider: string, model: string },>(
  rows: readonly T[]
): Map<string, T[]> => {
  const indexed = new Map<string, T[]>()

  for (const row of rows) {
    const key = buildMatchKey(row.step, row.provider, row.model)
    const existing = indexed.get(key) ?? []
    existing.push(row)
    indexed.set(key, existing)
  }

  return indexed
}

const formatWriteManifestThroughput = (
  inputMetric: string | undefined,
  inputValue: number | undefined,
  processingTimeMs: number | undefined
): string | null => {
  if (
    !inputMetric
    || typeof inputValue !== 'number'
    || !Number.isFinite(inputValue)
    || inputValue <= 0
    || typeof processingTimeMs !== 'number'
    || !Number.isFinite(processingTimeMs)
    || processingTimeMs <= 0
  ) {
    return null
  }

  switch (inputMetric) {
    case 'durationMs':
    case 'durationSeconds':
      return `${formatNumber((inputMetric === 'durationMs' ? inputValue / 1000 : inputValue) / (processingTimeMs / 1000))}x`
    case 'tokens':
      return `${formatNumber(inputValue / (processingTimeMs / 1000))} tok/s`
    case 'characters':
      return `${formatNumber(inputValue / (processingTimeMs / 1000))} char/s`
    case 'pages':
      return `${formatNumber(inputValue / (processingTimeMs / 60000))} p/min`
    case 'images':
      return `${formatNumber(inputValue / (processingTimeMs / 60000))} img/min`
    default:
      return null
  }
}

const formatPersistedWriteManifestThroughput = (
  throughputValue: number | undefined,
  throughputUnit: TimingEntryLike['throughputUnit'] | undefined
): string | null => {
  if (
    typeof throughputValue !== 'number'
    || !Number.isFinite(throughputValue)
    || throughputValue <= 0
    || !throughputUnit
  ) {
    return null
  }

  switch (throughputUnit) {
    case 'x':
      return `${formatNumber(throughputValue)}x`
    case 'tokensPerSecond':
      return `${formatNumber(throughputValue)} tok/s`
    case 'charactersPerSecond':
      return `${formatNumber(throughputValue)} char/s`
    case 'pagesPerMinute':
      return `${formatNumber(throughputValue)} p/min`
    case 'imagesPerMinute':
      return `${formatNumber(throughputValue)} img/min`
  }
}

const formatPromptUsageTokenPair = (left: number, right: number): string =>
  `${formatTokenCount(left).replace(/ tok$/, '')}/${formatTokenCount(right).replace(/ tok$/, '')} tok`

const getNumber = (record: Record<string, unknown>, key: string): number | undefined =>
  typeof record[key] === 'number' && Number.isFinite(record[key])
    ? record[key]
    : undefined

const getRecord = (record: Record<string, unknown>, key: string): Record<string, unknown> | undefined =>
  isRecord(record[key]) ? record[key] : undefined

const formatInputSummary = (record: Record<string, unknown> | undefined): string | null => {
  if (!record) return null
  const promptTokens = getNumber(record, 'promptTokens')
  const completionTokens = getNumber(record, 'completionTokens')
  if (promptTokens !== undefined || completionTokens !== undefined) {
    return formatPromptUsageTokenPair(promptTokens ?? 0, completionTokens ?? 0)
  }

  const estimatedOutputChars = getNumber(record, 'estimatedOutputChars')
  if (estimatedOutputChars !== undefined) {
    return formatCount(estimatedOutputChars, 'char', 'chars')
  }

  const inputMetric = typeof record['inputMetric'] === 'string' ? record['inputMetric'] : undefined
  const inputValue = getNumber(record, 'inputValue')
  if (inputMetric && inputValue !== undefined) {
    switch (inputMetric) {
      case 'pages':
        return formatCount(inputValue, 'page', 'pages')
      case 'tokens':
        return formatTokenCount(inputValue)
      case 'outputCharacters':
      case 'characters':
        return formatCount(inputValue, 'char', 'chars')
      default:
        return `${formatNumber(inputValue)} ${inputMetric}`
    }
  }

  const pageCount = getNumber(record, 'pageCount')
  return pageCount !== undefined ? formatCount(pageCount, 'page', 'pages') : null
}

const formatRatesSummary = (record: Record<string, unknown> | undefined): string | null => {
  if (!record) return null
  const formatRateCost = (value: number): string =>
    Number.isInteger(value) ? `${value}\u00A2` : formatCost(value)

  const parts = [
    getNumber(record, 'inputCostPer1MCents') !== undefined ? `${formatRateCost(getNumber(record, 'inputCostPer1MCents') as number)}/1M in` : null,
    getNumber(record, 'outputCostPer1MCents') !== undefined ? `${formatRateCost(getNumber(record, 'outputCostPer1MCents') as number)}/1M out` : null,
    getNumber(record, 'costPer1kPagesCents') !== undefined ? `${formatRateCost(getNumber(record, 'costPer1kPagesCents') as number)}/1k pages` : null,
    getNumber(record, 'costPer1kOutputCharsCents') !== undefined ? `${formatRateCost(getNumber(record, 'costPer1kOutputCharsCents') as number)}/1k chars` : null
  ].filter((value): value is string => typeof value === 'string')
  return parts.length > 0 ? parts.join(' / ') : null
}

const buildRunSummary = (metadata: WriteManifestMetadata): SummarySection | undefined => {
  const baseRows = buildSummaryBaseRows(metadata)
  if (baseRows.length === 0) {
    return undefined
  }

  const estimatedCostRows = indexRows(getEstimatedCostBreakdown(metadata)?.steps ?? [])
  const actualCostRows = indexRows(getActualCostBreakdown(metadata)?.steps ?? [])
  const estimatedTimingRows = indexRows(getTimingEntries(metadata, 'estimated'))
  const actualTimingRows = indexRows(getTimingEntries(metadata, 'actual'))

  const rows = baseRows.map(({ key, occurrence, value }) => {
    const predictedCost = estimatedCostRows.get(key)?.[occurrence]
    const actualCost = actualCostRows.get(key)?.[occurrence]
    const predictedTime = estimatedTimingRows.get(key)?.[occurrence]
    const actualTime = actualTimingRows.get(key)?.[occurrence]

    return {
      step: value.step,
      providerModel: value.providerModel,
      predictedCostCents: predictedCost?.cost ?? null,
      actualCostCents: actualCost?.cost ?? null,
      actualCostSource: actualCost?.costSource ?? null,
      predictedTimeMs: predictedTime?.processingTimeMs ?? null,
      actualTimeMs: actualTime?.processingTimeMs ?? null,
      predictedSpeed: formatPersistedWriteManifestThroughput(predictedTime?.throughputValue, predictedTime?.throughputUnit)
        ?? formatWriteManifestThroughput(
          predictedTime?.inputMetric,
          predictedTime?.inputValue,
          predictedTime?.processingTimeMs
        ),
      actualSpeed: formatPersistedWriteManifestThroughput(actualTime?.throughputValue, actualTime?.throughputUnit)
        ?? formatWriteManifestThroughput(
          actualTime?.inputMetric,
          actualTime?.inputValue,
          actualTime?.processingTimeMs
        ),
      predictedInputMetric: predictedTime?.inputMetric ?? null,
      predictedInputValue: predictedTime?.inputValue ?? null,
      actualInputMetric: actualTime?.inputMetric ?? null,
      actualInputValue: actualTime?.inputValue ?? null
    } satisfies WriteRunSummaryRow
  })

  return {
    columns: SUMMARY_COLUMNS,
    rows,
    humanTable: createHumanTable(rows.map((row) => ({
      step: row.step,
      providerModel: row.providerModel,
      predCost: row.predictedCostCents === null ? '' : formatCost(row.predictedCostCents),
      actCost: row.actualCostCents === null ? '' : formatCost(row.actualCostCents),
      actSource: row.actualCostSource ?? '',
      predTime: row.predictedTimeMs === null ? '' : formatDuration(row.predictedTimeMs),
      actTime: row.actualTimeMs === null ? '' : formatDuration(row.actualTimeMs),
      predSpeed: row.predictedSpeed ?? '',
      actSpeed: row.actualSpeed ?? ''
    })), SUMMARY_COLUMNS)
  }
}

const resolveTtsCharacterCount = (metadata: WriteManifestMetadata, index: number): number | undefined => {
  const actualTtsRows = getTimingEntries(metadata, 'actual').filter((entry) => entry.step === 'tts')
  const actualValue = actualTtsRows[index]?.inputMetric === 'characters' ? actualTtsRows[index]?.inputValue : undefined
  if (typeof actualValue === 'number' && actualValue > 0) {
    return actualValue
  }

  const estimatedTtsRows = getTimingEntries(metadata, 'estimated').filter((entry) => entry.step === 'tts')
  const estimatedValue = estimatedTtsRows[index]?.inputMetric === 'characters' ? estimatedTtsRows[index]?.inputValue : undefined
  if (typeof estimatedValue === 'number' && estimatedValue > 0) {
    return estimatedValue
  }

  const actualCost = getActualCostBreakdown(metadata)
  const actualCostRow = actualCost?.steps.filter((entry) => entry.step === 'tts')[index]
  const costValue = actualCostRow?.inputMetric === 'characters' ? actualCostRow.inputValue : undefined
  return typeof costValue === 'number' && costValue > 0 ? costValue : undefined
}

const buildPromptUsage = (
  metadata: WriteManifestMetadata,
  refs: WriteManifestSourceRefs
): PromptUsageSection | undefined => {
  const rows: WritePromptUsageRow[] = []
  const promptArtifact = refs.promptArtifact ?? 'prompt.md'
  const extractPromptSource = refs.extractPromptSource ?? 'inline source'
  const step3RenderedOutput = refs.step3RenderedOutput ?? 'step3 rendered output'

  for (const entry of toArray(metadata['step2'], isExtractionMetadata)) {
    const { provider, model } = resolveExtractionProviderModel(entry)
    const usage = (entry.promptTokens ?? 0) > 0 || (entry.completionTokens ?? 0) > 0
      ? formatPromptUsageTokenPair(entry.promptTokens ?? 0, entry.completionTokens ?? 0)
      : formatCount(entry.totalPages, 'page', 'pages')
    rows.push({
      step: 'Extract',
      providerModel: buildProviderModelLabel(provider, model),
      promptSource: extractPromptSource,
      usage
    })
  }

  for (const entry of toArray(metadata['step2'], isStep2Metadata)) {
    const model = entry.transcriptionService === 'whisper'
      ? resolveWhisperModel(entry.transcriptionModel)
      : entry.transcriptionService === 'reverb'
        ? resolveReverbModelLabel(entry.transcriptionModel)
        : entry.transcriptionModel
    rows.push({
      step: 'Transcribe',
      providerModel: buildProviderModelLabel(entry.transcriptionService, model),
      promptSource: null,
      usage: formatTokenCount(entry.tokenCount)
    })
  }

  for (const entry of toArray(metadata['step3'], isStep3Metadata)) {
    rows.push({
      step: 'LLM',
      providerModel: buildProviderModelLabel(entry.llmService, entry.llmModel),
      promptSource: promptArtifact,
      usage: formatPromptUsageTokenPair(entry.inputTokenCount, entry.outputTokenCount)
    })
  }

  for (const [index, entry] of toArray(metadata['step4'], isStep4Metadata).entries()) {
    const characterCount = resolveTtsCharacterCount(metadata, index)
    const usage = [
      typeof characterCount === 'number' ? formatCount(characterCount, 'char', 'chars') : null,
      formatCount(entry.chunkCount, 'chunk', 'chunks')
    ].filter((value): value is string => typeof value === 'string' && value.length > 0).join(' / ')
    rows.push({
      step: 'TTS',
      providerModel: buildProviderModelLabel(entry.ttsService, entry.ttsModel),
      promptSource: step3RenderedOutput,
      usage: usage.length > 0 ? usage : null
    })
  }

  for (const entry of toArray(metadata['step5'], isStep5Metadata)) {
    rows.push({
      step: 'Image',
      providerModel: buildProviderModelLabel(entry.imageService, entry.imageModel),
      promptSource: step3RenderedOutput,
      usage: formatCount(entry.imageCount, 'image', 'images')
    })
  }

  for (const entry of toArray(metadata['step6'], isStep6Metadata)) {
    rows.push({
      step: 'Video',
      providerModel: buildProviderModelLabel(entry.videoGenService, entry.videoGenModel),
      promptSource: step3RenderedOutput,
      usage: typeof entry.videoDuration === 'number' && entry.videoDuration > 0 ? formatSecondsShort(entry.videoDuration) : null
    })
  }

  for (const entry of toArray(metadata['step7'], isStep7Metadata)) {
    rows.push({
      step: 'Music',
      providerModel: buildProviderModelLabel(entry.musicService, entry.musicModel),
      promptSource: step3RenderedOutput,
      usage: typeof entry.musicDurationMs === 'number' && entry.musicDurationMs > 0
        ? formatSecondsShort(entry.musicDurationMs / 1000)
        : null
    })
  }

  const filteredRows = rows.filter((row) => row.promptSource !== null || row.usage !== null)
  if (filteredRows.length === 0) {
    return undefined
  }

  return {
    columns: PROMPT_USAGE_COLUMNS,
    rows: filteredRows,
    humanTable: createHumanTable(filteredRows.map((row) => ({
      step: row.step,
      providerModel: row.providerModel,
      promptSource: row.promptSource ?? '',
      usage: row.usage ?? ''
    })), PROMPT_USAGE_COLUMNS)
  }
}

const getOcrDiagnostics = (metadata: WriteManifestMetadata): Record<string, unknown>[] => {
  const cost = metadata['cost']
  if (!isRecord(cost) || !Array.isArray(cost['ocrDiagnostics'])) {
    return []
  }
  return cost['ocrDiagnostics'].filter(isRecord)
}

const buildOcrCostCalculation = (metadata: WriteManifestMetadata): OcrCostCalculationSection | undefined => {
  const diagnostics = getOcrDiagnostics(metadata)
  if (diagnostics.length === 0) {
    return undefined
  }

  const rows: OcrCostCalculationRow[] = diagnostics.map((entry) => {
    const provider = typeof entry['provider'] === 'string' ? entry['provider'] : 'ocr'
    const model = typeof entry['model'] === 'string' ? entry['model'] : 'unknown'
    const predictedCostInputs = getRecord(entry, 'predictedCostInputs')
    const actualCostInputs = getRecord(entry, 'actualCostInputs')
    const delta = getRecord(entry, 'delta')

    return {
      providerModel: buildProviderModelLabel(provider, model),
      pages: getNumber(entry, 'pages') ?? null,
      predictedInputs: formatInputSummary(predictedCostInputs),
      actualInputs: formatInputSummary(actualCostInputs),
      rates: formatRatesSummary(getRecord(entry, 'ratesUsed')),
      predictedCostCents: getNumber(predictedCostInputs ?? {}, 'costCents') ?? null,
      actualCostCents: getNumber(actualCostInputs ?? {}, 'costCents') ?? null,
      deltaCents: getNumber(delta ?? {}, 'costCents') ?? null
    }
  })

  return {
    columns: OCR_COST_COLUMNS,
    rows,
    humanTable: createHumanTable(rows.map((row) => ({
      providerModel: row.providerModel,
      pages: row.pages === null ? '' : formatNumber(row.pages),
      predInputs: row.predictedInputs ?? '',
      actInputs: row.actualInputs ?? '',
      rates: row.rates ?? '',
      predCost: row.predictedCostCents === null ? '' : formatCost(row.predictedCostCents),
      actCost: row.actualCostCents === null ? '' : formatCost(row.actualCostCents),
      delta: row.deltaCents === null ? '' : formatCost(row.deltaCents)
    })), OCR_COST_COLUMNS)
  }
}

export const buildWriteManifestConsoleSummary = (
  metadata: WriteManifestMetadata,
  refs: WriteManifestSourceRefs = {}
): WriteManifestConsoleSummary => {
  const runSummary = buildRunSummary(metadata)
  const promptUsage = buildPromptUsage(metadata, refs)
  const ocrCostCalculation = buildOcrCostCalculation(metadata)

  return {
    ...(runSummary ? { runSummary } : {}),
    ...(promptUsage ? { promptUsage } : {}),
    ...(ocrCostCalculation ? { ocrCostCalculation } : {})
  }
}

export const logRunManifestLocation = (
  outputDir: string,
  logger: Pick<Logger, 'write'> = l,
  kind = 'write'
): string => {
  const manifestPath = `${outputDir}/run.json`
  logger.write('info', 'Locations', {
    category: 'artifact',
    humanTable: createKeyValueTable([['runManifest', manifestPath]], 'artifact', 'path'),
    metadata: {
      path: manifestPath,
      kind
    }
  })
  return manifestPath
}

export const logWriteManifestConsoleSummary = (
  outputDir: string,
  metadata: WriteManifestMetadata,
  refs: WriteManifestSourceRefs = {},
  logger: Pick<Logger, 'write' | 'debug'> = l
): void => {
  logManifestConsoleSummary(outputDir, 'write', metadata, refs, logger)
}

export const logExtractManifestConsoleSummary = (
  outputDir: string,
  metadata: WriteManifestMetadata,
  refs: WriteManifestSourceRefs = {},
  logger: Pick<Logger, 'write' | 'debug'> = l
): void => {
  logManifestConsoleSummary(outputDir, 'extract', metadata, refs, logger)
}

const logManifestConsoleSummary = (
  outputDir: string,
  kind: string,
  metadata: WriteManifestMetadata,
  refs: WriteManifestSourceRefs,
  logger: Pick<Logger, 'write' | 'debug'>
): void => {
  const summary = buildWriteManifestConsoleSummary(metadata, refs)

  logRunManifestLocation(outputDir, logger, kind)

  if (summary.runSummary) {
    logger.write('info', 'Run Summary', {
      category: 'artifact',
      humanTable: summary.runSummary.humanTable,
      metadata: {
        columns: summary.runSummary.columns,
        rows: summary.runSummary.rows
      }
    })
  }

  if (summary.promptUsage) {
    logger.write('info', 'Prompt Usage', {
      category: 'usage',
      humanTable: summary.promptUsage.humanTable,
      metadata: {
        columns: summary.promptUsage.columns,
        rows: summary.promptUsage.rows
      }
    })
  }

  if (summary.ocrCostCalculation) {
    logger.write('info', 'OCR Cost Calculation', {
      category: 'usage',
      humanTable: summary.ocrCostCalculation.humanTable,
      metadata: {
        columns: summary.ocrCostCalculation.columns,
        rows: summary.ocrCostCalculation.rows
      }
    })
  }

  logger.debug(`Run manifest:\n${JSON.stringify({
    schemaVersion: 2,
    kind,
    metadata
  }, null, 2)}`)
}
