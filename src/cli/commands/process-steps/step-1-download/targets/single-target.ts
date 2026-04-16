import { basename, join, resolve as pathResolve } from 'node:path'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import * as l from '~/logger'
import { validateData } from '~/utils/validate/validation'
import { ProcessingOptionsSchema, type ProcessingOptions, type Step3Metadata, type VideoMetadata, type TranscriptionResult, type DocumentMetadata, type ExtractionMetadata, type PreparedDocument, type WebArticleMetadata } from '~/types'
import { processVideo } from '~/cli/commands/process-steps/process-video'
import { processStt } from '~/cli/commands/process-steps/process-stt'
import type { SttBatchCoordinator } from '~/cli/commands/process-steps/step-2-stt/stt-batch/stt-batch-coordinator'
import { runLLM } from '~/cli/commands/process-steps/step-3-write/run-llm'
import { ensureDirectory, fileExists, writeFile } from '~/utils/cli-utils'
import {
  buildMediaStep1Slug,
  createUniqueDirectoryName,
  extractSourceMetadata,
  type Step1SourceRef
} from '~/cli/commands/process-steps/step-1-download/audio/metadata-utils'
import { downloadAudio } from '~/cli/commands/process-steps/step-1-download/audio/dl-audio'
import { downloadDocument, prepareDocumentMetadata } from '~/cli/commands/process-steps/step-1-download/document/dl-document'
import { prepareHtmlArticle } from '~/cli/commands/process-steps/step-1-download/document/prepare-html-article'
import { processDocument } from '~/cli/commands/process-steps/process-document'
import { detectDocumentFormat } from '~/cli/commands/process-steps/step-1-download/document/detect-format'
import { buildDocumentPrompt } from '~/cli/commands/process-steps/step-2-document/document-utils/doc-prompt-utils'
import { formatMetadataAsFrontmatter } from '~/cli/commands/process-steps/step-0-metadata/format-metadata-frontmatter'
import { resolvePromptNames } from '~/prompts/prompt-loader'
import type { ExtractionOptions } from '~/types'
import type { ProcessCommand, RuntimeOptions, AggregatedPriceEstimate } from '~/types'
import { canonicalizeProcessCommand, isOcrCommand, isSttCommand } from '~/types'
import { CLIUsageError } from '~/utils/error-handler'
import { classifyUrlInput, isDocumentByExtension, isHtmlDocumentPath, isLikelyUrl } from './target-utils'
import { resolveLLMDefaults } from './llm-defaults'
import { computeActualCosts, computeEstimatedCosts } from '~/utils/pricing/compute-costs'
import { computeActualProcessingTimes, computeEstimatedProcessingTimes } from '~/utils/pricing/compute-processing-time'
import { FIRECRAWL_PRICE_NOTE } from '~/cli/commands/process-steps/step-2-document/document-utils/extract-pricing'
import { estimateTokens } from '~/utils/text-utils'
import type { BatchItem, BatchItemProcessResult } from '~/types'

const extensionFromUrl = (
  url: string,
  contentType?: string | null,
  contentDisposition?: string | null
): string => {
  const lowerContentType = contentType?.toLowerCase() ?? ''
  const lowerContentDisposition = contentDisposition?.toLowerCase() ?? ''

  if (lowerContentDisposition.includes('.epub') || lowerContentType.includes('application/epub+zip')) return '.epub'
  if (lowerContentDisposition.includes('.docx') || lowerContentType.includes('application/vnd.openxmlformats-officedocument.wordprocessingml.document')) return '.docx'
  if (lowerContentDisposition.includes('.pptx') || lowerContentType.includes('application/vnd.openxmlformats-officedocument.presentationml.presentation')) return '.pptx'
  if (lowerContentDisposition.includes('.xlsx') || lowerContentType.includes('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')) return '.xlsx'
  if (lowerContentDisposition.includes('.odt') || lowerContentType.includes('application/vnd.oasis.opendocument.text')) return '.odt'
  if (lowerContentDisposition.includes('.ods') || lowerContentType.includes('application/vnd.oasis.opendocument.spreadsheet')) return '.ods'
  if (lowerContentDisposition.includes('.odp') || lowerContentType.includes('application/vnd.oasis.opendocument.presentation')) return '.odp'
  if (lowerContentDisposition.includes('.png') || lowerContentType.startsWith('image/png')) return '.png'
  if (lowerContentDisposition.includes('.jpg') || lowerContentDisposition.includes('.jpeg') || lowerContentType.startsWith('image/jpeg')) return '.jpg'
  if (lowerContentDisposition.includes('.tif') || lowerContentDisposition.includes('.tiff') || lowerContentType.startsWith('image/tiff')) return '.tif'
  if (lowerContentDisposition.includes('.pdf') || lowerContentType.includes('application/pdf')) return '.pdf'

  try {
    const pathname = new URL(url).pathname.toLowerCase()
    if (pathname.endsWith('.pdf')) return '.pdf'
    if (pathname.endsWith('.epub')) return '.epub'
    if (pathname.endsWith('.docx')) return '.docx'
    if (pathname.endsWith('.pptx')) return '.pptx'
    if (pathname.endsWith('.xlsx')) return '.xlsx'
    if (pathname.endsWith('.odt')) return '.odt'
    if (pathname.endsWith('.ods')) return '.ods'
    if (pathname.endsWith('.odp')) return '.odp'
    if (pathname.endsWith('.png')) return '.png'
    if (pathname.endsWith('.jpg') || pathname.endsWith('.jpeg')) return '.jpg'
    if (pathname.endsWith('.tif') || pathname.endsWith('.tiff')) return '.tif'
  } catch {
  }

  return '.pdf'
}

const downloadDocumentUrlToTempFile = async (
  url: string
): Promise<{ filePath: string, cleanup: () => Promise<void> }> => {
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`Failed to download document URL: ${url} (${response.status})`)
  }

  const tempDir = await mkdtemp(join(tmpdir(), 'autoshow-doc-url-'))
  const ext = extensionFromUrl(
    url,
    response.headers.get('content-type'),
    response.headers.get('content-disposition')
  )
  const filePath = join(tempDir, `document${ext}`)
  try {
    const bytes = await response.arrayBuffer()
    await Bun.write(filePath, bytes)
  } catch (err) {
    await rm(tempDir, { recursive: true, force: true })
    throw err
  }

  return {
    filePath,
    cleanup: async () => {
      await rm(tempDir, { recursive: true, force: true })
    }
  }
}

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

const hasOcrExtractionFlags = (opts: RuntimeOptions): boolean =>
  opts.useOcrmypdf || opts.usePaddleOcr || typeof opts.mistralOcrModel === 'string' || typeof opts.glmOcrModel === 'string'

const collectEstimatedExtractTargets = (
  metadata: ExtractionMetadata | ExtractionMetadata[],
  opts: Pick<RuntimeOptions, 'mistralOcrModel' | 'glmOcrModel'>
): Array<{
  provider: 'mistral' | 'glm' | 'firecrawl'
  model: string
  pageCount?: number
  promptTokens?: number
  completionTokens?: number
  estimateType?: 'heuristic' | 'exact'
  note?: string
}> => {
  const targets: Array<{
    provider: 'mistral' | 'glm' | 'firecrawl'
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
        model: entry.ocrModel ?? opts.mistralOcrModel ?? 'mistral-ocr-latest',
        pageCount: entry.totalPages,
        estimateType: 'exact' as const
      })
    }
  }

  return targets
}

const warnHtmlArticleFlagBehavior = (target: string, opts: RuntimeOptions, backend: PreparedDocument['htmlArticleBackend']): void => {
  if (hasOcrExtractionFlags(opts)) {
    l.warn(`OCR flags are ignored for HTML/article inputs: ${target}`)
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
  opts: RuntimeOptions
): Promise<PreparedDocument> => {
  const effectiveBaseDir = baseDir && baseDir.trim().length > 0 ? baseDir : './output'
  const prepared = await prepareHtmlArticle(source, effectiveBaseDir, opts.urlBackend)
  warnHtmlArticleFlagBehavior(source, opts, prepared.htmlArticleBackend)
  return prepared
}

const hasExplicitLlmProvider = (opts: RuntimeOptions): boolean => {
  return [
    opts.openaiModel,
    opts.groqModel,
    opts.geminiModel,
    opts.anthropicModel,
    opts.minimaxModel,
    opts.grokModel,
    opts.llamaModel
  ].some((model) => typeof model === 'string' && model.length > 0)
}

const toDocumentSourceUrl = (target: string): string => {
  if (isLikelyUrl(target)) {
    return target
  }

  return `file://${pathResolve(target)}`
}

const buildExtractionCallOpts = (target: string, baseDir: string, opts: RuntimeOptions): Partial<ExtractionOptions> => {
  const extractionOpts: Partial<ExtractionOptions> = {
    filePath: target,
    outputDir: baseDir || './output',
    dpi: opts.dpi,
    languages: opts.lang,
    oem: opts.oem,
    psm: opts.psm,
    outputFormat: opts.out,
    preserveInterwordSpaces: opts.preserveSpaces,
    rotate: opts.rotate
  }

  if (opts.password) {
    extractionOpts.password = opts.password
  }
  if (opts.pageSeparator) {
    extractionOpts.pageSeparator = opts.pageSeparator
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
  if (opts.useEpubBun) {
    extractionOpts.useEpubBun = true
  }
  if (opts.useEpubCalibre) {
    extractionOpts.useEpubCalibre = true
  }

  return extractionOpts
}

type WriteDocumentOutputMetadataOptions = {
  step1: DocumentMetadata
  step2: ExtractionMetadata | ExtractionMetadata[]
  step3: Step3Metadata | Step3Metadata[]
  mistralOcrModel: string | undefined
  glmOcrModel: string | undefined
  llmService: string
  llmModel: string
  llmInputTokenCount: number
  llmOutputTokenCount: number
  artifactFiles: Record<string, string>
  web?: WebArticleMetadata | undefined
  errors?: Array<{ service: string, model: string, message: string }> | undefined
}

const writeDocumentOutputMetadata = async (
  outputDir: string,
  params: WriteDocumentOutputMetadataOptions
): Promise<void> => {
  const { step1, step2, step3, mistralOcrModel, glmOcrModel, llmService, llmModel, llmInputTokenCount, llmOutputTokenCount, artifactFiles, web, errors } = params
  const extractTargets = collectEstimatedExtractTargets(step2, {
    mistralOcrModel,
    glmOcrModel
  })

  const estimated = computeEstimatedCosts({
    extractTargets,
    llmService,
    llmModel,
    llmInputTokenCount,
    llmOutputTokenCount,
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
    llmService: llmService as Step3Metadata['llmService'],
    llmModel,
    llmInputTokenCount,
    llmOutputTokenCount,
    skipLLM: false,
  })
  const actualTiming = computeActualProcessingTimes({ step1, step2, step3 })
  const timing = estimatedTiming.steps.length > 0 || actualTiming.steps.length > 0
    ? { estimated: estimatedTiming, actual: actualTiming }
    : undefined

  await writeFile(`${outputDir}/metadata.json`, JSON.stringify({
    step1,
    step2,
    step3,
    ...(web ? { web } : {}),
    cost,
    ...(timing ? { timing } : {}),
    ...(errors && errors.length > 0 ? { errors } : {}),
  }, null, 2))

  l.report.complete(outputDir, artifactFiles)
}

const runDocumentWrite = async (
  target: string,
  baseDir: string,
  opts: RuntimeOptions,
  sourceRef?: Step1SourceRef,
  preparedDocument?: PreparedDocument
): Promise<{ outputDir: string }> => {
  const llmConfig = resolveLLMDefaults(opts)
  const extraction = await processDocument(
    target,
    buildExtractionCallOpts(target, baseDir, opts),
    sourceRef,
    preparedDocument
  )

  const useLegacyFallback = opts.structured === false && !hasExplicitLlmProvider(opts)
  if (useLegacyFallback) {
    const instruction = await resolvePromptNames(opts.prompts ?? [], {
      exampleFormat: 'markdown'
    })
    const prompt = buildDocumentPrompt(extraction.result.text, extraction.step1Metadata, instruction)
    const promptPath = `${extraction.outputDir}/prompt.md`
    await Bun.write(promptPath, prompt)

    const textWords = extraction.result.text.split(/\s+/).filter(Boolean)
    const summary = `# Summary\n\n${textWords.slice(0, 220).join(' ')}`
    const summaryPath = `${extraction.outputDir}/text.md`
    await Bun.write(summaryPath, summary)

    const llmService: Step3Metadata['llmService'] = (llmConfig.llmService ?? 'llama.cpp') as Step3Metadata['llmService']
    const llmModel = llmConfig.llmModel ?? (llmConfig.llamaModel as string)
    const step3: Step3Metadata = {
      llmService,
      llmModel,
      processingTime: 0,
      inputTokenCount: estimateTokens(prompt),
      outputTokenCount: estimateTokens(summary),
      outputFileName: 'text.md',
      outputFormat: 'markdown',
      structuredMode: 'off',
      structuredPresetNames: []
    }

    await writeDocumentOutputMetadata(extraction.outputDir, {
      step1: extraction.step1Metadata,
      step2: extraction.step2Metadata,
      step3,
      mistralOcrModel: opts.mistralOcrModel,
      glmOcrModel: opts.glmOcrModel,
      llmService,
      llmModel,
      llmInputTokenCount: step3.inputTokenCount,
      llmOutputTokenCount: step3.outputTokenCount,
      artifactFiles: { prompt: 'prompt.md', summary: 'text.md', metadata: 'metadata.json' },
      ...(extraction.web ? { web: extraction.web } : {}),
      ...(extraction.step2Errors ? { errors: extraction.step2Errors } : {})
    })
    return { outputDir: extraction.outputDir }
  }

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
    useOpenAI: llmConfig.useOpenAI,
    openaiModel: llmConfig.openaiModel,
    groqModel: llmConfig.groqModel,
    useGemini: llmConfig.useGemini,
    geminiModel: llmConfig.geminiModel,
    useAnthropic: llmConfig.useAnthropic,
    anthropicModel: llmConfig.anthropicModel,
    minimaxModel: llmConfig.minimaxModel,
    llamaModel: llmConfig.llamaModel,
    structured: opts.structured,
    structuredStrict: opts.structuredStrict,
    structuredCompatRetries: opts.structuredCompatRetries,
    promptBuilder: (instruction: string) =>
      buildDocumentPrompt(extraction.result.text, extraction.step1Metadata, instruction)
  })

  const step3Results = step3Runs.map((entry) => entry.metadata)
  if (step3Results.length === 0) {
    throw new Error('No LLM outputs generated for document write')
  }

  const step3Serialized: Step3Metadata | Step3Metadata[] = step3Results.length === 1 ? step3Results[0]! : step3Results
  const llmInputTokenCount = step3Results.reduce((sum, item) => sum + item.inputTokenCount, 0)
  const llmOutputTokenCount = step3Results.reduce((sum, item) => sum + item.outputTokenCount, 0)
  const llmService = step3Results[0]?.llmService ?? 'llama.cpp'
  const llmModel = step3Results[0]?.llmModel ?? (llmConfig.llamaModel ?? 'unknown')

  const artifactFiles: Record<string, string> = {
    prompt: 'prompt.md',
    metadata: 'metadata.json'
  }
  if (step3Results.length === 1) {
    artifactFiles['summary'] = step3Results[0]?.outputFileName ?? 'text.md'
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
    llmService,
    llmModel,
    llmInputTokenCount,
    llmOutputTokenCount,
    artifactFiles,
    ...(extraction.web ? { web: extraction.web } : {}),
    ...(extraction.step2Errors ? { errors: extraction.step2Errors } : {})
  })
  return { outputDir: extraction.outputDir }
}

const processMediaSingle = async (
  target: string,
  baseDir: string,
  llmDefaults: RuntimeOptions,
  preflightEstimate?: AggregatedPriceEstimate
): Promise<{ outputDir: string, info: { url: string, title: string, channel: string, channelUrl?: string, publishDate?: string, duration: string } }> => {
  const llmConfig = resolveLLMDefaults(llmDefaults)

  if (llmDefaults.split) {
    l.info('Audio will be split into 10-minute segments for transcription')
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

  const baseOptions: Record<string, unknown> = {
    ...(isUrl ? { url: target } : exists ? { filePath: target } : { url: target }),
    whisperModel: llmDefaults.whisperModel,
    groqSttModel: llmDefaults.groqSttModel,
    elevenlabsSttModel: llmDefaults.elevenlabsSttModel,
    deepgramSttModel: llmDefaults.deepgramSttModel,
    sonioxSttModel: llmDefaults.sonioxSttModel,
    openaiSttModel: llmDefaults.openaiSttModel,
    mistralSttModel: llmDefaults.mistralSttModel,
    assemblyaiSttModel: llmDefaults.assemblyaiSttModel,
    diarizationSpeakerCount: llmDefaults.diarizationSpeakerCount,
    diarizationSpeakerNames: llmDefaults.diarizationSpeakerNames,
    diarizationSpeakerReferences: llmDefaults.diarizationSpeakerReferences,
    llamaModel: llmConfig.llamaModel,
    openaiModel: llmConfig.openaiModel,
    groqModel: llmConfig.groqModel,
    geminiModel: llmConfig.geminiModel,
    anthropicModel: llmConfig.anthropicModel,
    minimaxModel: llmConfig.minimaxModel,
    grokModel: llmConfig.grokModel,
    outputDir: baseDir,
    useReverb: llmDefaults.useReverb,
    useOpenAI: llmConfig.useOpenAI,
    useGemini: llmConfig.useGemini,
    useAnthropic: llmConfig.useAnthropic,
    reverbVerbatimicity: llmDefaults.reverbVerbatimicity,
    split: llmDefaults.split,
    skipLLM: llmDefaults.skipLLM,
    structured: llmDefaults.structured,
    structuredStrict: llmDefaults.structuredStrict,
    structuredCompatRetries: llmDefaults.structuredCompatRetries,
    prompts: llmDefaults.prompts,
    ttsSpeaker: llmDefaults.ttsSpeaker,
    kittenTtsModel: llmDefaults.kittenTtsModel,
    groqTtsModel: llmDefaults.groqTtsModel,
    groqVoiceId: llmDefaults.groqVoiceId,
    openaiTtsModel: llmDefaults.openaiTtsModel,
    openaiVoiceId: llmDefaults.openaiVoiceId,
    geminiTtsModel: llmDefaults.geminiTtsModel,
    geminiVoiceId: llmDefaults.geminiVoiceId,
    elevenlabsTtsModel: llmDefaults.elevenlabsTtsModel,
    elevenlabsVoiceId: llmDefaults.elevenlabsVoiceId,
    minimaxTtsModel: llmDefaults.minimaxTtsModel,
    minimaxTtsVoice: llmDefaults.minimaxTtsVoice,
    geminiImageModel: llmDefaults.geminiImageModel,
    openaiImageModel: llmDefaults.openaiImageModel,
    minimaxImageModel: llmDefaults.minimaxImageModel,
    imageAspectRatio: llmDefaults.imageAspectRatio,
    imageSize: llmDefaults.imageSize,
    imageQuality: llmDefaults.imageQuality,
    imageFormat: llmDefaults.imageFormat,
    imageBackground: llmDefaults.imageBackground,
    imagenCount: llmDefaults.imagenCount,
    elevenlabsMusicModel: llmDefaults.elevenlabsMusicModel,
    minimaxMusicModel: llmDefaults.minimaxMusicModel,
    musicDuration: llmDefaults.musicDuration,
    musicLyricsFile: llmDefaults.musicLyricsFile,
    musicInstrumental: llmDefaults.musicInstrumental,
    geminiVideoModel: llmDefaults.geminiVideoModel,
    minimaxVideoModel: llmDefaults.minimaxVideoModel,
    videoDuration: llmDefaults.videoDuration,
    videoSize: llmDefaults.videoSize,
    videoAspectRatio: llmDefaults.videoAspectRatio,
    videoResolution: llmDefaults.videoResolution,
    mistralOcrModel: llmDefaults.mistralOcrModel,
    glmOcrModel: llmDefaults.glmOcrModel
  }

  const options: ProcessingOptions = validateData(ProcessingOptionsSchema, baseOptions, 'processing options')

  const outDir = await processVideo(options, meta, preflightEstimate, {
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

const processExtractSingle = async (
  target: string,
  baseDir: string,
  opts: RuntimeOptions,
  sourceRef?: Step1SourceRef,
  preparedDocument?: PreparedDocument
): Promise<{ outputDir: string }> => {
  const extraction = await processDocument(
    target,
    buildExtractionCallOpts(target, baseDir, opts),
    sourceRef,
    preparedDocument
  )
  l.success(`Extraction complete: ${extraction.outputDir}`)
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
  const metadataPath = `${outputDir}/metadata.json`
  await Bun.write(metadataPath, JSON.stringify({ step1: metadata }, null, 2))

  const artifactFiles: Record<string, string> = { metadata: 'metadata.json' }
  if (save && markdown) {
    await Bun.write(`${outputDir}/metadata.md`, formatMetadataAsFrontmatter(metadata))
    artifactFiles['metadataMarkdown'] = 'metadata.md'
  }

  if (save) {
    l.report.complete(outputDir, artifactFiles)
  }
}

const normalizeBatchItemPublishDate = (publishedAt?: string): string | undefined => {
  if (!publishedAt || publishedAt.length === 0) {
    return undefined
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(publishedAt)) {
    return publishedAt
  }

  const parsed = new Date(publishedAt)
  if (Number.isNaN(parsed.getTime())) {
    return undefined
  }

  const year = parsed.getUTCFullYear()
  const month = String(parsed.getUTCMonth() + 1).padStart(2, '0')
  const day = String(parsed.getUTCDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
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

  const publishDate = normalizeBatchItemPublishDate(batchItem.publishedAt)
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
  batchItem?: BatchItem
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
  const uniqueDirName = createUniqueDirectoryName(meta.title)
  const outputDir = `${effectiveBaseDir}/${uniqueDirName}`
  await ensureDirectory(outputDir)
  await writeSavedMetadataArtifacts(outputDir, metadata, opts.markdown, opts.save)
  return { outputDir }
}

const processMetadataDocument = async (
  target: string,
  opts: RuntimeOptions,
  baseDir: string,
  password?: string,
  sourceRef?: Step1SourceRef
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
    const uniqueDirName = createUniqueDirectoryName(title)
    const outputDir = `${effectiveBaseDir}/${uniqueDirName}`
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
  batchItem?: BatchItem
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
  const useFlatBatchOutput = opts.flatBatch && baseDir.trim().length > 0
  const uniqueDirName = createUniqueDirectoryName(meta.title)
  const outputDir = useFlatBatchOutput ? effectiveBaseDir : `${effectiveBaseDir}/${uniqueDirName}`
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

  const metadataPath = `${outputDir}/metadata.json`
  await Bun.write(metadataPath, JSON.stringify(manifestEntry, null, 2))

  l.report.complete(outputDir, { audio: step1Metadata.audioFileName, metadata: 'metadata.json' })

  return { outputDir }
}

const processDownloadDocument = async (
  target: string,
  baseDir: string,
  opts: RuntimeOptions,
  sourceRef?: Step1SourceRef
): Promise<{ outputDir: string }> => {
  const effectiveBaseDir = baseDir && baseDir.trim().length > 0 ? baseDir : './output'
  const prepared = await downloadDocument(target, effectiveBaseDir, opts.password, sourceRef)
  try {
    const cost = {
      estimated: { totalCost: 0, steps: [] as never[] },
      actual: { totalCost: 0, steps: [] as never[] }
    }

    const metadataPath = `${prepared.outputDir}/metadata.json`
    await Bun.write(metadataPath, JSON.stringify({ step1: prepared.step1Metadata, cost }, null, 2))

    l.report.complete(prepared.outputDir, { metadata: 'metadata.json' })

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

    const metadataPath = `${prepared.outputDir}/metadata.json`
    await Bun.write(metadataPath, JSON.stringify({
      step1: prepared.step1Metadata,
      ...(prepared.web ? { web: prepared.web } : {}),
      cost
    }, null, 2))

    l.report.complete(prepared.outputDir, { metadata: 'metadata.json' })

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
  runOptions?: { sttBatchCoordinator?: SttBatchCoordinator | undefined },
  batchItem?: BatchItem
): Promise<BatchItemProcessResult | void> => {
  const displayCommand = canonicalizeProcessCommand(command)

  if (command === 'metadata') {
    if (isLikelyUrl(item)) {
      const kind = await classifyUrlInput(item, opts)
      if (kind === 'url_direct_document') {
        const downloaded = await downloadDocumentUrlToTempFile(item)
        try {
          return await processMetadataDocument(downloaded.filePath, opts, baseDir, opts.password, { url: item })
        } finally {
          await downloaded.cleanup()
        }
      }
      if (kind === 'url_html_article') {
        const prepared = await prepareArticleDocument(item, baseDir, opts)
        return await processMetadataPreparedDocument(prepared, opts)
      }
      return await processMetadataMedia(item, opts, baseDir, batchItem)
    }

    const exists = await fileExists(item)
    if (!exists) {
      throw CLIUsageError(`Input does not exist: ${item}. Run: bun as help metadata`)
    }

    if (isHtmlDocumentPath(item)) {
      const prepared = await prepareArticleDocument(item, baseDir, opts)
      return await processMetadataPreparedDocument(prepared, opts)
    }

    const isDocExt = isDocumentByExtension(item)
    const detected = isDocExt ? await detectDocumentFormat(item) : null
    if (isDocExt || detected !== null) {
      return await processMetadataDocument(item, opts, baseDir, opts.password)
    } else {
      return await processMetadataMedia(item, opts, baseDir, batchItem)
    }
  }

  if (command === 'download') {
    if (isLikelyUrl(item)) {
      const kind = await classifyUrlInput(item, opts)
      if (kind === 'url_direct_document') {
        const downloaded = await downloadDocumentUrlToTempFile(item)
        try {
          return await processDownloadDocument(downloaded.filePath, baseDir, opts, { url: item })
        } finally {
          await downloaded.cleanup()
        }
      }
      if (kind === 'url_html_article') {
        const prepared = await prepareArticleDocument(item, baseDir, opts)
        return await processDownloadPreparedDocument(prepared)
      }
      return await processDownloadMedia(item, baseDir, opts, batchItem)
    }

    const exists = await fileExists(item)
    if (!exists) {
      throw CLIUsageError(`Input does not exist: ${item}. Run: bun as help download`)
    }

    if (isHtmlDocumentPath(item)) {
      const prepared = await prepareArticleDocument(item, baseDir, opts)
      return await processDownloadPreparedDocument(prepared)
    }

    const isDocExt = isDocumentByExtension(item)
    const detected = isDocExt ? await detectDocumentFormat(item) : null
    if (isDocExt || detected !== null) {
      return await processDownloadDocument(item, baseDir, opts)
    } else {
      return await processDownloadMedia(item, baseDir, opts, batchItem)
    }
  }

  if (isLikelyUrl(item)) {
    const kind = await classifyUrlInput(item, opts)
    if (kind === 'url_direct_document') {
      if (isSttCommand(command)) {
        throw CLIUsageError(`Unsupported stt input "${item}". Use: bun as ocr <input> or bun as write <input>`)
      }

        const downloaded = await downloadDocumentUrlToTempFile(item)
        try {
          if (isOcrCommand(command)) {
            return await processExtractSingle(downloaded.filePath, baseDir, opts, { url: item })
          } else {
            return await runDocumentWrite(downloaded.filePath, baseDir, opts, { url: item })
          }
        } finally {
          await downloaded.cleanup()
        }
    }

    if (kind === 'url_html_article') {
      if (isSttCommand(command)) {
        throw CLIUsageError(`Unsupported stt input "${item}". Use: bun as ocr <input> or bun as write <input>`)
      }

      const prepared = await prepareArticleDocument(item, baseDir, opts)
      if (isOcrCommand(command)) {
        return await processExtractSingle(item, baseDir, opts, { url: item }, prepared)
      }
      return await runDocumentWrite(item, baseDir, opts, { url: item }, prepared)
    }

    if (isOcrCommand(command)) {
      throw CLIUsageError(`Unsupported ocr input "${item}". Use a direct document URL or local file.`)
    }

    if (isSttCommand(command)) {
      return {
        outputDir: await processStt({ url: item }, baseDir, opts, preflightEstimate, {
          ...(runOptions?.sttBatchCoordinator ? { batchCoordinator: runOptions.sttBatchCoordinator } : {})
        })
      }
    }

    const result = await processMediaSingle(item, baseDir, opts, preflightEstimate)
    return { outputDir: result.outputDir }
  }

  const exists = await fileExists(item)
  if (!exists) {
    throw CLIUsageError(`Input does not exist: ${item}. Run: bun as help ${displayCommand}`)
  }

  if (isHtmlDocumentPath(item)) {
    const prepared = await prepareArticleDocument(item, baseDir, opts)

    if (isOcrCommand(command)) {
      return await processExtractSingle(item, baseDir, opts, undefined, prepared)
    }

    if (command === 'write') {
      return await runDocumentWrite(item, baseDir, opts, undefined, prepared)
    }

    if (isSttCommand(command)) {
      throw CLIUsageError(`Unsupported stt input "${item}". Use: bun as ocr <input> or bun as write <input>`)
    }
  }

  const isDocExt = isDocumentByExtension(item)
  const detected = isDocExt ? await detectDocumentFormat(item) : null
  const kind = (isDocExt || detected !== null) ? 'local_document' : 'local_media'

  if (isOcrCommand(command)) {
    if (kind !== 'local_document') {
      l.warn(`Skipping non-document file in ocr mode: ${item}`)
      return
    }
    return await processExtractSingle(item, baseDir, opts)
  }

  if (command === 'write' && kind === 'local_document') {
    return await runDocumentWrite(item, baseDir, opts)
  }

  if (isSttCommand(command) && kind === 'local_document') {
    throw CLIUsageError(`Unsupported stt input "${item}". Use: bun as ocr <input> or bun as write <input>`)
  }

  if (isSttCommand(command)) {
    return {
      outputDir: await processStt({ filePath: item }, baseDir, opts, preflightEstimate, {
        ...(runOptions?.sttBatchCoordinator ? { batchCoordinator: runOptions.sttBatchCoordinator } : {})
      })
    }
  }

  const result = await processMediaSingle(item, baseDir, opts, preflightEstimate)
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
