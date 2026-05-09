import { resolve as pathResolve } from 'node:path'
import * as l from '~/utils/logger'
import { logLocationsTable } from '~/utils/logger/human-table'
import { runLLM } from '~/cli/commands/process-steps/step-3-write/run-llm'
import { downloadDocument } from '~/cli/commands/process-steps/step-1-download/document/dl-document'
import { processOcr } from '~/cli/commands/process-steps/step-2-extract/step-2-ocr/process-ocr'
import { buildDocumentPrompt } from '~/cli/commands/process-steps/step-2-extract/step-2-ocr/ocr-utils/doc-prompt-utils'
import { writeRunManifest } from '~/cli/commands/process-steps/manifest-utils'
import { writeRenderedTextArtifacts } from '~/cli/commands/process-steps/step-3-write/text-input-utils'
import { logWriteManifestConsoleSummary } from '~/cli/commands/process-steps/write-manifest-log'
import { DEFAULT_DEEPINFRA_OCR_MODEL } from '~/cli/commands/setup-and-utilities/models/model-options'
import { DEEPINFRA_OCR_COMPLETION_TOKENS_PER_PAGE, DEEPINFRA_OCR_PRICE_NOTE, FIRECRAWL_PRICE_NOTE, KIMI_OCR_COMPLETION_TOKENS_PER_PAGE, KIMI_OCR_PRICE_NOTE } from '~/cli/commands/process-steps/step-2-extract/step-2-ocr/ocr-utils/extract-pricing'
import { computeActualCosts } from '~/utils/pricing/compute-actual-costs'
import { computeEstimatedCosts } from '~/utils/pricing/compute-estimated-costs'
import { computeActualProcessingTimes, computeEstimatedProcessingTimes } from '~/utils/pricing/compute-processing-time'
import type { BatchChildRunContext, ExtractionMetadata, ExtractionOptions, PreparedDocument, RuntimeOptions, Step1SourceRef, Step3Metadata, TranscriptionResult, VideoMetadata, WriteDocumentOutputMetadataOptions } from '~/types'
import { isLikelyUrl } from '../input/input-classifier'
import { resolveLLMDefaults } from '../llm-defaults'

const hasConfiguredLlmProvider = (opts: RuntimeOptions): boolean =>
  [
    ...(opts.llamaModels ?? (opts.llamaModel ? [opts.llamaModel] : [])),
    ...(opts.openaiModels ?? (opts.openaiModel ? [opts.openaiModel] : [])),
    ...(opts.groqModels ?? (opts.groqModel ? [opts.groqModel] : [])),
    ...(opts.geminiModels ?? (opts.geminiModel ? [opts.geminiModel] : [])),
    ...(opts.anthropicModels ?? (opts.anthropicModel ? [opts.anthropicModel] : [])),
    ...(opts.minimaxModels ?? (opts.minimaxModel ? [opts.minimaxModel] : [])),
    ...(opts.grokModels ?? (opts.grokModel ? [opts.grokModel] : [])),
    ...(opts.glmModels ?? (opts.glmModel ? [opts.glmModel] : [])),
    ...(opts.kimiModels ?? (opts.kimiModel ? [opts.kimiModel] : []))
  ].some((value) => typeof value === 'string' && value.length > 0)

const collectEstimatedExtractTargets = (
  metadata: ExtractionMetadata | ExtractionMetadata[],
  opts: Pick<RuntimeOptions, 'mistralOcrModel' | 'glmOcrModel' | 'kimiOcrModel' | 'openaiOcrModel' | 'anthropicOcrModel' | 'geminiOcrModel' | 'deepinfraOcrModel' | 'deapiOcrModel'>
): Array<{
  provider: 'mistral' | 'glm' | 'kimi' | 'openai' | 'anthropic' | 'gemini' | 'deepinfra' | 'firecrawl' | 'deapi'
  model: string
  pageCount?: number
  promptTokens?: number
  completionTokens?: number
  quotedCostCents?: number
  estimateType?: 'heuristic' | 'exact'
  note?: string
}> => {
  const targets: Array<{
    provider: 'mistral' | 'glm' | 'kimi' | 'openai' | 'anthropic' | 'gemini' | 'deepinfra' | 'firecrawl' | 'deapi'
    model: string
    pageCount?: number
    promptTokens?: number
    completionTokens?: number
    quotedCostCents?: number
    estimateType?: 'heuristic' | 'exact'
    note?: string
  }> = []

  for (const entry of Array.isArray(metadata) ? metadata : [metadata]) {
    if (entry.extractionMethod === 'html+firecrawl') {
      targets.push({
        provider: 'firecrawl',
        model: 'firecrawl',
        pageCount: entry.totalPages,
        estimateType: 'exact',
        note: FIRECRAWL_PRICE_NOTE
      })
      continue
    }

    if (entry.extractionMethod.startsWith('html+')) {
      continue
    }

    if ((entry.ocrService === 'glm' || entry.extractionMethod.includes('glm-ocr')) && typeof entry.ocrModel === 'string') {
      targets.push({
        provider: 'glm' as const,
        model: entry.ocrModel ?? opts.glmOcrModel ?? 'glm-ocr',
        pageCount: entry.totalPages,
        ...(typeof entry.promptTokens === 'number' ? { promptTokens: entry.promptTokens } : {}),
        ...(typeof entry.completionTokens === 'number' ? { completionTokens: entry.completionTokens } : {}),
        estimateType: typeof entry.promptTokens === 'number' || typeof entry.completionTokens === 'number' ? 'exact' : 'heuristic'
      })
      continue
    }

    if ((entry.ocrService === 'kimi' || entry.extractionMethod.includes('kimi-ocr')) && typeof entry.ocrModel === 'string') {
      const pageCount = entry.totalPages ?? 1
      const hasUsage = typeof entry.promptTokens === 'number' && typeof entry.completionTokens === 'number'
      targets.push({
        provider: 'kimi' as const,
        model: entry.ocrModel ?? opts.kimiOcrModel ?? 'kimi-k2.6',
        pageCount,
        ...(typeof entry.promptTokens === 'number' ? { promptTokens: entry.promptTokens } : {}),
        ...(typeof entry.completionTokens === 'number' ? { completionTokens: entry.completionTokens } : { completionTokens: pageCount * KIMI_OCR_COMPLETION_TOKENS_PER_PAGE }),
        estimateType: hasUsage ? 'exact' : 'heuristic',
        ...(hasUsage ? {} : { note: KIMI_OCR_PRICE_NOTE })
      })
      continue
    }

    if ((entry.ocrService === 'mistral' || entry.extractionMethod.includes('mistral-ocr')) && typeof entry.ocrModel === 'string') {
      targets.push({
        provider: 'mistral' as const,
        model: entry.ocrModel ?? opts.mistralOcrModel ?? 'mistral-ocr-2512',
        pageCount: entry.totalPages,
        estimateType: 'exact' as const
      })
      continue
    }

    if ((entry.ocrService === 'openai' || entry.extractionMethod.includes('openai-ocr')) && typeof entry.ocrModel === 'string') {
      targets.push({
        provider: 'openai' as const,
        model: entry.ocrModel ?? opts.openaiOcrModel ?? 'gpt-5.4-nano',
        pageCount: entry.totalPages,
        ...(typeof entry.promptTokens === 'number' ? { promptTokens: entry.promptTokens } : {}),
        ...(typeof entry.completionTokens === 'number' ? { completionTokens: entry.completionTokens } : {}),
        estimateType: typeof entry.promptTokens === 'number' || typeof entry.completionTokens === 'number' ? 'exact' : 'heuristic',
        note: 'Heuristic token estimate based on 4,000 prompt tokens per page. Actual OpenAI OCR cost is computed from response usage after execution.'
      })
      continue
    }

    if ((entry.ocrService === 'anthropic' || entry.extractionMethod.includes('anthropic-ocr')) && typeof entry.ocrModel === 'string') {
      targets.push({
        provider: 'anthropic' as const,
        model: entry.ocrModel ?? opts.anthropicOcrModel ?? 'claude-haiku-4-5',
        pageCount: entry.totalPages,
        ...(typeof entry.promptTokens === 'number' ? { promptTokens: entry.promptTokens } : {}),
        ...(typeof entry.completionTokens === 'number' ? { completionTokens: entry.completionTokens } : {}),
        estimateType: typeof entry.promptTokens === 'number' || typeof entry.completionTokens === 'number' ? 'exact' : 'heuristic',
        note: 'Heuristic token estimate based on 4,000 total tokens per page. Actual Anthropic OCR cost is computed from response usage after execution, and PDF cost varies with extracted text plus page-image tokens.'
      })
      continue
    }

    if ((entry.ocrService === 'gemini' || entry.extractionMethod.includes('gemini-ocr')) && typeof entry.ocrModel === 'string') {
      targets.push({
        provider: 'gemini' as const,
        model: entry.ocrModel ?? opts.geminiOcrModel ?? 'gemini-3.1-flash-lite-preview',
        pageCount: entry.totalPages,
        ...(typeof entry.promptTokens === 'number' ? { promptTokens: entry.promptTokens } : {}),
        ...(typeof entry.completionTokens === 'number' ? { completionTokens: entry.completionTokens } : {}),
        estimateType: typeof entry.promptTokens === 'number' || typeof entry.completionTokens === 'number' ? 'exact' : 'heuristic'
      })
      continue
    }

    if (entry.ocrService === 'deepinfra' || entry.extractionMethod.includes('deepinfra-ocr')) {
      const pageCount = entry.totalPages ?? 1
      const hasUsage = typeof entry.promptTokens === 'number' && typeof entry.completionTokens === 'number'
      targets.push({
        provider: 'deepinfra' as const,
        model: entry.ocrModel ?? opts.deepinfraOcrModel ?? DEFAULT_DEEPINFRA_OCR_MODEL,
        pageCount,
        ...(typeof entry.promptTokens === 'number' ? { promptTokens: entry.promptTokens } : {}),
        ...(typeof entry.completionTokens === 'number' ? { completionTokens: entry.completionTokens } : { completionTokens: pageCount * DEEPINFRA_OCR_COMPLETION_TOKENS_PER_PAGE }),
        estimateType: hasUsage ? 'exact' : 'heuristic',
        ...(hasUsage ? {} : { note: DEEPINFRA_OCR_PRICE_NOTE })
      })
      continue
    }

    if ((entry.ocrService === 'deapi' || entry.extractionMethod.includes('deapi-ocr')) && typeof entry.ocrModel === 'string') {
      targets.push({
        provider: 'deapi' as const,
        model: entry.ocrModel ?? opts.deapiOcrModel ?? 'Nanonets_Ocr_S_F16',
        pageCount: entry.totalPages,
        ...(typeof entry.providerCostCents === 'number' ? { quotedCostCents: entry.providerCostCents } : {}),
        estimateType: typeof entry.providerCostCents === 'number' ? 'exact' as const : 'heuristic' as const,
        note: typeof entry.providerCostCents === 'number'
          ? `Provider quote recorded during OCR execution: ${entry.providerCostCents.toFixed(4)}¢`
          : 'deAPI OCR pricing is available from the provider quote endpoint during execution.'
      })
    }
  }

  return targets
}

const toDocumentSourceUrl = (target: string): string => {
  if (isLikelyUrl(target)) {
    return target
  }

  return `file://${pathResolve(target)}`
}

export const buildExtractionCallOpts = (target: string, baseDir: string, opts: RuntimeOptions): Partial<ExtractionOptions> => {
  const step2SelectionOrigins = opts.step2SelectionOrigins
    ? Object.fromEntries(
        Object.entries(opts.step2SelectionOrigins).filter(([, value]) => value !== undefined)
      ) as Record<string, 'default' | 'explicit' | 'all-shortcut'>
    : undefined
  const extractionOpts: Partial<ExtractionOptions> = {
    filePath: target,
    outputDir: baseDir || opts.outputRootDir,
    dpi: opts.dpi,
    languages: opts.lang,
    oem: opts.oem,
    psm: opts.psm,
    outputFormat: opts.out,
    pdfChapterMode: opts.pdfChapterMode,
    ocrProviderConcurrency: opts.ocrProviderConcurrency,
    ocrLocalConcurrency: opts.ocrLocalConcurrency,
    primaryOcr: opts.primaryOcr,
    preserveInterwordSpaces: opts.preserveSpaces,
    rotate: opts.rotate
  }

  if (opts.pdfChapterMode !== 'local' && hasConfiguredLlmProvider(opts)) {
    const llmConfig = resolveLLMDefaults(opts)
    if (typeof llmConfig.llmService === 'string' && typeof llmConfig.llmModel === 'string') {
      extractionOpts.pdfChapterLlmService = llmConfig.llmService
      extractionOpts.pdfChapterLlmModel = llmConfig.llmModel
    }
  }

  if (opts.password) {
    extractionOpts.password = opts.password
  }
  if (opts.pageSeparator) {
    extractionOpts.pageSeparator = opts.pageSeparator
  }
  if (opts.useTesseract) {
    extractionOpts.useTesseract = true
  }
  if (opts.useOcrmypdf) {
    extractionOpts.useOcrmypdf = true
  }
  if (opts.usePaddleOcr) {
    extractionOpts.usePaddleOcr = true
  }
  if (opts.mistralOcrModel) {
    extractionOpts.mistralOcrModel = opts.mistralOcrModel
  }
  if (opts.mistralOcrModels) {
    extractionOpts.mistralOcrModels = opts.mistralOcrModels
  }
  if (opts.glmOcrModel) {
    extractionOpts.glmOcrModel = opts.glmOcrModel
  }
  if (opts.glmOcrModels) {
    extractionOpts.glmOcrModels = opts.glmOcrModels
  }
  if (opts.kimiOcrModel) {
    extractionOpts.kimiOcrModel = opts.kimiOcrModel
  }
  if (opts.kimiOcrModels) {
    extractionOpts.kimiOcrModels = opts.kimiOcrModels
  }
  if (opts.openaiOcrModel) {
    extractionOpts.openaiOcrModel = opts.openaiOcrModel
  }
  if (opts.openaiOcrModels) {
    extractionOpts.openaiOcrModels = opts.openaiOcrModels
  }
  if (opts.anthropicOcrModel) {
    extractionOpts.anthropicOcrModel = opts.anthropicOcrModel
  }
  if (opts.anthropicOcrModels) {
    extractionOpts.anthropicOcrModels = opts.anthropicOcrModels
  }
  if (opts.geminiOcrModel) {
    extractionOpts.geminiOcrModel = opts.geminiOcrModel
  }
  if (opts.geminiOcrModels) {
    extractionOpts.geminiOcrModels = opts.geminiOcrModels
  }
  if (opts.deepinfraOcrModel) {
    extractionOpts.deepinfraOcrModel = opts.deepinfraOcrModel
  }
  if (opts.deepinfraOcrModels) {
    extractionOpts.deepinfraOcrModels = opts.deepinfraOcrModels
  }
  if (opts.awsTextractModel) {
    extractionOpts.awsTextractModel = opts.awsTextractModel
  }
  if (opts.awsTextractModels) {
    extractionOpts.awsTextractModels = opts.awsTextractModels
  }
  if (opts.gcloudDocaiModel) {
    extractionOpts.gcloudDocaiModel = opts.gcloudDocaiModel
  }
  if (opts.gcloudDocaiModels) {
    extractionOpts.gcloudDocaiModels = opts.gcloudDocaiModels
  }
  if (opts.deapiOcrModel) {
    extractionOpts.deapiOcrModel = opts.deapiOcrModel
  }
  if (opts.deapiOcrModels) {
    extractionOpts.deapiOcrModels = opts.deapiOcrModels
  }
  if (opts.epubChapterFiles) {
    extractionOpts.epubChapterFiles = true
  }
  if (typeof opts.epubChunkLimitChars === 'number') {
    extractionOpts.epubChunkLimitChars = opts.epubChunkLimitChars
  }
  if (opts.useEpubBun) {
    extractionOpts.useEpubBun = true
  }
  if (opts.useEpubCalibre) {
    extractionOpts.useEpubCalibre = true
  }
  if (step2SelectionOrigins) {
    extractionOpts.step2SelectionOrigins = step2SelectionOrigins
  }

  return extractionOpts
}
const writeDocumentOutputMetadata = async (
  outputDir: string,
  params: WriteDocumentOutputMetadataOptions
): Promise<void> => {
  const {
    step1,
    step2,
    step3,
    mistralOcrModel,
    glmOcrModel,
    kimiOcrModel,
    openaiOcrModel,
    anthropicOcrModel,
    geminiOcrModel,
    deepinfraOcrModel,
    deapiOcrModel,
    artifactFiles,
    completionStatus,
    requestedProviders,
    providerStates,
    missingProviders,
    web,
    errors
  } = params
  const extractTargets = collectEstimatedExtractTargets(step2, {
    mistralOcrModel,
    glmOcrModel,
    kimiOcrModel,
    openaiOcrModel,
    anthropicOcrModel,
    geminiOcrModel,
    deepinfraOcrModel,
    deapiOcrModel
  })

  const estimated = computeEstimatedCosts({
    applyCostMultipliers: false,
    extractTargets,
    llmTargets: (Array.isArray(step3) ? step3 : [step3]).map((entry) => ({
      service: entry.llmService,
      model: entry.llmModel,
      inputTokens: entry.inputTokenCount,
      outputTokens: entry.outputTokenCount
    })),
    skipLLM: false
  })
  const actual = computeActualCosts({ step2, step3 })
  const cost = { estimated, actual }

  const estimatedTiming = computeEstimatedProcessingTimes({
    extractTargets: extractTargets.map((target) => ({
      provider: target.provider,
      model: target.model,
      pageCount: target.pageCount ?? step1.pageCount
    })),
    llmTargets: (Array.isArray(step3) ? step3 : [step3]).map((entry) => ({
      service: entry.llmService,
      model: entry.llmModel,
      inputTokens: entry.inputTokenCount,
      outputTokens: entry.outputTokenCount
    })),
    skipLLM: false,
  })
  const actualTiming = computeActualProcessingTimes({ step1, step2, step3 })
  const timing = estimatedTiming.steps.length > 0 || actualTiming.steps.length > 0
    ? { estimated: estimatedTiming, actual: actualTiming }
    : undefined

  const manifestMetadata = {
    step1,
    step2,
    ...(completionStatus ? { completionStatus } : {}),
    ...(requestedProviders ? { requestedProviders } : {}),
    ...(providerStates ? { providerStates } : {}),
    ...(missingProviders ? { missingProviders } : {}),
    step3,
    ...(web ? { web } : {}),
    cost,
    ...(timing ? { timing } : {}),
    ...(errors && errors.length > 0 ? { errors } : {}),
  }

  await writeRunManifest(outputDir, 'write', manifestMetadata)
  logWriteManifestConsoleSummary(outputDir, manifestMetadata, {
    promptArtifact: typeof artifactFiles['prompt'] === 'string' ? artifactFiles['prompt'] : 'prompt.md',
    ...(typeof artifactFiles['rendered'] === 'string' ? { step3RenderedOutput: artifactFiles['rendered'] } : {})
  })

  l.report.complete(outputDir, artifactFiles)
}

export const appendChapterExportArtifacts = (
  artifactFiles: Record<string, string>,
  step2Metadata: ExtractionMetadata | ExtractionMetadata[]
): void => {
  const primary = Array.isArray(step2Metadata) ? step2Metadata[0] : step2Metadata
  const exportSummary = primary?.chapterExport ?? primary?.epubExport
  if (!exportSummary || !Array.isArray(exportSummary.directories)) {
    return
  }

  if (exportSummary.directories.includes('chapters')) {
    artifactFiles['chapters'] = 'chapters/'
  }
  if (exportSummary.directories.includes('chunks')) {
    artifactFiles['chunks'] = 'chunks/'
  }
}

export const runDocumentWrite = async (
  target: string,
  baseDir: string,
  opts: RuntimeOptions,
  sourceRef?: Step1SourceRef,
  preparedDocument?: PreparedDocument,
  batchChildContext?: BatchChildRunContext
): Promise<{ outputDir: string }> => {
  const llmConfig = resolveLLMDefaults(opts)
  const resolvedPreparedDocument = preparedDocument ?? (batchChildContext
    ? await downloadDocument(target, baseDir || opts.outputRootDir, opts.password, sourceRef, batchChildContext)
    : undefined)
  const extraction = await processOcr(
    target,
    buildExtractionCallOpts(target, baseDir, opts),
    sourceRef,
    resolvedPreparedDocument
  )

  const documentMeta: VideoMetadata = {
    title: extraction.step1Metadata.title ?? 'Document',
    duration: 'Unknown',
    channel: extraction.step1Metadata.author ?? 'Unknown',
    description: '',
    url: sourceRef?.url ?? toDocumentSourceUrl(target)
  }
  const transcriptionLike: TranscriptionResult = {
    text: extraction.result.text,
    segments: [{
      start: '00:00:00',
      end: '00:00:00',
      text: extraction.result.text
    }]
  }

  const step3Runs = await runLLM(documentMeta, transcriptionLike, {
    outputDir: extraction.outputDir,
    prompts: opts.prompts,
    promptFile: opts.promptFile,
    openaiModels: llmConfig.openaiModels,
    openaiModel: llmConfig.openaiModel,
    groqModels: llmConfig.groqModels,
    groqModel: llmConfig.groqModel,
    geminiModels: llmConfig.geminiModels,
    geminiModel: llmConfig.geminiModel,
    anthropicModels: llmConfig.anthropicModels,
    anthropicModel: llmConfig.anthropicModel,
    minimaxModels: llmConfig.minimaxModels,
    minimaxModel: llmConfig.minimaxModel,
    grokModels: llmConfig.grokModels,
    grokModel: llmConfig.grokModel,
    glmModels: llmConfig.glmModels,
    glmModel: llmConfig.glmModel,
    kimiModels: llmConfig.kimiModels,
    kimiModel: llmConfig.kimiModel,
    llamaModels: llmConfig.llamaModels,
    llamaModel: llmConfig.llamaModel,
    llmProviderConcurrency: opts.llmProviderConcurrency,
    llmLocalConcurrency: opts.llmLocalConcurrency,
    promptBuilder: (instruction: string) =>
      buildDocumentPrompt(extraction.result.text, extraction.step1Metadata, instruction)
  })

  const step3Results = step3Runs.map((entry) => entry.metadata)
  if (step3Results.length === 0) {
    throw new Error('No LLM outputs generated for document write')
  }

  const renderedArtifacts = await writeRenderedTextArtifacts({
    outputDir: extraction.outputDir,
    results: step3Runs,
    writeInternal: opts.renderedText,
    sourcePath: sourceRef?.filePath ?? target,
    trackListPath: opts.trackList,
    externalDir: opts.renderedOutDir,
    externalBaseName: extraction.step1Metadata.slug
  })
  if (renderedArtifacts.externalFiles.length > 0) {
    logLocationsTable(l, [{
      artifact: 'renderedOutDir',
      path: opts.renderedOutDir,
      detail: `${renderedArtifacts.externalFiles.length} file${renderedArtifacts.externalFiles.length === 1 ? '' : 's'}`
    }])
  }

  const step3Serialized: Step3Metadata | Step3Metadata[] = step3Results.length === 1 ? step3Results[0]! : step3Results
  const llmInputTokenCount = step3Results.reduce((sum, item) => sum + item.inputTokenCount, 0)
  const llmOutputTokenCount = step3Results.reduce((sum, item) => sum + item.outputTokenCount, 0)
  const llmService = step3Results[0]?.llmService ?? 'llama.cpp'
  const llmModel = step3Results[0]?.llmModel ?? (llmConfig.llamaModel ?? 'unknown')

  const artifactFiles: Record<string, string> = {
    prompt: 'prompt.md',
    run: 'run.json',
    ...renderedArtifacts.internalArtifacts
  }
  appendChapterExportArtifacts(artifactFiles, extraction.step2Metadata)
  if (step3Results.length === 1) {
    artifactFiles['summary'] = step3Results[0]?.outputFileName ?? 'text.json'
  } else {
    for (const step3 of step3Results) {
      artifactFiles[`summary-${step3.llmModel}`] = step3.outputFileName
    }
  }

  await writeDocumentOutputMetadata(extraction.outputDir, {
    step1: extraction.step1Metadata,
    step2: extraction.step2Metadata,
    step3: step3Serialized,
    mistralOcrModel: opts.mistralOcrModel,
    glmOcrModel: opts.glmOcrModel,
    kimiOcrModel: opts.kimiOcrModel,
    openaiOcrModel: opts.openaiOcrModel,
    anthropicOcrModel: opts.anthropicOcrModel,
    geminiOcrModel: opts.geminiOcrModel,
    deepinfraOcrModel: opts.deepinfraOcrModel,
    deapiOcrModel: opts.deapiOcrModel,
    llmService,
    llmModel,
    llmInputTokenCount,
    llmOutputTokenCount,
    artifactFiles,
    ...(extraction.completionStatus ? { completionStatus: extraction.completionStatus } : {}),
    ...(extraction.requestedProviders ? { requestedProviders: extraction.requestedProviders } : {}),
    ...(extraction.providerStates ? { providerStates: extraction.providerStates } : {}),
    ...(extraction.missingProviders ? { missingProviders: extraction.missingProviders } : {}),
    ...(extraction.web ? { web: extraction.web } : {}),
    ...(extraction.step2Errors ? { errors: extraction.step2Errors } : {})
  })
  return { outputDir: extraction.outputDir }
}
