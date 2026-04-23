import { basename, resolve as pathResolve } from 'node:path'
import * as l from '~/logger'
import { createHumanTable, logLocationsTable } from '~/logger/human-table'
import { validateData } from '~/utils/validate/validation'
import { normalizeBatchChildPublishedAt, reserveBatchChildOutputDir } from '~/cli/commands/process-steps/batch-child-output'
import { ProcessingOptionsSchema, type BatchChildRunContext, type ProcessingOptions, type Step1SourceRef, type Step3Metadata, type VideoMetadata, type TranscriptionResult, type DocumentMetadata, type ExtractionMetadata, type PreparedDocument, type WebArticleMetadata, type WriteDocumentOutputMetadataOptions } from '~/types'
import { processVideo } from '~/cli/commands/process-steps/process-video'
import { processStt } from '~/cli/commands/process-steps/process-stt'
import type { SttBatchCoordinator } from '~/cli/commands/process-steps/step-2-stt/batch'
import { runLLM } from '~/cli/commands/process-steps/step-3-write/run-llm'
import { ensureDirectory, fileExists } from '~/utils/cli-utils'
import {
  buildMediaStep1Slug,
  createUniqueDirectoryName,
  extractSourceMetadata
} from '~/cli/commands/process-steps/step-1-download/audio/metadata-utils'
import { downloadAudio } from '~/cli/commands/process-steps/step-1-download/audio/dl-audio'
import { downloadDocument, prepareDocumentMetadata } from '~/cli/commands/process-steps/step-1-download/document/dl-document'
import { prepareHtmlArticle } from '~/cli/commands/process-steps/step-1-download/document/prepare-html-article'
import { downloadDocumentUrlToTempFile } from '~/cli/commands/process-steps/step-1-download/document/resolve-document-source'
import { processOcr } from '~/cli/commands/process-steps/process-ocr'
import { detectDocumentFormat } from '~/cli/commands/process-steps/step-1-download/document/detect-format'
import { buildDocumentPrompt } from '~/cli/commands/process-steps/step-2-ocr/ocr-utils/doc-prompt-utils'
import { formatMetadataAsFrontmatter } from '~/cli/commands/process-steps/step-0-metadata/format-metadata-frontmatter'
import type { ExtractionOptions } from '~/types'
import type { ProcessCommand, RuntimeOptions, AggregatedPriceEstimate } from '~/types'
import { canonicalizeProcessCommand, isOcrCommand, isSttCommand } from '~/cli/commands/process-steps/process-command-kinds'
import { CLIUsageError } from '~/utils/error-handler'
import {
  classifyInputFamily,
  classifyUrlInput,
  describeUnsupportedInputForCommand,
  isDocumentByExtension,
  isHtmlDocumentPath,
  isLikelyUrl
} from './target-utils'
import { resolveLLMDefaults } from './llm-defaults'
import { computeActualCosts, computeEstimatedCosts } from '~/utils/pricing/compute-costs'
import { computeActualProcessingTimes, computeEstimatedProcessingTimes } from '~/utils/pricing/compute-processing-time'
import { FIRECRAWL_PRICE_NOTE } from '~/cli/commands/process-steps/step-2-ocr/ocr-utils/extract-pricing'
import type { BatchItem, BatchItemProcessResult } from '~/types'
import { writeRunManifest } from '~/cli/commands/process-steps/manifest-utils'
import { runTextWrite } from '~/cli/commands/process-steps/step-3-write/run-text-write'
import { isTextInputPath, writeRenderedTextArtifacts } from '~/cli/commands/process-steps/step-3-write/text-input-utils'
import { logWriteManifestConsoleSummary } from '~/cli/commands/process-steps/write-manifest-log'
import {
  formatHtmlArticleOcrFlagsIgnoredWarning,
  hasConfiguredOcrProviderSelection
} from '~/cli/commands/process-steps/step-2-shared/inactive-flag-warnings'

const buildDocumentMetadataView = (
  step1: DocumentMetadata,
  web?: WebArticleMetadata
): Record<string, unknown> => ({
  ...(step1.title ? { title: step1.title } : {}),
  slug: step1.slug,
  ...(step1.author ? { author: step1.author } : {}),
  pageCount: step1.pageCount,
  format: step1.format,
  fileSize: step1.fileSize,
  ...(step1.sourceFormat ? { sourceFormat: step1.sourceFormat } : {}),
  ...(step1.normalizedFormat ? { normalizedFormat: step1.normalizedFormat } : {}),
  ...(step1.conversionChain ? { conversionChain: step1.conversionChain } : {}),
  ...(step1.metadataSchemaVersion ? { metadataSchemaVersion: step1.metadataSchemaVersion } : {}),
  ...(web ? { web } : {})
})

const hasConfiguredLlmProvider = (opts: RuntimeOptions): boolean =>
  [
    ...(opts.llamaModels ?? (opts.llamaModel ? [opts.llamaModel] : [])),
    ...(opts.openaiModels ?? (opts.openaiModel ? [opts.openaiModel] : [])),
    ...(opts.groqModels ?? (opts.groqModel ? [opts.groqModel] : [])),
    ...(opts.geminiModels ?? (opts.geminiModel ? [opts.geminiModel] : [])),
    ...(opts.anthropicModels ?? (opts.anthropicModel ? [opts.anthropicModel] : [])),
    ...(opts.minimaxModels ?? (opts.minimaxModel ? [opts.minimaxModel] : [])),
    ...(opts.grokModels ?? (opts.grokModel ? [opts.grokModel] : []))
  ].some((value) => typeof value === 'string' && value.length > 0)

const collectEstimatedExtractTargets = (
  metadata: ExtractionMetadata | ExtractionMetadata[],
  opts: Pick<RuntimeOptions, 'mistralOcrModel' | 'glmOcrModel' | 'openaiOcrModel' | 'anthropicOcrModel' | 'geminiOcrModel'>
): Array<{
  provider: 'mistral' | 'glm' | 'openai' | 'anthropic' | 'gemini' | 'firecrawl'
  model: string
  pageCount?: number
  promptTokens?: number
  completionTokens?: number
  estimateType?: 'heuristic' | 'exact'
  note?: string
}> => {
  const targets: Array<{
    provider: 'mistral' | 'glm' | 'openai' | 'anthropic' | 'gemini' | 'firecrawl'
    model: string
    pageCount?: number
    promptTokens?: number
    completionTokens?: number
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
    }
  }

  return targets
}

const warnHtmlArticleFlagBehavior = (target: string, opts: RuntimeOptions, backend: PreparedDocument['htmlArticleBackend']): void => {
  if (hasConfiguredOcrProviderSelection(opts)) {
    l.warn(formatHtmlArticleOcrFlagsIgnoredWarning(target))
  }
  if (backend === 'firecrawl') {
    l.info('Article extraction backend: firecrawl')
  } else if (backend === 'glm-reader') {
    l.info('Article extraction backend: glm-reader')
  }
}

const prepareArticleDocument = async (
  source: string,
  baseDir: string,
  opts: RuntimeOptions,
  batchChildContext?: BatchChildRunContext
): Promise<PreparedDocument> => {
  const effectiveBaseDir = baseDir && baseDir.trim().length > 0 ? baseDir : './output'
  const prepared = await prepareHtmlArticle(source, effectiveBaseDir, opts.urlBackend, batchChildContext)
  warnHtmlArticleFlagBehavior(source, opts, prepared.htmlArticleBackend)
  return prepared
}

const toDocumentSourceUrl = (target: string): string => {
  if (isLikelyUrl(target)) {
    return target
  }

  return `file://${pathResolve(target)}`
}

const throwUnsupportedProcessInput = (
  command: ProcessCommand,
  item: string,
  family: 'media' | 'document' | 'html_article' | 'unsupported'
): never => {
  throw CLIUsageError(`Unsupported ${command} input "${item}". ${describeUnsupportedInputForCommand(command, family)}`)
}

const buildExtractionCallOpts = (target: string, baseDir: string, opts: RuntimeOptions): Partial<ExtractionOptions> => {
  const step2SelectionOrigins = opts.step2SelectionOrigins
    ? Object.fromEntries(
        Object.entries(opts.step2SelectionOrigins).filter(([, value]) => value !== undefined)
      ) as Record<string, 'default' | 'explicit' | 'all-shortcut'>
    : undefined
  const extractionOpts: Partial<ExtractionOptions> = {
    filePath: target,
    outputDir: baseDir || './output',
    dpi: opts.dpi,
    languages: opts.lang,
    oem: opts.oem,
    psm: opts.psm,
    outputFormat: opts.out,
    pdfChapterMode: opts.pdfChapterMode,
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
  if (opts.glmOcrModel) {
    extractionOpts.glmOcrModel = opts.glmOcrModel
  }
  if (opts.openaiOcrModel) {
    extractionOpts.openaiOcrModel = opts.openaiOcrModel
  }
  if (opts.anthropicOcrModel) {
    extractionOpts.anthropicOcrModel = opts.anthropicOcrModel
  }
  if (opts.geminiOcrModel) {
    extractionOpts.geminiOcrModel = opts.geminiOcrModel
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
    openaiOcrModel,
    anthropicOcrModel,
    geminiOcrModel,
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
    openaiOcrModel,
    anthropicOcrModel,
    geminiOcrModel
  })

  const estimated = computeEstimatedCosts({
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

const appendChapterExportArtifacts = (
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

const runDocumentWrite = async (
  target: string,
  baseDir: string,
  opts: RuntimeOptions,
  sourceRef?: Step1SourceRef,
  preparedDocument?: PreparedDocument,
  batchChildContext?: BatchChildRunContext
): Promise<{ outputDir: string }> => {
  const llmConfig = resolveLLMDefaults(opts)
  const resolvedPreparedDocument = preparedDocument ?? (batchChildContext
    ? await downloadDocument(target, baseDir || './output', opts.password, sourceRef, batchChildContext)
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
    author: extraction.step1Metadata.author ?? 'Unknown',
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
    llamaModels: llmConfig.llamaModels,
    llamaModel: llmConfig.llamaModel,
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
    openaiOcrModel: opts.openaiOcrModel,
    anthropicOcrModel: opts.anthropicOcrModel,
    geminiOcrModel: opts.geminiOcrModel,
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

const processMediaSingle = async (
  target: string,
  baseDir: string,
  llmDefaults: RuntimeOptions,
  preflightEstimate?: AggregatedPriceEstimate,
  batchChildContext?: BatchChildRunContext
): Promise<{ outputDir: string, info: { url: string, title: string, channel: string, channelUrl?: string, publishDate?: string, duration: string } }> => {
  const llmConfig = resolveLLMDefaults(llmDefaults)

  if (llmDefaults.split) {
    l.info('Audio will be split into 30-minute segments for transcription')
  }

  const isUrl = isLikelyUrl(target)
  const exists = await fileExists(target)
  const srcUrl = isUrl ? target : exists ? `file://${target}` : target

  const src: { url?: string, filePath?: string } = {}
  if (isUrl) {
    src.url = target
  }
  if (!isUrl && exists) {
    src.filePath = target
  }

  const meta = await extractSourceMetadata(src)
  const batchOutputDir = await reserveBatchChildOutputDir(batchChildContext, {
    title: meta.title,
    publishedAt: meta.publishDate,
    fallbackLabel: meta.title
  })

  const baseOptions: Record<string, unknown> = {
    ...(isUrl ? { url: target } : exists ? { filePath: target } : { url: target }),
    whisperModels: llmDefaults.whisperModels,
    whisperModel: llmDefaults.whisperModel,
    youtubeCaptions: llmDefaults.youtubeCaptions,
    gcloudSttModels: llmDefaults.gcloudSttModels,
    gcloudSttModel: llmDefaults.gcloudSttModel,
    awsSttModels: llmDefaults.awsSttModels,
    awsSttModel: llmDefaults.awsSttModel,
    deepinfraSttModels: llmDefaults.deepinfraSttModels,
    deepinfraSttModel: llmDefaults.deepinfraSttModel,
    awsRegion: llmDefaults.awsRegion,
    awsBucket: llmDefaults.awsBucket,
    groqSttModels: llmDefaults.groqSttModels,
    groqSttModel: llmDefaults.groqSttModel,
    elevenlabsSttModels: llmDefaults.elevenlabsSttModels,
    elevenlabsSttModel: llmDefaults.elevenlabsSttModel,
    deepgramSttModels: llmDefaults.deepgramSttModels,
    deepgramSttModel: llmDefaults.deepgramSttModel,
    sonioxSttModels: llmDefaults.sonioxSttModels,
    sonioxSttModel: llmDefaults.sonioxSttModel,
    speechmaticsSttModels: llmDefaults.speechmaticsSttModels,
    speechmaticsSttModel: llmDefaults.speechmaticsSttModel,
    revSttModels: llmDefaults.revSttModels,
    revSttModel: llmDefaults.revSttModel,
    mistralSttModels: llmDefaults.mistralSttModels,
    mistralSttModel: llmDefaults.mistralSttModel,
    assemblyaiSttModels: llmDefaults.assemblyaiSttModels,
    assemblyaiSttModel: llmDefaults.assemblyaiSttModel,
    gladiaSttModels: llmDefaults.gladiaSttModels,
    gladiaSttModel: llmDefaults.gladiaSttModel,
    diarizationSpeakerCount: llmDefaults.diarizationSpeakerCount,
    refreshCache: llmDefaults.refreshCache,
    noCache: llmDefaults.noCache,
    llamaModels: llmConfig.llamaModels,
    llamaModel: llmConfig.llamaModel,
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
    outputDir: baseDir,
    useReverb: llmDefaults.useReverb,
    reverbVerbatimicity: llmDefaults.reverbVerbatimicity,
    split: llmDefaults.split,
    skipLLM: llmDefaults.skipLLM,
    prompts: llmDefaults.prompts,
    promptFile: llmDefaults.promptFile,
    renderedText: llmDefaults.renderedText,
    renderedOutDir: llmDefaults.renderedOutDir,
    trackList: llmDefaults.trackList,
    ttsSpeaker: llmDefaults.ttsSpeaker,
    kittenTtsModels: llmDefaults.kittenTtsModels,
    kittenTtsModel: llmDefaults.kittenTtsModel,
    groqTtsModels: llmDefaults.groqTtsModels,
    groqTtsModel: llmDefaults.groqTtsModel,
    groqVoiceId: llmDefaults.groqVoiceId,
    openaiTtsModels: llmDefaults.openaiTtsModels,
    openaiTtsModel: llmDefaults.openaiTtsModel,
    openaiVoiceId: llmDefaults.openaiVoiceId,
    geminiTtsModels: llmDefaults.geminiTtsModels,
    geminiTtsModel: llmDefaults.geminiTtsModel,
    geminiVoiceId: llmDefaults.geminiVoiceId,
    geminiSpeaker1Name: llmDefaults.geminiSpeaker1Name,
    geminiSpeaker1Voice: llmDefaults.geminiSpeaker1Voice,
    geminiSpeaker2Name: llmDefaults.geminiSpeaker2Name,
    geminiSpeaker2Voice: llmDefaults.geminiSpeaker2Voice,
    elevenlabsTtsModels: llmDefaults.elevenlabsTtsModels,
    elevenlabsTtsModel: llmDefaults.elevenlabsTtsModel,
    elevenlabsVoiceId: llmDefaults.elevenlabsVoiceId,
    minimaxTtsModels: llmDefaults.minimaxTtsModels,
    minimaxTtsModel: llmDefaults.minimaxTtsModel,
    minimaxTtsVoice: llmDefaults.minimaxTtsVoice,
    geminiImageModels: llmDefaults.geminiImageModels,
    geminiImageModel: llmDefaults.geminiImageModel,
    openaiImageModels: llmDefaults.openaiImageModels,
    openaiImageModel: llmDefaults.openaiImageModel,
    minimaxImageModels: llmDefaults.minimaxImageModels,
    minimaxImageModel: llmDefaults.minimaxImageModel,
    imageAspectRatio: llmDefaults.imageAspectRatio,
    imageSize: llmDefaults.imageSize,
    imageQuality: llmDefaults.imageQuality,
    imageFormat: llmDefaults.imageFormat,
    imageBackground: llmDefaults.imageBackground,
    imagenCount: llmDefaults.imagenCount,
    elevenlabsMusicModels: llmDefaults.elevenlabsMusicModels,
    elevenlabsMusicModel: llmDefaults.elevenlabsMusicModel,
    minimaxMusicModels: llmDefaults.minimaxMusicModels,
    minimaxMusicModel: llmDefaults.minimaxMusicModel,
    musicDuration: llmDefaults.musicDuration,
    musicLyricsFile: llmDefaults.musicLyricsFile,
    musicInstrumental: llmDefaults.musicInstrumental,
    geminiVideoModels: llmDefaults.geminiVideoModels,
    geminiVideoModel: llmDefaults.geminiVideoModel,
    minimaxVideoModels: llmDefaults.minimaxVideoModels,
    minimaxVideoModel: llmDefaults.minimaxVideoModel,
    videoDuration: llmDefaults.videoDuration,
    videoSize: llmDefaults.videoSize,
    videoAspectRatio: llmDefaults.videoAspectRatio,
    videoResolution: llmDefaults.videoResolution,
    mistralOcrModels: llmDefaults.mistralOcrModels,
    mistralOcrModel: llmDefaults.mistralOcrModel,
    glmOcrModels: llmDefaults.glmOcrModels,
    glmOcrModel: llmDefaults.glmOcrModel,
    openaiOcrModels: llmDefaults.openaiOcrModels,
    openaiOcrModel: llmDefaults.openaiOcrModel,
    anthropicOcrModels: llmDefaults.anthropicOcrModels,
    anthropicOcrModel: llmDefaults.anthropicOcrModel,
    geminiOcrModels: llmDefaults.geminiOcrModels,
    geminiOcrModel: llmDefaults.geminiOcrModel
  }

  const options: ProcessingOptions = validateData(ProcessingOptionsSchema, baseOptions, 'processing options')

  const outDir = await processVideo(options, meta, preflightEstimate, {
    ...(batchOutputDir ? { outputDir: batchOutputDir } : {}),
    sttProviderConcurrency: llmDefaults.sttProviderConcurrency,
    sttLocalConcurrency: llmDefaults.sttLocalConcurrency,
    sttSegmentConcurrency: llmDefaults.sttSegmentConcurrency,
  })
  const baseInfo: { url: string, title: string, channel: string, duration: string, channelUrl?: string, publishDate?: string } = {
    url: srcUrl,
    title: meta.title,
    channel: meta.author,
    duration: meta.duration
  }

  if (meta.channelUrl) {
    baseInfo.channelUrl = meta.channelUrl
  }
  if (meta.publishDate) {
    baseInfo.publishDate = meta.publishDate
  }

  return { outputDir: outDir, info: baseInfo }
}

const processOcrSingle = async (
  target: string,
  baseDir: string,
  opts: RuntimeOptions,
  sourceRef?: Step1SourceRef,
  preparedDocument?: PreparedDocument,
  batchChildContext?: BatchChildRunContext
): Promise<{ outputDir: string }> => {
  const resolvedPreparedDocument = preparedDocument ?? (batchChildContext
    ? await downloadDocument(target, baseDir || './output', opts.password, sourceRef, batchChildContext)
    : undefined)
  const extraction = await processOcr(
    target,
    buildExtractionCallOpts(target, baseDir, opts),
    sourceRef,
    resolvedPreparedDocument
  )

  const artifactFiles: Record<string, string> = {
    run: 'run.json'
  }
  switch (opts.out) {
    case 'json':
      artifactFiles['result'] = 'result.json'
      break
    case 'tsv':
      artifactFiles['extraction'] = 'extraction.tsv'
      break
    case 'hocr':
      artifactFiles['extraction'] = 'extraction.hocr'
      break
    default:
      artifactFiles['extraction'] = 'extraction.txt'
      break
  }
  appendChapterExportArtifacts(artifactFiles, extraction.step2Metadata)

  const requestedCount = extraction.requestedProviders?.length ?? 0
  const succeededCount = Array.isArray(extraction.step2Metadata) ? extraction.step2Metadata.length : 1
  const failedCount = extraction.step2Errors?.length ?? 0
  const missingCount = extraction.missingProviders?.length ?? 0
  const requestedMultipleProviders = requestedCount > 1

  if (requestedMultipleProviders && Array.isArray(extraction.providerStates)) {
    for (const state of extraction.providerStates) {
      const artifactDir = typeof state['artifactDir'] === 'string' ? state['artifactDir'] : undefined
      const service = typeof state['service'] === 'string' ? state['service'] : undefined
      const model = typeof state['model'] === 'string' ? state['model'] : undefined
      if (!artifactDir || !service || !model || state['status'] !== 'succeeded') {
        continue
      }
      artifactFiles[`result-${service}-${model}`] = `${artifactDir}/result.json`
    }
  }

  if (extraction.completionStatus === 'incomplete' || extraction.completionStatus === 'failed') {
    const runStatus = {
      completionStatus: extraction.completionStatus,
      requested: requestedCount,
      succeeded: succeededCount,
      failed: failedCount,
      missing: missingCount
    }
    l.write('warn', 'Run Status', {
      category: 'pipeline',
      humanTable: createHumanTable([runStatus], ['completionStatus', 'requested', 'succeeded', 'failed', 'missing']),
      metadata: runStatus
    })

    if (failedCount > 0 && extraction.step2Errors) {
      const failureRows = extraction.step2Errors.map((failure) => ({
        provider: `${failure.service}/${failure.model}`,
        detail: failure.message
      }))
      l.write('warn', 'Provider Failures', {
        category: 'pipeline',
        humanTable: createHumanTable(failureRows, ['provider', 'detail']),
        metadata: { failures: failureRows }
      })
    }

    logLocationsTable(l, [{ artifact: 'retryOutputDir', path: extraction.outputDir }], { level: 'warn' })
    return { outputDir: extraction.outputDir }
  }

  l.report.complete(extraction.outputDir, artifactFiles, requestedMultipleProviders
    ? {
        metrics: {
          providersRequested: requestedCount,
          providersSucceeded: succeededCount,
          providersFailed: failedCount,
          partial: false,
          completionStatus: extraction.completionStatus ?? 'full'
        }
      }
    : undefined)
  return { outputDir: extraction.outputDir }
}

const writeMetadataTerminalOutput = (metadata: Record<string, unknown>, markdown: boolean): void => {
  if (markdown) {
    process.stdout.write(formatMetadataAsFrontmatter(metadata) + '\n')
    return
  }

  console.log(JSON.stringify(metadata, null, 2))
}

const writeSavedMetadataArtifacts = async (
  outputDir: string,
  metadata: Record<string, unknown>,
  markdown: boolean,
  save: boolean
): Promise<void> => {
  await writeRunManifest(outputDir, 'metadata', { step1: metadata })

  const artifactFiles: Record<string, string> = { run: 'run.json' }
  if (save && markdown) {
    await Bun.write(`${outputDir}/metadata.md`, formatMetadataAsFrontmatter(metadata))
    artifactFiles['metadataMarkdown'] = 'metadata.md'
  }

  if (save) {
    l.report.complete(outputDir, artifactFiles)
  }
}

const normalizeBatchItemDuration = (duration?: string): string | undefined => {
  if (!duration || duration.length === 0) {
    return undefined
  }

  if (duration.includes(':')) {
    return duration
  }

  if (!/^\d+$/.test(duration)) {
    return duration
  }

  const totalSeconds = Number.parseInt(duration, 10)
  if (!Number.isFinite(totalSeconds) || totalSeconds < 0) {
    return duration
  }

  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
  }

  return `${minutes}:${String(seconds).padStart(2, '0')}`
}

const mergeBatchItemMetadata = (
  meta: VideoMetadata,
  batchItem?: BatchItem
): VideoMetadata => {
  if (!batchItem) {
    return meta
  }

  const publishDate = normalizeBatchChildPublishedAt(batchItem.publishedAt)
  const duration = normalizeBatchItemDuration(batchItem.duration)

  return {
    ...meta,
    ...(batchItem.title ? { title: batchItem.title } : {}),
    ...(batchItem.author ? { author: batchItem.author } : {}),
    ...(duration ? { duration } : {}),
    ...(publishDate ? { publishDate } : {})
  }
}

const buildDownloadManifestEntry = (
  step1Metadata: Record<string, unknown>,
  web?: WebArticleMetadata
): Record<string, unknown> => ({
  step1: step1Metadata,
  ...(web ? { web } : {}),
  cost: {
    estimated: { totalCost: 0, steps: [] as never[] },
    actual: { totalCost: 0, steps: [] as never[] }
  }
})

const processMetadataMedia = async (
  target: string,
  opts: RuntimeOptions,
  baseDir: string,
  batchItem?: BatchItem,
  batchChildContext?: BatchChildRunContext
): Promise<BatchItemProcessResult> => {
  const isUrl = isLikelyUrl(target)
  const exists = await fileExists(target)

  const src: { url?: string, filePath?: string } = {}
  if (isUrl) src.url = target
  if (!isUrl && exists) src.filePath = target

  const meta = mergeBatchItemMetadata(await extractSourceMetadata(src), batchItem)
  const slug = buildMediaStep1Slug(src, meta)

  const metadata = {
    title: meta.title,
    slug,
    duration: meta.duration,
    author: meta.author,
    url: meta.url,
    ...(meta.publishDate ? { publishDate: meta.publishDate } : {}),
    ...(meta.thumbnail ? { thumbnail: meta.thumbnail } : {}),
    ...(meta.channelUrl ? { channelUrl: meta.channelUrl } : {}),
    ...(meta.chapters?.length ? { chapters: meta.chapters } : {}),
    ...(meta.description?.length ? { description: meta.description } : {})
  }

  writeMetadataTerminalOutput(metadata, opts.markdown)

  const effectiveBaseDir = baseDir?.trim().length > 0 ? baseDir : './output'
  const outputDir = await reserveBatchChildOutputDir(batchChildContext, {
    title: meta.title,
    publishedAt: meta.publishDate,
    fallbackLabel: meta.title
  }) ?? `${effectiveBaseDir}/${createUniqueDirectoryName(meta.title)}`
  await ensureDirectory(outputDir)
  await writeSavedMetadataArtifacts(outputDir, metadata, opts.markdown, opts.save)
  return { outputDir }
}

const processMetadataDocument = async (
  target: string,
  opts: RuntimeOptions,
  baseDir: string,
  password?: string,
  sourceRef?: Step1SourceRef,
  batchChildContext?: BatchChildRunContext
): Promise<BatchItemProcessResult> => {
  const prepared = await prepareDocumentMetadata(target, password, sourceRef)
  try {
    const step1 = prepared.step1Metadata
    const title = step1.title ?? basename(target).replace(/\.[^.]+$/, '')
    const metadata = {
      ...(step1.title ? { title: step1.title } : {}),
      slug: step1.slug,
      ...(step1.author ? { author: step1.author } : {}),
      pageCount: step1.pageCount,
      format: step1.format,
      fileSize: step1.fileSize,
      ...(step1.sourceFormat ? { sourceFormat: step1.sourceFormat } : {}),
      ...(step1.normalizedFormat ? { normalizedFormat: step1.normalizedFormat } : {}),
      ...(step1.conversionChain ? { conversionChain: step1.conversionChain } : {}),
      ...(step1.metadataSchemaVersion ? { metadataSchemaVersion: step1.metadataSchemaVersion } : {})
    }

    writeMetadataTerminalOutput(metadata, opts.markdown)

    const effectiveBaseDir = baseDir?.trim().length > 0 ? baseDir : './output'
    const outputDir = await reserveBatchChildOutputDir(batchChildContext, {
      slug: step1.slug,
      fallbackLabel: title
    }) ?? `${effectiveBaseDir}/${createUniqueDirectoryName(title)}`
    await ensureDirectory(outputDir)
    await writeSavedMetadataArtifacts(outputDir, metadata, opts.markdown, opts.save)
    return { outputDir }
  } finally {
    if (prepared.tempCleanup) {
      await prepared.tempCleanup()
    }
  }
}

const processMetadataPreparedDocument = async (
  prepared: PreparedDocument,
  opts: RuntimeOptions
): Promise<BatchItemProcessResult> => {
  try {
    const metadata = buildDocumentMetadataView(prepared.step1Metadata, prepared.web)
    writeMetadataTerminalOutput(metadata, opts.markdown)
    await writeSavedMetadataArtifacts(prepared.outputDir, metadata, opts.markdown, opts.save)
    return { outputDir: prepared.outputDir }
  } finally {
    if (prepared.tempCleanup) {
      await prepared.tempCleanup()
    }
  }
}

const processDownloadMedia = async (
  target: string,
  baseDir: string,
  opts: RuntimeOptions,
  batchItem?: BatchItem,
  batchChildContext?: BatchChildRunContext
): Promise<BatchItemProcessResult> => {
  const isUrl = isLikelyUrl(target)
  const exists = await fileExists(target)

  const src: { url?: string, filePath?: string } = {}
  if (isUrl) {
    src.url = target
  }
  if (!isUrl && exists) {
    src.filePath = target
  }

  const meta = mergeBatchItemMetadata(await extractSourceMetadata(src), batchItem)
  const effectiveBaseDir = baseDir && baseDir.trim().length > 0 ? baseDir : './output'
  const useFlatBatchOutput = opts.flatBatch && batchChildContext !== undefined
  const outputDir = useFlatBatchOutput
    ? effectiveBaseDir
    : await reserveBatchChildOutputDir(batchChildContext, {
        title: meta.title,
        publishedAt: meta.publishDate,
        fallbackLabel: meta.title
      }) ?? `${effectiveBaseDir}/${createUniqueDirectoryName(meta.title)}`
  await ensureDirectory(outputDir)

  const dlOpts = {
    ...(isUrl ? { url: target } : exists ? { filePath: target } : { url: target }),
    outputDir,
    ...(batchItem?.directDownload ? { directDownload: true } : {}),
    keepOriginalMedia: opts.keepOriginalMedia
  }

  const { metadata: step1Metadata } = await downloadAudio(dlOpts, meta)
  const manifestEntry = buildDownloadManifestEntry(step1Metadata)

  if (useFlatBatchOutput) {
    l.info(`Saved media file: ${step1Metadata.audioFileName}`)
    return { manifestEntry }
  }

  await writeRunManifest(outputDir, 'download', manifestEntry)

  l.report.complete(outputDir, { audio: step1Metadata.audioFileName, run: 'run.json' })

  return { outputDir }
}

const processDownloadDocument = async (
  target: string,
  baseDir: string,
  opts: RuntimeOptions,
  sourceRef?: Step1SourceRef,
  batchChildContext?: BatchChildRunContext
): Promise<{ outputDir: string }> => {
  const effectiveBaseDir = baseDir && baseDir.trim().length > 0 ? baseDir : './output'
  const prepared = await downloadDocument(target, effectiveBaseDir, opts.password, sourceRef, batchChildContext)
  try {
    const cost = {
      estimated: { totalCost: 0, steps: [] as never[] },
      actual: { totalCost: 0, steps: [] as never[] }
    }

    await writeRunManifest(prepared.outputDir, 'download', { step1: prepared.step1Metadata, cost })

    l.report.complete(prepared.outputDir, { run: 'run.json' })

    return { outputDir: prepared.outputDir }
  } finally {
    if (prepared.tempCleanup) {
      await prepared.tempCleanup()
    }
  }
}

const processDownloadPreparedDocument = async (
  prepared: PreparedDocument
): Promise<{ outputDir: string }> => {
  try {
    const cost = {
      estimated: { totalCost: 0, steps: [] as never[] },
      actual: { totalCost: 0, steps: [] as never[] }
    }

    await writeRunManifest(prepared.outputDir, 'download', {
      step1: prepared.step1Metadata,
      ...(prepared.web ? { web: prepared.web } : {}),
      cost
    })

    l.report.complete(prepared.outputDir, { run: 'run.json' })

    return { outputDir: prepared.outputDir }
  } finally {
    if (prepared.tempCleanup) {
      await prepared.tempCleanup()
    }
  }
}

export const processSingleTarget = async (
  command: ProcessCommand,
  item: string,
  baseDir: string,
  opts: RuntimeOptions,
  preflightEstimate?: AggregatedPriceEstimate,
  runOptions?: {
    sttBatchCoordinator?: SttBatchCoordinator | undefined
    mistralSttPassController?: import('~/cli/commands/process-steps/step-2-stt/stt-services/mistral/mistral-stt-pass-controller').MistralSttPassController | undefined
    batchChildContext?: BatchChildRunContext | undefined
  },
  batchItem?: BatchItem
): Promise<BatchItemProcessResult | void> => {
  const displayCommand = canonicalizeProcessCommand(command)
  const batchChildContext = runOptions?.batchChildContext

  if (command === 'metadata') {
    if (isLikelyUrl(item)) {
      const kind = await classifyUrlInput(item, opts)
      if (kind === 'url_direct_document') {
        const downloaded = await downloadDocumentUrlToTempFile(item)
        try {
          return await processMetadataDocument(downloaded.filePath, opts, baseDir, opts.password, { url: item }, batchChildContext)
        } finally {
          await downloaded.cleanup()
        }
      }
      if (kind === 'url_html_article') {
        const prepared = await prepareArticleDocument(item, baseDir, opts, batchChildContext)
        return await processMetadataPreparedDocument(prepared, opts)
      }
      return await processMetadataMedia(item, opts, baseDir, batchItem, batchChildContext)
    }

    const exists = await fileExists(item)
    if (!exists) {
      throw CLIUsageError(`Input does not exist: ${item}. Run: bun as help metadata`)
    }

    if (isHtmlDocumentPath(item)) {
      const prepared = await prepareArticleDocument(item, baseDir, opts, batchChildContext)
      return await processMetadataPreparedDocument(prepared, opts)
    }

    const isDocExt = isDocumentByExtension(item)
    const detected = isDocExt ? await detectDocumentFormat(item) : null
    if (isDocExt || detected !== null) {
      return await processMetadataDocument(item, opts, baseDir, opts.password, undefined, batchChildContext)
    } else {
      return await processMetadataMedia(item, opts, baseDir, batchItem, batchChildContext)
    }
  }

  if (command === 'download') {
    if (isLikelyUrl(item)) {
      const kind = await classifyUrlInput(item, opts)
      if (kind === 'url_direct_document') {
        const downloaded = await downloadDocumentUrlToTempFile(item)
        try {
          return await processDownloadDocument(downloaded.filePath, baseDir, opts, { url: item }, batchChildContext)
        } finally {
          await downloaded.cleanup()
        }
      }
      if (kind === 'url_html_article') {
        const prepared = await prepareArticleDocument(item, baseDir, opts, batchChildContext)
        return await processDownloadPreparedDocument(prepared)
      }
      return await processDownloadMedia(item, baseDir, opts, batchItem, batchChildContext)
    }

    const exists = await fileExists(item)
    if (!exists) {
      throw CLIUsageError(`Input does not exist: ${item}. Run: bun as help download`)
    }

    if (isHtmlDocumentPath(item)) {
      const prepared = await prepareArticleDocument(item, baseDir, opts, batchChildContext)
      return await processDownloadPreparedDocument(prepared)
    }

    const isDocExt = isDocumentByExtension(item)
    const detected = isDocExt ? await detectDocumentFormat(item) : null
    if (isDocExt || detected !== null) {
      return await processDownloadDocument(item, baseDir, opts, undefined, batchChildContext)
    } else {
      return await processDownloadMedia(item, baseDir, opts, batchItem, batchChildContext)
    }
  }

  if (command === 'write' && opts.textInput) {
    if (isLikelyUrl(item)) {
      throw CLIUsageError('write --text-input only accepts local .md or .txt files or directories')
    }

    if (!isTextInputPath(item)) {
      throw CLIUsageError(`write --text-input only accepts .md or .txt files. Got: ${item}`)
    }

    return await runTextWrite(item, baseDir, opts, batchChildContext)
  }

  if (isLikelyUrl(item)) {
    const kind = await classifyUrlInput(item, opts)
    if (kind === 'url_direct_document') {
      if (isSttCommand(command)) {
        throwUnsupportedProcessInput(command, item, 'document')
      }

        const downloaded = await downloadDocumentUrlToTempFile(item)
        try {
          if (isOcrCommand(command)) {
            return await processOcrSingle(downloaded.filePath, baseDir, opts, { url: item }, undefined, batchChildContext)
          } else {
            return await runDocumentWrite(downloaded.filePath, baseDir, opts, { url: item }, undefined, batchChildContext)
          }
        } finally {
          await downloaded.cleanup()
        }
    }

    if (kind === 'url_html_article') {
      if (isSttCommand(command)) {
        throwUnsupportedProcessInput(command, item, 'html_article')
      }

      const prepared = await prepareArticleDocument(item, baseDir, opts, batchChildContext)
      if (isOcrCommand(command)) {
        return await processOcrSingle(item, baseDir, opts, { url: item }, prepared, batchChildContext)
      }
      return await runDocumentWrite(item, baseDir, opts, { url: item }, prepared, batchChildContext)
    }

    if (isOcrCommand(command)) {
      throwUnsupportedProcessInput(command, item, 'media')
    }

    if (isSttCommand(command)) {
      return {
        outputDir: await processStt({ url: item }, baseDir, opts, preflightEstimate, {
          ...(runOptions?.sttBatchCoordinator ? { batchCoordinator: runOptions.sttBatchCoordinator } : {}),
          ...(runOptions?.mistralSttPassController ? { mistralPassController: runOptions.mistralSttPassController } : {}),
          ...(batchChildContext ? { batchChildContext } : {})
        })
      }
    }

    const result = await processMediaSingle(item, baseDir, opts, preflightEstimate, batchChildContext)
    return { outputDir: result.outputDir }
  }

  const exists = await fileExists(item)
  if (!exists) {
    throw CLIUsageError(`Input does not exist: ${item}. Run: bun as help ${displayCommand}`)
  }

  if (isHtmlDocumentPath(item)) {
    const prepared = await prepareArticleDocument(item, baseDir, opts, batchChildContext)

    if (isOcrCommand(command)) {
      return await processOcrSingle(item, baseDir, opts, undefined, prepared, batchChildContext)
    }

    if (command === 'write') {
      return await runDocumentWrite(item, baseDir, opts, undefined, prepared, batchChildContext)
    }

    if (isSttCommand(command)) {
      throwUnsupportedProcessInput(command, item, 'html_article')
    }
  }

  const family = await classifyInputFamily(item, opts)

  if (isOcrCommand(command)) {
    if (family !== 'document') {
      throwUnsupportedProcessInput(command, item, family)
    }
    return await processOcrSingle(item, baseDir, opts, undefined, undefined, batchChildContext)
  }

  if (command === 'write' && family === 'document') {
    return await runDocumentWrite(item, baseDir, opts, undefined, undefined, batchChildContext)
  }

  if (isSttCommand(command) && family !== 'media') {
    throwUnsupportedProcessInput(command, item, family)
  }

  if (isSttCommand(command)) {
      return {
        outputDir: await processStt({ filePath: item }, baseDir, opts, preflightEstimate, {
          ...(runOptions?.sttBatchCoordinator ? { batchCoordinator: runOptions.sttBatchCoordinator } : {}),
          ...(runOptions?.mistralSttPassController ? { mistralPassController: runOptions.mistralSttPassController } : {}),
          ...(batchChildContext ? { batchChildContext } : {})
        })
      }
  }

  const result = await processMediaSingle(item, baseDir, opts, preflightEstimate, batchChildContext)
  return { outputDir: result.outputDir }
}

export const handleSingleTarget = async (
  resolvedTarget: string,
  command: ProcessCommand,
  opts: RuntimeOptions,
  preflightEstimate?: AggregatedPriceEstimate
): Promise<void> => {
  await processSingleTarget(command, resolvedTarget, '', opts, preflightEstimate)
}
