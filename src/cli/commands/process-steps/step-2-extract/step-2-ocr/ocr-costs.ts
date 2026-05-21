import type {
  ActualCostBreakdown,
  AggregatedPriceEstimate,
  ComputeEstimatedCostsInput,
  EstimatedCostBreakdown,
  EstimatedStepEntry,
  ExtractionMetadata,
  Step3Metadata
} from '~/types'
import { getExtractPricing } from '~/cli/commands/setup-and-utilities/models/model-loader'
import { computeEstimatedCosts } from '~/utils/pricing/compute-estimated-costs'
import { preflightToEstimated } from '~/utils/pricing/compute-costs'
import {
  ANTHROPIC_OCR_PRICE_NOTE,
  DEEPINFRA_OCR_PRICE_NOTE,
  FIRECRAWL_PRICE_NOTE,
  GEMINI_OCR_PRICE_NOTE,
  GLM_OCR_PRICE_NOTE,
  GROK_OCR_PRICE_NOTE,
  KIMI_OCR_PRICE_NOTE,
  OPENAI_OCR_PRICE_NOTE
} from './ocr-utils/extract-pricing'

type ExtractEstimateTarget = NonNullable<ComputeEstimatedCostsInput['extractTargets']>[number]
type ExtractEstimateProvider = ExtractEstimateTarget['provider']
type OcrModelFallbackOptions = {
  mistralOcrModel?: string | undefined
  glmOcrModel?: string | undefined
  kimiOcrModel?: string | undefined
  openaiOcrModel?: string | undefined
  grokOcrModel?: string | undefined
  anthropicOcrModel?: string | undefined
  geminiOcrModel?: string | undefined
  deepinfraOcrModel?: string | undefined
  gcloudDocaiModel?: string | undefined
  awsTextractModel?: string | undefined
  unstructuredOcrModel?: string | undefined
}
type CollectEstimatedExtractTargetsOptions = OcrModelFallbackOptions & {
  useObservedUsage?: boolean | undefined
}

const TOKEN_PRICED_OCR_PROVIDERS = new Set(['glm', 'kimi', 'openai', 'grok', 'anthropic', 'gemini', 'deepinfra'])
const OCR_DIAGNOSTIC_PROVIDERS = new Set([
  'mistral',
  'glm',
  'kimi',
  'openai',
  'grok',
  'anthropic',
  'gemini',
  'deepinfra',
  'gcloud-docai',
  'aws-textract',
  'unstructured'
])

const toArray = <T,>(value: T | T[]): T[] => Array.isArray(value) ? value : [value]

export const resolveExtractionProviderModel = (
  metadata: ExtractionMetadata
): { provider: string, model: string } => {
  if (metadata.extractionMethod.includes('html+defuddle')) {
    return { provider: 'defuddle', model: 'defuddle' }
  }
  if (metadata.extractionMethod.includes('html+firecrawl')) {
    return { provider: 'firecrawl', model: 'firecrawl' }
  }
  if (metadata.extractionMethod.includes('html+glm-reader')) {
    return { provider: 'glm-reader', model: 'glm-reader' }
  }
  if (metadata.extractionMethod.includes('html+spider')) {
    return { provider: 'spider', model: 'spider' }
  }
  if (metadata.extractionMethod.includes('html+zyte')) {
    return { provider: 'zyte', model: 'zyte' }
  }

  if (typeof metadata.ocrService === 'string' && typeof metadata.ocrModel === 'string') {
    return { provider: metadata.ocrService, model: metadata.ocrModel }
  }

  if (metadata.extractionMethod.includes('paddle-ocr')) {
    return { provider: 'paddle-ocr', model: 'paddle-ocr' }
  }
  if (metadata.extractionMethod.includes('ocrmypdf')) {
    return { provider: 'ocrmypdf', model: 'ocrmypdf' }
  }
  if (metadata.extractionMethod.includes('tesseract')) {
    return { provider: 'tesseract', model: 'tesseract' }
  }
  return { provider: 'extract', model: metadata.extractionMethod }
}

const buildTokenTarget = (
  provider: Extract<'glm' | 'kimi' | 'openai' | 'grok' | 'anthropic' | 'gemini' | 'deepinfra', ExtractEstimateProvider>,
  model: string,
  pageCount: number,
  note?: string
): ExtractEstimateTarget => ({
  provider,
  model,
  pageCount,
  estimateType: 'heuristic',
  ...(note ? { note } : {})
})

const withObservedTokenUsage = (
  target: ExtractEstimateTarget,
  entry: ExtractionMetadata,
  useObservedUsage: boolean | undefined
): ExtractEstimateTarget => {
  if (
    !useObservedUsage
    || !TOKEN_PRICED_OCR_PROVIDERS.has(target.provider)
    || typeof entry.promptTokens !== 'number'
    || typeof entry.completionTokens !== 'number'
  ) {
    return target
  }

  return {
    ...target,
    promptTokens: entry.promptTokens,
    completionTokens: entry.completionTokens,
    estimateType: 'exact'
  }
}

export const collectEstimatedExtractTargets = (
  metadata: ExtractionMetadata | ExtractionMetadata[],
  opts: CollectEstimatedExtractTargetsOptions = {}
): ExtractEstimateTarget[] => {
  const targets: ExtractEstimateTarget[] = []

  for (const entry of toArray(metadata)) {
    const pageCount = Math.max(1, entry.totalPages)

    if (
      entry.extractionMethod === 'html+defuddle'
      || entry.extractionMethod === 'html+firecrawl'
      || entry.extractionMethod === 'html+glm-reader'
      || entry.extractionMethod === 'html+spider'
      || entry.extractionMethod === 'html+zyte'
    ) {
      const { provider, model } = resolveExtractionProviderModel(entry) as {
        provider: 'defuddle' | 'firecrawl' | 'glm-reader' | 'spider' | 'zyte'
        model: string
      }
      targets.push({
        provider,
        model,
        pageCount,
        estimateType: 'exact',
        ...(provider === 'firecrawl' ? { note: FIRECRAWL_PRICE_NOTE } : {})
      })
      continue
    }

    if (entry.extractionMethod.startsWith('html+')) {
      continue
    }

    const { provider, model } = resolveExtractionProviderModel(entry)
    if (provider === 'mistral') {
      targets.push({
        provider: 'mistral',
        model: model || opts.mistralOcrModel || 'mistral-ocr',
        pageCount,
        estimateType: 'exact'
      })
      continue
    }

    if (provider === 'glm') {
      targets.push(withObservedTokenUsage(buildTokenTarget('glm', model || opts.glmOcrModel || 'glm-ocr', pageCount, GLM_OCR_PRICE_NOTE), entry, opts.useObservedUsage))
      continue
    }

    if (provider === 'kimi') {
      targets.push(withObservedTokenUsage(buildTokenTarget('kimi', model || opts.kimiOcrModel || 'kimi-ocr', pageCount, KIMI_OCR_PRICE_NOTE), entry, opts.useObservedUsage))
      continue
    }

    if (provider === 'openai') {
      targets.push(withObservedTokenUsage(buildTokenTarget('openai', model || opts.openaiOcrModel || 'openai-ocr', pageCount, OPENAI_OCR_PRICE_NOTE), entry, opts.useObservedUsage))
      continue
    }

    if (provider === 'grok') {
      targets.push(withObservedTokenUsage(buildTokenTarget('grok', model || opts.grokOcrModel || 'grok-4.3', pageCount, GROK_OCR_PRICE_NOTE), entry, opts.useObservedUsage))
      continue
    }

    if (provider === 'anthropic') {
      targets.push(withObservedTokenUsage(buildTokenTarget('anthropic', model || opts.anthropicOcrModel || 'anthropic-ocr', pageCount, ANTHROPIC_OCR_PRICE_NOTE), entry, opts.useObservedUsage))
      continue
    }

    if (provider === 'gemini') {
      targets.push(withObservedTokenUsage(buildTokenTarget('gemini', model || opts.geminiOcrModel || 'gemini-ocr', pageCount, GEMINI_OCR_PRICE_NOTE), entry, opts.useObservedUsage))
      continue
    }

    if (provider === 'deepinfra') {
      targets.push(withObservedTokenUsage(buildTokenTarget('deepinfra', model || opts.deepinfraOcrModel || 'deepinfra-ocr', pageCount, DEEPINFRA_OCR_PRICE_NOTE), entry, opts.useObservedUsage))
      continue
    }

    if (provider === 'gcloud-docai') {
      targets.push({
        provider: 'gcloud-docai',
        model: model || opts.gcloudDocaiModel || 'gcloud-docai',
        pageCount,
        estimateType: 'exact'
      })
      continue
    }

    if (provider === 'aws-textract') {
      targets.push({
        provider: 'aws-textract',
        model: model || opts.awsTextractModel || 'aws-textract',
        pageCount,
        estimateType: 'exact'
      })
      continue
    }

    if (provider === 'unstructured') {
      targets.push({
        provider: 'unstructured',
        model: model || opts.unstructuredOcrModel || 'hi_res_and_enrichment',
        pageCount,
        estimateType: 'exact'
      })
      continue
    }
  }

  return targets
}

const buildMatchKey = (step: string, provider: string, model: string): string =>
  `${step}::${provider}::${model}`

const filterPreflightEstimate = (
  estimate: AggregatedPriceEstimate,
  allowedKeys: Set<string>
): AggregatedPriceEstimate => {
  const steps = estimate.steps.filter((step) => allowedKeys.has(buildMatchKey(step.step, step.provider, step.model)))
  return {
    steps,
    totalEstimatedCost: steps.reduce((sum, step) => sum + step.totalCost, 0),
    ...(estimate.notes && estimate.notes.length > 0 ? { notes: estimate.notes } : {})
  }
}

export const resolveExtractEstimatedCosts = (
  preflightEstimate: AggregatedPriceEstimate | undefined,
  step2: ExtractionMetadata | ExtractionMetadata[],
  opts: OcrModelFallbackOptions = {}
): EstimatedCostBreakdown => {
  const extractTargets = collectEstimatedExtractTargets(step2, opts)
  if (preflightEstimate) {
    const allowedKeys = new Set(extractTargets.map((target) => buildMatchKey('extract', target.provider, target.model)))
    return preflightToEstimated(filterPreflightEstimate(preflightEstimate, allowedKeys))
  }

  return computeEstimatedCosts({
    applyCostMultipliers: false,
    extractTargets
  })
}

export const resolveExtractObservedEstimateCosts = (
  step2: ExtractionMetadata | ExtractionMetadata[],
  opts: OcrModelFallbackOptions = {}
): EstimatedCostBreakdown => computeEstimatedCosts({
  applyCostMultipliers: false,
  extractTargets: collectEstimatedExtractTargets(step2, {
    ...opts,
    useObservedUsage: true
  })
})

export const resolveDocumentWriteEstimatedCosts = (
  preflightEstimate: AggregatedPriceEstimate | undefined,
  step2: ExtractionMetadata | ExtractionMetadata[],
  step3: Step3Metadata | Step3Metadata[],
  opts: OcrModelFallbackOptions = {}
): EstimatedCostBreakdown => {
  const extractTargets = collectEstimatedExtractTargets(step2, opts)
  const step3Entries = toArray(step3)

  if (preflightEstimate) {
    const allowedKeys = new Set([
      ...extractTargets.map((target) => buildMatchKey('extract', target.provider, target.model)),
      ...step3Entries.map((entry) => buildMatchKey('llm', entry.llmService, entry.llmModel))
    ])
    return preflightToEstimated(filterPreflightEstimate(preflightEstimate, allowedKeys))
  }

  return computeEstimatedCosts({
    applyCostMultipliers: false,
    extractTargets,
    llmTargets: step3Entries.map((entry) => ({
      service: entry.llmService,
      model: entry.llmModel,
      inputTokens: entry.inputTokenCount,
      outputTokens: entry.outputTokenCount
    })),
    skipLLM: false
  })
}

export const resolveDocumentWriteObservedEstimateCosts = (
  step2: ExtractionMetadata | ExtractionMetadata[],
  step3: Step3Metadata | Step3Metadata[],
  opts: OcrModelFallbackOptions = {}
): EstimatedCostBreakdown => {
  const extractTargets = collectEstimatedExtractTargets(step2, {
    ...opts,
    useObservedUsage: true
  })
  const step3Entries = toArray(step3)

  return computeEstimatedCosts({
    applyCostMultipliers: false,
    extractTargets,
    llmTargets: step3Entries.map((entry) => ({
      service: entry.llmService,
      model: entry.llmModel,
      inputTokens: entry.inputTokenCount,
      outputTokens: entry.outputTokenCount
    })),
    skipLLM: false
  })
}

const rowsByKey = <T extends { step: string, provider: string, model: string }>(
  rows: T[]
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

const getEstimatedInputMetric = (row: EstimatedStepEntry | undefined): string | undefined => {
  if (!row) return undefined
  if (typeof row.promptTokens === 'number' || typeof row.completionTokens === 'number') return 'tokens'
  if (typeof row.estimatedOutputChars === 'number') return 'outputCharacters'
  if (typeof row.pageCount === 'number') return 'pages'
  return undefined
}

const getEstimatedInputValue = (row: EstimatedStepEntry | undefined): number | undefined => {
  if (!row) return undefined
  if (typeof row.promptTokens === 'number' || typeof row.completionTokens === 'number') {
    return (row.promptTokens ?? 0) + (row.completionTokens ?? 0)
  }
  if (typeof row.estimatedOutputChars === 'number') return row.estimatedOutputChars
  if (typeof row.pageCount === 'number') return row.pageCount
  return undefined
}

const buildRatesUsed = (
  provider: string,
  model: string,
  estimated: EstimatedStepEntry | undefined
): Record<string, number> | undefined => {
  const registry = getExtractPricing(provider, model)
  const rates = {
    ...(typeof estimated?.inputCostPer1MCents === 'number'
      ? { inputCostPer1MCents: estimated.inputCostPer1MCents }
      : typeof registry.inputCostPer1MCents === 'number'
        ? { inputCostPer1MCents: registry.inputCostPer1MCents }
        : {}),
    ...(typeof estimated?.outputCostPer1MCents === 'number'
      ? { outputCostPer1MCents: estimated.outputCostPer1MCents }
      : typeof registry.outputCostPer1MCents === 'number'
        ? { outputCostPer1MCents: registry.outputCostPer1MCents }
        : {}),
    ...(typeof estimated?.costPer1kPagesCents === 'number'
      ? { costPer1kPagesCents: estimated.costPer1kPagesCents }
      : typeof registry.costPer1kPagesCents === 'number'
        ? { costPer1kPagesCents: registry.costPer1kPagesCents }
        : {}),
    ...(typeof estimated?.costPer1kOutputCharsCents === 'number'
      ? { costPer1kOutputCharsCents: estimated.costPer1kOutputCharsCents }
      : typeof registry.costPer1kOutputCharsCents === 'number'
        ? { costPer1kOutputCharsCents: registry.costPer1kOutputCharsCents }
        : {})
  }
  return Object.keys(rates).length > 0 ? rates : undefined
}

const getOcrProviderUsage = (entry: ExtractionMetadata): unknown[] | undefined => {
  const metadata = entry as Record<string, unknown>
  return Array.isArray(metadata['ocrProviderUsage']) ? metadata['ocrProviderUsage'] : undefined
}

export const buildOcrCostDiagnostics = (
  step2: ExtractionMetadata | ExtractionMetadata[],
  estimated: EstimatedCostBreakdown,
  actual: ActualCostBreakdown
): Record<string, unknown>[] => {
  const estimatedRows = rowsByKey(estimated.steps)
  const actualRows = rowsByKey(actual.steps)
  const occurrenceByKey = new Map<string, number>()
  const diagnostics: Record<string, unknown>[] = []

  for (const entry of toArray(step2)) {
    const { provider, model } = resolveExtractionProviderModel(entry)
    if (!OCR_DIAGNOSTIC_PROVIDERS.has(provider)) {
      continue
    }

    const key = buildMatchKey('extract', provider, model)
    const occurrence = occurrenceByKey.get(key) ?? 0
    occurrenceByKey.set(key, occurrence + 1)
    const predicted = estimatedRows.get(key)?.[occurrence]
    const actualRow = actualRows.get(key)?.[occurrence]
    const actualPromptTokens = actualRow?.promptTokens ?? entry.promptTokens
    const actualCompletionTokens = actualRow?.completionTokens ?? entry.completionTokens
    const predictedCostCents = predicted?.cost ?? 0
    const actualCostCents = actualRow?.cost ?? 0
    const ratesUsed = buildRatesUsed(provider, model, predicted)
    const usageDetails = getOcrProviderUsage(entry)

    diagnostics.push({
      provider,
      model,
      pages: entry.totalPages,
      predictedCostInputs: {
        costCents: predictedCostCents,
        ...(typeof predicted?.pageCount === 'number' ? { pageCount: predicted.pageCount } : { pageCount: entry.totalPages }),
        ...(getEstimatedInputMetric(predicted) ? { inputMetric: getEstimatedInputMetric(predicted) } : {}),
        ...(typeof getEstimatedInputValue(predicted) === 'number' ? { inputValue: getEstimatedInputValue(predicted) } : {}),
        ...(typeof predicted?.promptTokens === 'number' ? { promptTokens: predicted.promptTokens } : {}),
        ...(typeof predicted?.completionTokens === 'number' ? { completionTokens: predicted.completionTokens } : {}),
        ...(typeof predicted?.estimatedOutputChars === 'number' ? { estimatedOutputChars: predicted.estimatedOutputChars } : {}),
        ...(typeof predicted?.estimateType === 'string' ? { estimateType: predicted.estimateType } : {})
      },
      actualCostInputs: {
        costCents: actualCostCents,
        pageCount: entry.totalPages,
        ...(typeof actualRow?.inputMetric === 'string' ? { inputMetric: actualRow.inputMetric } : {}),
        ...(typeof actualRow?.inputValue === 'number' ? { inputValue: actualRow.inputValue } : {}),
        ...(typeof actualPromptTokens === 'number' ? { promptTokens: actualPromptTokens } : {}),
        ...(typeof actualCompletionTokens === 'number' ? { completionTokens: actualCompletionTokens } : {}),
        ...(typeof actualRow?.costSource === 'string' ? { costSource: actualRow.costSource } : {}),
        ...(typeof entry.providerCostCents === 'number' ? { providerCostCents: entry.providerCostCents } : {}),
        ...(typeof entry.providerCostSource === 'string' ? { providerCostSource: entry.providerCostSource } : {}),
        ...(usageDetails ? { usageDetails } : {})
      },
      ...(ratesUsed ? { ratesUsed } : {}),
      delta: {
        costCents: actualCostCents - predictedCostCents,
        ...(predictedCostCents > 0 ? { percent: ((actualCostCents - predictedCostCents) / predictedCostCents) * 100 } : {})
      },
      source: TOKEN_PRICED_OCR_PROVIDERS.has(provider)
        ? 'token_usage'
        : 'page_pricing'
    })
  }

  return diagnostics
}
