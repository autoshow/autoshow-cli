import { stat } from 'node:fs/promises'
import { basename, extname, join } from 'node:path'
import type {
  DocumentMetadata,
  ExtractionOptions,
  HostedExtractOcrEngine,
  HostedOcrRun
} from '~/types'
import { exec, commandExists } from '~/utils/cli-utils'
import { CLIUsageError } from '~/utils/error-handler'
import { getExtractLimits } from '~/cli/commands/setup-and-utilities/models/model-loader'
import {
  ANTHROPIC_OCR_LIMIT_SOURCE,
  ensureAnthropicOcrSetup
} from './ocr-services/anthropic-ocr/anthropic-ocr'
import {
  DEEPINFRA_OCR_LIMIT_SOURCE,
  ensureDeepinfraOcrSetup
} from './ocr-services/deepinfra-ocr/deepinfra-ocr'
import {
  GEMINI_FILE_UPLOAD_BYTES,
  GEMINI_OCR_LIMIT_SOURCE,
  GEMINI_PDF_PAGE_COUNT_LIMIT,
  ensureGeminiOcrSetup
} from './ocr-services/gemini-ocr/gemini'
import { ensureGcloudDocaiSetup } from './ocr-services/gcloud-docai/gcloud-docai'
import { ensureGlmOcrSetup } from './ocr-services/glm-ocr/glm'
import {
  GROK_OCR_LIMIT_SOURCE,
  ensureGrokOcrSetup
} from './ocr-services/grok-ocr/grok'
import { KIMI_OCR_LIMIT_SOURCE, ensureKimiOcrSetup } from './ocr-services/kimi-ocr/kimi'
import { ensureMistralOcrSetup } from './ocr-services/mistral-ocr/mistral'
import { ensureOpenAIOcrSetup } from './ocr-services/openai-ocr/openai-ocr'
import { ensureUnstructuredOcrSetup } from './ocr-services/unstructured-ocr/unstructured'
import { runAnthropicOcr } from './ocr-services/anthropic-ocr/run-anthropic-ocr'
import { runAwsTextract } from './ocr-services/aws-textract/run-aws-textract'
import { runDeepinfraOcr } from './ocr-services/deepinfra-ocr/run-deepinfra-ocr'
import { runGcloudDocai } from './ocr-services/gcloud-docai/run-gcloud-docai'
import { runGeminiOcr } from './ocr-services/gemini-ocr/run-gemini-ocr'
import { runGlmOcr } from './ocr-services/glm-ocr/run-glm-ocr'
import { runGrokOcr } from './ocr-services/grok-ocr/run-grok-ocr'
import { runKimiOcr } from './ocr-services/kimi-ocr/run-kimi-ocr'
import { runMistralOcr } from './ocr-services/mistral-ocr/run-mistral-ocr'
import { runOpenAIOcr } from './ocr-services/openai-ocr/run-openai-ocr'
import { runUnstructuredOcr } from './ocr-services/unstructured-ocr/run-unstructured-ocr'
import {
  hasAnthropicOcr,
  hasAwsTextract,
  hasDeepinfraOcr,
  hasGcloudDocai,
  hasGeminiOcr,
  hasGlmOcr,
  hasGrokOcr,
  hasKimiOcr,
  hasMistralOcr,
  hasOpenAIOcr,
  hasUnstructuredOcr,
  warnHostedOnlyFlags
} from './ocr-engine-selection'
import { isPdfEncrypted, resolvePdfPageCount } from './pdf-utils'
import { runHostedOcrWithPdfChunkFallback } from './ocr-utils/pdf-chunk-fallback'
import { isBunImagePngNormalizableFormat, normalizeImageToPngWithBun } from './ocr-utils/bun-image-utils'

type HostedOcrService = HostedOcrRun['ocrService']
type HostedOcrIdentity = Pick<HostedOcrRun, 'extractionMethod' | 'ocrService' | 'ocrModel'>

const formatBytes = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < (1024 * 1024)) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < (1024 * 1024 * 1024)) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`
}

const formatHostedOcrLabel = (service: HostedOcrService): string => {
  switch (service) {
    case 'glm':
      return 'GLM OCR'
    case 'kimi':
      return 'Kimi OCR'
    case 'mistral':
      return 'Mistral OCR'
    case 'openai':
      return 'OpenAI OCR'
    case 'grok':
      return 'Grok OCR'
    case 'anthropic':
      return 'Anthropic OCR'
    case 'gemini':
      return 'Gemini OCR'
    case 'deepinfra':
      return 'DeepInfra OCR'
    case 'aws-textract':
      return 'AWS Textract'
    case 'gcloud-docai':
      return 'Google Cloud Document AI'
    case 'unstructured':
      return 'Unstructured OCR'
  }
}

const getHostedOcrLimitSource = (service: HostedOcrService): string => {
  switch (service) {
    case 'openai':
      return 'project/links/openai-all-links.md'
    case 'grok':
      return GROK_OCR_LIMIT_SOURCE
    case 'anthropic':
      return ANTHROPIC_OCR_LIMIT_SOURCE
    case 'gemini':
      return GEMINI_OCR_LIMIT_SOURCE
    case 'deepinfra':
      return DEEPINFRA_OCR_LIMIT_SOURCE
    case 'glm':
      return 'project/links/glm-all-links.md'
    case 'kimi':
      return KIMI_OCR_LIMIT_SOURCE
    case 'aws-textract':
      return 'project/links/aws-ocr-links.md'
    case 'gcloud-docai':
      return 'project/links/gcloud-ocr-links.md'
    case 'unstructured':
      return 'project/links/unstructured-all-links.md'
    default:
      return 'project/links/all-all-links.md'
  }
}

const warnMistralOnlyFlags = (opts: ExtractionOptions): void => {
  warnHostedOnlyFlags('mistral-ocr', opts)
}

const warnGlmOnlyFlags = (opts: ExtractionOptions): void => {
  warnHostedOnlyFlags('glm-ocr', opts)
}

const warnOpenAIOnlyFlags = (opts: ExtractionOptions): void => {
  warnHostedOnlyFlags('openai-ocr', opts)
}

const warnGrokOnlyFlags = (opts: ExtractionOptions): void => {
  warnHostedOnlyFlags('grok-ocr', opts)
}

const warnAnthropicOnlyFlags = (opts: ExtractionOptions): void => {
  warnHostedOnlyFlags('anthropic-ocr', opts)
}

const warnGeminiOnlyFlags = (opts: ExtractionOptions): void => {
  warnHostedOnlyFlags('gemini-ocr', opts)
}

export const getHostedDirectImageSupportError = (engine: HostedExtractOcrEngine): string => {
  if (engine === 'glm-ocr') {
    return 'The --glm-ocr engine supports PDF and standard image files (PNG/JPG) only.'
  }
  if (engine === 'kimi-ocr') {
    return 'The --kimi-ocr engine sends PNG/JPG/WEBP/GIF images to Kimi directly; PDF pages are rendered to PNG. AutoShow normalizes BMP images locally with Bun.Image. Convert TIF images to PNG/JPG first, or install ImageMagick so AutoShow can normalize TIF automatically.'
  }
  if (engine === 'mistral-ocr') {
    return 'The --mistral-ocr engine supports PDF and standard image files (PNG/JPG/TIF) only.'
  }
  if (engine === 'anthropic-ocr') {
    return 'The --anthropic-ocr engine supports PDF and PNG/JPG/WEBP/GIF images directly. AutoShow normalizes BMP images locally with Bun.Image. Convert TIF images to PNG/JPG first, or install ImageMagick so AutoShow can normalize TIF automatically.'
  }
  if (engine === 'gemini-ocr') {
    return 'The --gemini-ocr engine supports PDF and PNG/JPG/WEBP/BMP images directly. AutoShow normalizes GIF images locally with Bun.Image. Convert TIF images to PNG/JPG first, or install ImageMagick so AutoShow can normalize TIF automatically.'
  }
  if (engine === 'deepinfra-ocr') {
    return 'The --deepinfra-ocr engine sends PNG/JPG/WEBP images to DeepInfra directly; PDF pages are rendered to PNG. AutoShow normalizes GIF/BMP images locally with Bun.Image. Convert TIF images to PNG/JPG/WebP first, or install ImageMagick so AutoShow can normalize TIF automatically.'
  }
  if (engine === 'grok-ocr') {
    return 'The --grok-ocr engine sends PNG/JPG images to Grok directly; PDF pages are rendered to PNG. Convert WEBP/GIF/BMP/TIF images to PNG/JPG first.'
  }
  if (engine === 'aws-textract') {
    return 'The --aws-textract engine supports PDF and PNG/JPG/TIF images directly. AutoShow normalizes BMP/WEBP/GIF images locally with Bun.Image.'
  }
  if (engine === 'gcloud-docai') {
    return 'The --gcloud-docai engine supports PDF and PNG/JPG/TIF/GIF/BMP/WEBP images directly.'
  }
  if (engine === 'unstructured-ocr') {
    return 'The --unstructured-ocr engine supports PDF and PNG/JPG/TIF/BMP images directly. AutoShow normalizes GIF/WEBP images locally with Bun.Image.'
  }
  return 'The --openai-ocr engine supports PDF and PNG/JPG/WEBP/GIF images directly. AutoShow normalizes BMP images locally with Bun.Image. Convert TIF images to PNG/JPG first, or install ImageMagick so AutoShow can normalize TIF automatically.'
}

type HostedDirectImageInputStrategy = 'direct' | 'bun-png' | 'imagemagick-png' | 'unsupported'

type HostedDirectImageFormatSet = {
  direct: Set<string>
  bunToPng: Set<string>
  imagemagickToPng: Set<string>
}

const hostedDirectImageFormats = (
  direct: string[],
  bunToPng: string[] = [],
  imagemagickToPng: string[] = []
): HostedDirectImageFormatSet => ({
  direct: new Set(direct),
  bunToPng: new Set(bunToPng),
  imagemagickToPng: new Set(imagemagickToPng)
})

const HOSTED_DIRECT_IMAGE_FORMATS: Record<HostedExtractOcrEngine, HostedDirectImageFormatSet> = {
  'glm-ocr': hostedDirectImageFormats(['png', 'jpg']),
  'kimi-ocr': hostedDirectImageFormats(['png', 'jpg', 'webp', 'gif'], ['bmp'], ['tif']),
  'mistral-ocr': hostedDirectImageFormats(['png', 'jpg', 'tif']),
  'openai-ocr': hostedDirectImageFormats(['png', 'jpg', 'webp', 'gif'], ['bmp'], ['tif']),
  'grok-ocr': hostedDirectImageFormats(['png', 'jpg']),
  'anthropic-ocr': hostedDirectImageFormats(['png', 'jpg', 'webp', 'gif'], ['bmp'], ['tif']),
  'gemini-ocr': hostedDirectImageFormats(['png', 'jpg', 'webp', 'bmp'], ['gif'], ['tif']),
  'deepinfra-ocr': hostedDirectImageFormats(['png', 'jpg', 'webp'], ['gif', 'bmp'], ['tif']),
  'aws-textract': hostedDirectImageFormats(['png', 'jpg', 'tif'], ['bmp', 'webp', 'gif']),
  'gcloud-docai': hostedDirectImageFormats(['png', 'jpg', 'tif', 'gif', 'bmp', 'webp']),
  'unstructured-ocr': hostedDirectImageFormats(['png', 'jpg', 'tif', 'bmp'], ['gif', 'webp'])
}

export const resolveHostedDirectImageInputStrategy = (
  format: string,
  engine: HostedExtractOcrEngine
): HostedDirectImageInputStrategy => {
  const formats = HOSTED_DIRECT_IMAGE_FORMATS[engine]
  if (formats.direct.has(format)) {
    return 'direct'
  }
  if (formats.bunToPng.has(format)) {
    return 'bun-png'
  }
  if (formats.imagemagickToPng.has(format)) {
    return 'imagemagick-png'
  }
  return 'unsupported'
}

const normalizeHostedImageWithBun = async (
  imagePath: string,
  engine: HostedExtractOcrEngine,
  tempDir: string,
  outputStem: string,
  normalizedFormat: string
): Promise<{ filePath: string, format: DocumentMetadata['format'] }> => {
  if (!isBunImagePngNormalizableFormat(normalizedFormat)) {
    throw CLIUsageError(getHostedDirectImageSupportError(engine))
  }

  const pngPath = join(tempDir, `${outputStem}.png`)
  try {
    await normalizeImageToPngWithBun(imagePath, pngPath)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    throw CLIUsageError(`Failed to normalize ${basename(imagePath)} for --${engine}. Bun.Image could not convert ${normalizedFormat.toUpperCase()} to PNG: ${message}`)
  }

  return { filePath: pngPath, format: 'png' }
}

const normalizeHostedImageWithImageMagick = async (
  imagePath: string,
  engine: HostedExtractOcrEngine,
  tempDir: string,
  outputStem: string
): Promise<{ filePath: string, format: DocumentMetadata['format'] }> => {
  if (!commandExists('convert')) {
    throw CLIUsageError(getHostedDirectImageSupportError(engine))
  }

  const pngPath = join(tempDir, `${outputStem}.png`)
  const result = await exec('convert', [imagePath, pngPath])
  if (result.exitCode !== 0) {
    throw CLIUsageError(`Failed to normalize ${basename(imagePath)} for --${engine}. ${result.stderr || result.stdout || 'ImageMagick convert failed.'}`)
  }

  return { filePath: pngPath, format: 'png' }
}

export const normalizeHostedDirectImageInput = async (
  imagePath: string,
  engine: HostedExtractOcrEngine,
  tempDir: string,
  outputStem: string
): Promise<{ filePath: string, format: DocumentMetadata['format'] }> => {
  const ext = extname(imagePath).toLowerCase()
  const normalizedFormat = ext === '.jpeg'
    ? 'jpg'
    : ext === '.tiff'
      ? 'tif'
      : ext.slice(1).toLowerCase()

  const strategy = resolveHostedDirectImageInputStrategy(normalizedFormat, engine)
  if (strategy === 'direct') {
    return { filePath: imagePath, format: normalizedFormat as DocumentMetadata['format'] }
  }
  if (strategy === 'bun-png') {
    return await normalizeHostedImageWithBun(imagePath, engine, tempDir, outputStem, normalizedFormat)
  }
  if (strategy === 'imagemagick-png') {
    return await normalizeHostedImageWithImageMagick(imagePath, engine, tempDir, outputStem)
  }

  throw CLIUsageError(getHostedDirectImageSupportError(engine))
}

const resolveHostedOcrSelection = (
  opts: ExtractionOptions
): { service: HostedOcrService, model: string } | undefined => {
  if (hasMistralOcr(opts)) {
    return { service: 'mistral', model: opts.mistralOcrModel as string }
  }

  if (hasGlmOcr(opts)) {
    return { service: 'glm', model: opts.glmOcrModel as string }
  }

  if (hasKimiOcr(opts)) {
    return { service: 'kimi', model: opts.kimiOcrModel as string }
  }

  if (hasOpenAIOcr(opts)) {
    return { service: 'openai', model: opts.openaiOcrModel as string }
  }

  if (hasGrokOcr(opts)) {
    return { service: 'grok', model: opts.grokOcrModel as string }
  }

  if (hasAnthropicOcr(opts)) {
    return { service: 'anthropic', model: opts.anthropicOcrModel as string }
  }

  if (hasGeminiOcr(opts)) {
    return { service: 'gemini', model: opts.geminiOcrModel as string }
  }

  if (hasDeepinfraOcr(opts)) {
    return { service: 'deepinfra', model: opts.deepinfraOcrModel as string }
  }

  if (hasAwsTextract(opts)) {
    return { service: 'aws-textract', model: opts.awsTextractModel as string }
  }

  if (hasGcloudDocai(opts)) {
    return { service: 'gcloud-docai', model: opts.gcloudDocaiModel as string }
  }

  if (hasUnstructuredOcr(opts)) {
    return { service: 'unstructured', model: opts.unstructuredOcrModel as string }
  }

  return undefined
}

const assertHostedOcrWithinLimits = async (
  filePath: string,
  step1Metadata: DocumentMetadata,
  opts: ExtractionOptions
): Promise<void> => {
  const selection = resolveHostedOcrSelection(opts)
  if (!selection) return

  if (selection.service === 'aws-textract') {
    return
  }

  if (selection.service === 'gcloud-docai') {
    return
  }

  if (selection.service === 'gemini') {
    const inputLabel = step1Metadata.format === 'pdf' ? 'PDF' : 'image'
    const fileStats = await stat(filePath)
    if (fileStats.size > GEMINI_FILE_UPLOAD_BYTES) {
      throw CLIUsageError(
        `${formatHostedOcrLabel(selection.service)} supports ${inputLabel} inputs up to ${formatBytes(GEMINI_FILE_UPLOAD_BYTES)} based on ${getHostedOcrLimitSource(selection.service)}. `
        + `Got ${formatBytes(fileStats.size)} for ${basename(filePath)}.`
      )
    }

    if (step1Metadata.format === 'pdf') {
      const pageCount = await resolvePdfPageCount(filePath, opts.password, step1Metadata.pageCount)
      if (typeof pageCount === 'number' && pageCount > GEMINI_PDF_PAGE_COUNT_LIMIT) {
        throw CLIUsageError(
          `${formatHostedOcrLabel(selection.service)} supports PDF inputs up to ${GEMINI_PDF_PAGE_COUNT_LIMIT} pages based on ${getHostedOcrLimitSource(selection.service)}. `
          + `Got ${pageCount} pages for ${basename(filePath)}.`
        )
      }
    }

    return
  }

  if (selection.service === 'anthropic' && step1Metadata.format === 'pdf') {
    if (typeof opts.password === 'string' && opts.password.length > 0) {
      throw CLIUsageError('Anthropic OCR only supports standard unencrypted PDFs. Remove --password and decrypt the PDF before using --anthropic-ocr.')
    }

    if (await isPdfEncrypted(filePath)) {
      throw CLIUsageError('Anthropic OCR only supports standard unencrypted PDFs. Decrypt the PDF before using --anthropic-ocr.')
    }
  }

  const limits = getExtractLimits(selection.service, selection.model, step1Metadata.format)
  if (
    limits.effectiveBytes === undefined
    && limits.pageCount === undefined
  ) {
    return
  }

  const inputLabel = step1Metadata.format === 'pdf' ? 'PDF' : 'image'
  const fileStats = await stat(filePath)

  if (typeof limits.effectiveBytes === 'number' && fileStats.size > limits.effectiveBytes) {
    throw CLIUsageError(
      `${formatHostedOcrLabel(selection.service)} supports ${inputLabel} inputs up to ${formatBytes(limits.effectiveBytes)} based on ${getHostedOcrLimitSource(selection.service)}. `
      + `Got ${formatBytes(fileStats.size)} for ${basename(filePath)}.`
    )
  }

  if (step1Metadata.format === 'pdf' && typeof limits.pageCount === 'number') {
    const pageCount = await resolvePdfPageCount(filePath, opts.password, step1Metadata.pageCount)
    if (typeof pageCount === 'number' && pageCount > limits.pageCount) {
      throw CLIUsageError(
        `${formatHostedOcrLabel(selection.service)} supports PDF inputs up to ${limits.pageCount} pages based on ${getHostedOcrLimitSource(selection.service)}. `
        + `Got ${pageCount} pages for ${basename(filePath)}.`
      )
    }
  }
}

const runChunkableHostedPdfOcr = async (
  filePath: string,
  step1Metadata: DocumentMetadata,
  opts: ExtractionOptions,
  serviceLabel: string,
  identity: HostedOcrIdentity,
  runProvider: (inputPath: string, inputMetadata: DocumentMetadata) => Promise<HostedOcrRun>
): Promise<HostedOcrRun> => {
  if (step1Metadata.format !== 'pdf') {
    return withHostedUsageDetail(await runProvider(filePath, step1Metadata), {
      unit: 'document',
      pages: Math.max(1, step1Metadata.pageCount)
    })
  }

  return await runHostedOcrWithPdfChunkFallback({
    filePath,
    step1Metadata,
    serviceLabel,
    totalPages: Math.max(1, step1Metadata.pageCount),
    password: opts.password,
    fallbackDir: opts.outputDir,
    runFull: async () => withHostedUsageDetail(await runProvider(filePath, step1Metadata), {
      unit: 'document',
      pages: Math.max(1, step1Metadata.pageCount)
    }),
    runChunk: async (chunkPath, chunkMetadata, range) => withHostedUsageDetail(await runProvider(chunkPath, chunkMetadata), {
      unit: 'chunk',
      pageStart: range.startPage,
      pageEnd: range.endPage,
      pages: Math.max(1, chunkMetadata.pageCount)
    }),
    buildMalformedPageRun: (rawText, range) => ({
      pages: [{
        pageNumber: range.startPage,
        method: 'ocr',
        text: rawText
      }],
      extractionMethod: identity.extractionMethod,
      ocrService: identity.ocrService,
      ocrModel: identity.ocrModel,
      totalPages: Math.max(1, range.endPage - range.startPage + 1)
    })
  })
}

const withHostedUsageDetail = (
  run: HostedOcrRun,
  context: Record<string, unknown>
): HostedOcrRun => {
  if (run.providerUsage && run.providerUsage.length > 0) {
    return run
  }

  const hasUsage = typeof run.promptTokens === 'number'
    || typeof run.completionTokens === 'number'
    || typeof run.providerCostCents === 'number'

  if (!hasUsage) {
    return run
  }

  return {
    ...run,
    providerUsage: [{
      ...context,
      provider: run.ocrService,
      model: run.ocrModel,
      ...(typeof run.promptTokens === 'number' ? { promptTokens: run.promptTokens } : {}),
      ...(typeof run.completionTokens === 'number' ? { completionTokens: run.completionTokens } : {}),
      ...(typeof run.providerCostCents === 'number' ? { providerCostCents: run.providerCostCents } : {}),
      ...(run.providerCostSource ? { providerCostSource: run.providerCostSource } : {})
    }]
  }
}

export const runHostedOcr = async (
  filePath: string,
  step1Metadata: DocumentMetadata,
  opts: ExtractionOptions
): Promise<HostedOcrRun> => {
  if (hasMistralOcr(opts)) {
    await ensureMistralOcrSetup()
    warnMistralOnlyFlags(opts)
    const ocrModel = opts.mistralOcrModel as string
    return await runChunkableHostedPdfOcr(filePath, step1Metadata, opts, 'Mistral OCR', {
      extractionMethod: 'mistral-ocr',
      ocrService: 'mistral',
      ocrModel
    }, async (inputPath, inputMetadata) => {
      await assertHostedOcrWithinLimits(inputPath, inputMetadata, opts)
      const run = await runMistralOcr(inputPath, inputMetadata, ocrModel)
      return {
        pages: run.pages,
        extractionMethod: run.extractionMethod,
        ocrService: 'mistral',
        ocrModel
      }
    })
  }

  if (hasGlmOcr(opts)) {
    await ensureGlmOcrSetup()
    warnGlmOnlyFlags(opts)
    const ocrModel = opts.glmOcrModel as string
    return await runChunkableHostedPdfOcr(filePath, step1Metadata, opts, 'GLM OCR', {
      extractionMethod: 'glm-ocr',
      ocrService: 'glm',
      ocrModel
    }, async (inputPath, inputMetadata) => {
      await assertHostedOcrWithinLimits(inputPath, inputMetadata, opts)
      const run = await runGlmOcr(inputPath, inputMetadata, ocrModel)
      return {
        pages: run.pages,
        extractionMethod: run.extractionMethod,
        ocrService: 'glm',
        ocrModel,
        canonicalText: run.markdown,
        ...(typeof run.totalPages === 'number' ? { totalPages: run.totalPages } : {}),
        ...(typeof run.promptTokens === 'number' ? { promptTokens: run.promptTokens } : {}),
        ...(typeof run.completionTokens === 'number' ? { completionTokens: run.completionTokens } : {})
      }
    })
  }

  if (hasKimiOcr(opts)) {
    await ensureKimiOcrSetup()
    warnHostedOnlyFlags('kimi-ocr', opts)
    const ocrModel = opts.kimiOcrModel as string
    await assertHostedOcrWithinLimits(filePath, step1Metadata, opts)
    const run = await runKimiOcr(filePath, step1Metadata, ocrModel, {
      dpi: opts.dpi,
      password: opts.password,
      rotate: opts.rotate,
      ocrPreparationCache: opts.ocrPreparationCache
    })
    return withHostedUsageDetail({
      pages: run.pages,
      extractionMethod: run.extractionMethod,
      ocrService: 'kimi',
      ocrModel,
      totalPages: run.totalPages,
      ...(typeof run.promptTokens === 'number' ? { promptTokens: run.promptTokens } : {}),
      ...(typeof run.completionTokens === 'number' ? { completionTokens: run.completionTokens } : {})
    }, { unit: 'document', pages: run.totalPages })
  }

  if (hasOpenAIOcr(opts)) {
    await ensureOpenAIOcrSetup()
    warnOpenAIOnlyFlags(opts)
    const ocrModel = opts.openaiOcrModel as string
    return await runChunkableHostedPdfOcr(filePath, step1Metadata, opts, 'OpenAI OCR', {
      extractionMethod: 'openai-ocr',
      ocrService: 'openai',
      ocrModel
    }, async (inputPath, inputMetadata) => {
      await assertHostedOcrWithinLimits(inputPath, inputMetadata, opts)
      const run = await runOpenAIOcr(inputPath, inputMetadata, ocrModel)
      return {
        pages: run.pages,
        extractionMethod: run.extractionMethod,
        ocrService: 'openai',
        ocrModel,
        totalPages: run.totalPages,
        ...(typeof run.promptTokens === 'number' ? { promptTokens: run.promptTokens } : {}),
        ...(typeof run.completionTokens === 'number' ? { completionTokens: run.completionTokens } : {})
      }
    })
  }

  if (hasGrokOcr(opts)) {
    await ensureGrokOcrSetup()
    warnGrokOnlyFlags(opts)
    const ocrModel = opts.grokOcrModel as string
    await assertHostedOcrWithinLimits(filePath, step1Metadata, opts)
    const run = await runGrokOcr(filePath, step1Metadata, ocrModel, {
      dpi: opts.dpi,
      password: opts.password,
      rotate: opts.rotate,
      ocrPreparationCache: opts.ocrPreparationCache
    })
    return withHostedUsageDetail({
      pages: run.pages,
      extractionMethod: run.extractionMethod,
      ocrService: 'grok',
      ocrModel,
      totalPages: run.totalPages,
      ...(typeof run.promptTokens === 'number' ? { promptTokens: run.promptTokens } : {}),
      ...(typeof run.completionTokens === 'number' ? { completionTokens: run.completionTokens } : {})
    }, { unit: 'document', pages: run.totalPages })
  }

  if (hasAnthropicOcr(opts)) {
    await ensureAnthropicOcrSetup()
    warnAnthropicOnlyFlags(opts)
    const ocrModel = opts.anthropicOcrModel as string
    return await runChunkableHostedPdfOcr(filePath, step1Metadata, opts, 'Anthropic OCR', {
      extractionMethod: 'anthropic-ocr',
      ocrService: 'anthropic',
      ocrModel
    }, async (inputPath, inputMetadata) => {
      await assertHostedOcrWithinLimits(inputPath, inputMetadata, opts)
      const run = await runAnthropicOcr(inputPath, inputMetadata, ocrModel)
      return {
        pages: run.pages,
        extractionMethod: run.extractionMethod,
        ocrService: 'anthropic',
        ocrModel,
        totalPages: run.totalPages,
        ...(typeof run.promptTokens === 'number' ? { promptTokens: run.promptTokens } : {}),
        ...(typeof run.completionTokens === 'number' ? { completionTokens: run.completionTokens } : {})
      }
    })
  }

  if (hasGeminiOcr(opts)) {
    await ensureGeminiOcrSetup()
    warnGeminiOnlyFlags(opts)
    const ocrModel = opts.geminiOcrModel as string
    return await runChunkableHostedPdfOcr(filePath, step1Metadata, opts, 'Gemini OCR', {
      extractionMethod: 'gemini-ocr',
      ocrService: 'gemini',
      ocrModel
    }, async (inputPath, inputMetadata) => {
      await assertHostedOcrWithinLimits(inputPath, inputMetadata, opts)
      const run = await runGeminiOcr(inputPath, inputMetadata, ocrModel, {
        ocrPreparationCache: opts.ocrPreparationCache
      })
      return {
        pages: run.pages,
        extractionMethod: run.extractionMethod,
        ocrService: 'gemini',
        ocrModel,
        totalPages: run.totalPages,
        ...(typeof run.promptTokens === 'number' ? { promptTokens: run.promptTokens } : {}),
        ...(typeof run.completionTokens === 'number' ? { completionTokens: run.completionTokens } : {})
      }
    })
  }

  if (hasDeepinfraOcr(opts)) {
    await ensureDeepinfraOcrSetup()
    warnHostedOnlyFlags('deepinfra-ocr', opts)
    const ocrModel = opts.deepinfraOcrModel as string
    await assertHostedOcrWithinLimits(filePath, step1Metadata, opts)
    const run = await runDeepinfraOcr(filePath, step1Metadata, ocrModel, {
      dpi: opts.dpi,
      password: opts.password,
      rotate: opts.rotate,
      ocrPreparationCache: opts.ocrPreparationCache
    })
    return withHostedUsageDetail({
      pages: run.pages,
      extractionMethod: run.extractionMethod,
      ocrService: 'deepinfra',
      ocrModel,
      totalPages: run.totalPages,
      ...(typeof run.promptTokens === 'number' ? { promptTokens: run.promptTokens } : {}),
      ...(typeof run.completionTokens === 'number' ? { completionTokens: run.completionTokens } : {})
    }, { unit: 'document', pages: run.totalPages })
  }

  if (hasAwsTextract(opts)) {
    warnHostedOnlyFlags('aws-textract', opts)
    const ocrModel = opts.awsTextractModel as string
    return await runChunkableHostedPdfOcr(filePath, step1Metadata, opts, 'AWS Textract', {
      extractionMethod: 'aws-textract',
      ocrService: 'aws-textract',
      ocrModel
    }, async (inputPath, inputMetadata) => {
      await assertHostedOcrWithinLimits(inputPath, inputMetadata, opts)
      const run = await runAwsTextract(inputPath, inputMetadata, {
        region: opts.awsRegion,
        bucket: opts.awsBucket,
        configPath: opts.configPath
      })
      return {
        pages: run.pages,
        extractionMethod: run.extractionMethod,
        ocrService: 'aws-textract',
        ocrModel,
        totalPages: run.totalPages
      }
    })
  }

  if (hasGcloudDocai(opts)) {
    const ocrModel = opts.gcloudDocaiModel as string
    await ensureGcloudDocaiSetup()
    warnHostedOnlyFlags('gcloud-docai', opts)
    return await runChunkableHostedPdfOcr(filePath, step1Metadata, opts, 'Google Cloud Document AI', {
      extractionMethod: 'gcloud-docai',
      ocrService: 'gcloud-docai',
      ocrModel
    }, async (inputPath, inputMetadata) => {
      await assertHostedOcrWithinLimits(inputPath, inputMetadata, opts)
      const run = await runGcloudDocai(inputPath, inputMetadata)
      return {
        pages: run.pages,
        extractionMethod: run.extractionMethod,
        ocrService: 'gcloud-docai',
        ocrModel,
        totalPages: run.totalPages
      }
    })
  }

  if (hasUnstructuredOcr(opts)) {
    const ocrModel = opts.unstructuredOcrModel as string
    await ensureUnstructuredOcrSetup()
    warnHostedOnlyFlags('unstructured-ocr', opts)
    return await runChunkableHostedPdfOcr(filePath, step1Metadata, opts, 'Unstructured OCR', {
      extractionMethod: 'unstructured-ocr',
      ocrService: 'unstructured',
      ocrModel
    }, async (inputPath, inputMetadata) => {
      await assertHostedOcrWithinLimits(inputPath, inputMetadata, opts)
      const run = await runUnstructuredOcr(inputPath, inputMetadata, ocrModel)
      return {
        pages: run.pages,
        extractionMethod: run.extractionMethod,
        ocrService: 'unstructured',
        ocrModel,
        totalPages: run.totalPages
      }
    })
  }

  throw CLIUsageError('Hosted OCR requested without a configured hosted OCR model.')
}
