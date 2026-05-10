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
import { KIMI_OCR_LIMIT_SOURCE, ensureKimiOcrSetup } from './ocr-services/kimi-ocr/kimi'
import { ensureMistralOcrSetup } from './ocr-services/mistral-ocr/mistral'
import { ensureOpenAIOcrSetup } from './ocr-services/openai-ocr/openai-ocr'
import { runAnthropicOcr } from './ocr-services/anthropic-ocr/run-anthropic-ocr'
import { runAwsTextract } from './ocr-services/aws-textract/run-aws-textract'
import { runDeepinfraOcr } from './ocr-services/deepinfra-ocr/run-deepinfra-ocr'
import { runGcloudDocai } from './ocr-services/gcloud-docai/run-gcloud-docai'
import { runGeminiOcr } from './ocr-services/gemini-ocr/run-gemini-ocr'
import { runGlmOcr } from './ocr-services/glm-ocr/run-glm-ocr'
import { runKimiOcr } from './ocr-services/kimi-ocr/run-kimi-ocr'
import { runMistralOcr } from './ocr-services/mistral-ocr/run-mistral-ocr'
import { runOpenAIOcr } from './ocr-services/openai-ocr/run-openai-ocr'
import {
  hasAnthropicOcr,
  hasAwsTextract,
  hasDeepinfraOcr,
  hasGcloudDocai,
  hasGeminiOcr,
  hasGlmOcr,
  hasKimiOcr,
  hasMistralOcr,
  hasOpenAIOcr,
  warnHostedOnlyFlags
} from './ocr-engine-selection'
import { isPdfEncrypted, resolvePdfPageCount } from './pdf-utils'
import { runHostedOcrWithPdfChunkFallback } from './ocr-utils/pdf-chunk-fallback'

type HostedOcrService = HostedOcrRun['ocrService']

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
  }
}

const getHostedOcrLimitSource = (service: HostedOcrService): string => {
  switch (service) {
    case 'openai':
      return 'project/links/openai-all-links.md'
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
    return 'The --kimi-ocr engine sends PNG/JPG/WEBP/GIF images to Kimi directly; PDF pages are rendered to PNG. Convert BMP/TIF images to PNG/JPG/WebP/GIF first, or install ImageMagick so AutoShow can normalize them automatically.'
  }
  if (engine === 'mistral-ocr') {
    return 'The --mistral-ocr engine supports PDF and standard image files (PNG/JPG/TIF) only.'
  }
  if (engine === 'anthropic-ocr') {
    return 'The --anthropic-ocr engine supports PDF and PNG/JPG/WEBP/GIF images directly. Convert BMP/TIF images to PNG/JPG first, or install ImageMagick so AutoShow can normalize them automatically.'
  }
  if (engine === 'gemini-ocr') {
    return 'The --gemini-ocr engine supports PDF and PNG/JPG/WEBP/BMP images directly. Convert GIF/TIF images to PNG/JPG first, or install ImageMagick so AutoShow can normalize them automatically.'
  }
  if (engine === 'deepinfra-ocr') {
    return 'The --deepinfra-ocr engine sends PNG/JPG/WEBP images to DeepInfra directly; PDF pages are rendered to PNG. Convert GIF/BMP/TIF images to PNG/JPG/WebP first, or install ImageMagick so AutoShow can normalize them automatically.'
  }
  if (engine === 'aws-textract') {
    return 'The --aws-textract engine supports PDF and PNG/JPG/TIF images directly. Convert BMP/WEBP/GIF images to PNG/JPG first, or install ImageMagick so AutoShow can normalize them automatically.'
  }
  if (engine === 'gcloud-docai') {
    return 'The --gcloud-docai engine supports PDF and PNG/JPG/TIF/GIF/BMP/WEBP images directly.'
  }
  return 'The --openai-ocr engine supports PDF and PNG/JPG/WEBP/GIF images directly. Convert BMP/TIF images to PNG/JPG first, or install ImageMagick so AutoShow can normalize them automatically.'
}

const assertSupportedHostedDirectImageFormat = (
  format: string,
  engine: HostedExtractOcrEngine
): void => {
  const supportedFormats = engine === 'glm-ocr'
    ? new Set(['png', 'jpg'])
    : engine === 'kimi-ocr'
      ? new Set(['png', 'jpg', 'webp', 'gif'])
      : engine === 'mistral-ocr'
        ? new Set(['png', 'jpg', 'tif'])
        : engine === 'anthropic-ocr'
          ? new Set(['png', 'jpg', 'webp', 'gif'])
          : engine === 'gemini-ocr'
            ? new Set(['png', 'jpg', 'webp', 'bmp'])
            : engine === 'deepinfra-ocr'
              ? new Set(['png', 'jpg', 'webp'])
              : engine === 'aws-textract'
                ? new Set(['png', 'jpg', 'tif'])
                : engine === 'gcloud-docai'
                  ? new Set(['png', 'jpg', 'tif', 'gif', 'bmp', 'webp'])
                  : new Set(['png', 'jpg', 'webp', 'gif'])

  if (!supportedFormats.has(format)) {
    throw CLIUsageError(getHostedDirectImageSupportError(engine))
  }
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

  if (engine !== 'openai-ocr') {
    if (engine === 'anthropic-ocr') {
      if (normalizedFormat === 'bmp' || normalizedFormat === 'tif') {
        if (!commandExists('convert')) {
          throw CLIUsageError(getHostedDirectImageSupportError(engine))
        }

        const pngPath = join(tempDir, `${outputStem}.png`)
        const result = await exec('convert', [imagePath, pngPath])
        if (result.exitCode !== 0) {
          throw CLIUsageError(`Failed to normalize ${basename(imagePath)} for --anthropic-ocr. ${result.stderr || result.stdout || 'ImageMagick convert failed.'}`)
        }

        return { filePath: pngPath, format: 'png' }
      }
    }

    if (engine === 'gemini-ocr') {
      if (normalizedFormat === 'gif' || normalizedFormat === 'tif') {
        if (!commandExists('convert')) {
          throw CLIUsageError(getHostedDirectImageSupportError(engine))
        }

        const pngPath = join(tempDir, `${outputStem}.png`)
        const result = await exec('convert', [imagePath, pngPath])
        if (result.exitCode !== 0) {
          throw CLIUsageError(`Failed to normalize ${basename(imagePath)} for --gemini-ocr. ${result.stderr || result.stdout || 'ImageMagick convert failed.'}`)
        }

        return { filePath: pngPath, format: 'png' }
      }
    }

    if (engine === 'aws-textract') {
      if (normalizedFormat === 'bmp' || normalizedFormat === 'webp' || normalizedFormat === 'gif') {
        if (!commandExists('convert')) {
          throw CLIUsageError(getHostedDirectImageSupportError(engine))
        }

        const pngPath = join(tempDir, `${outputStem}.png`)
        const result = await exec('convert', [imagePath, pngPath])
        if (result.exitCode !== 0) {
          throw CLIUsageError(`Failed to normalize ${basename(imagePath)} for --aws-textract. ${result.stderr || result.stdout || 'ImageMagick convert failed.'}`)
        }

        return { filePath: pngPath, format: 'png' }
      }
    }

    if (engine === 'deepinfra-ocr') {
      if (normalizedFormat === 'gif' || normalizedFormat === 'bmp' || normalizedFormat === 'tif') {
        if (!commandExists('convert')) {
          throw CLIUsageError(getHostedDirectImageSupportError(engine))
        }

        const pngPath = join(tempDir, `${outputStem}.png`)
        const result = await exec('convert', [imagePath, pngPath])
        if (result.exitCode !== 0) {
          throw CLIUsageError(`Failed to normalize ${basename(imagePath)} for --deepinfra-ocr. ${result.stderr || result.stdout || 'ImageMagick convert failed.'}`)
        }

        return { filePath: pngPath, format: 'png' }
      }
    }

    if (engine === 'kimi-ocr') {
      if (normalizedFormat === 'bmp' || normalizedFormat === 'tif') {
        if (!commandExists('convert')) {
          throw CLIUsageError(getHostedDirectImageSupportError(engine))
        }

        const pngPath = join(tempDir, `${outputStem}.png`)
        const result = await exec('convert', [imagePath, pngPath])
        if (result.exitCode !== 0) {
          throw CLIUsageError(`Failed to normalize ${basename(imagePath)} for --kimi-ocr. ${result.stderr || result.stdout || 'ImageMagick convert failed.'}`)
        }

        return { filePath: pngPath, format: 'png' }
      }
    }

    assertSupportedHostedDirectImageFormat(normalizedFormat, engine)
    return { filePath: imagePath, format: normalizedFormat as DocumentMetadata['format'] }
  }

  if (normalizedFormat === 'png' || normalizedFormat === 'jpg' || normalizedFormat === 'webp' || normalizedFormat === 'gif') {
    return { filePath: imagePath, format: normalizedFormat }
  }

  if (normalizedFormat !== 'bmp' && normalizedFormat !== 'tif') {
    throw CLIUsageError(getHostedDirectImageSupportError(engine))
  }

  if (!commandExists('convert')) {
    throw CLIUsageError(getHostedDirectImageSupportError(engine))
  }

  const pngPath = join(tempDir, `${outputStem}.png`)
  const result = await exec('convert', [imagePath, pngPath])
  if (result.exitCode !== 0) {
    throw CLIUsageError(`Failed to normalize ${basename(imagePath)} for --openai-ocr. ${result.stderr || result.stdout || 'ImageMagick convert failed.'}`)
  }

  return { filePath: pngPath, format: 'png' }
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
    runFull: async () => withHostedUsageDetail(await runProvider(filePath, step1Metadata), {
      unit: 'document',
      pages: Math.max(1, step1Metadata.pageCount)
    }),
    runChunk: async (chunkPath, chunkMetadata, range) => withHostedUsageDetail(await runProvider(chunkPath, chunkMetadata), {
      unit: 'chunk',
      pageStart: range.startPage,
      pageEnd: range.endPage,
      pages: Math.max(1, chunkMetadata.pageCount)
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
    return await runChunkableHostedPdfOcr(filePath, step1Metadata, opts, 'Mistral OCR', async (inputPath, inputMetadata) => {
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
    return await runChunkableHostedPdfOcr(filePath, step1Metadata, opts, 'GLM OCR', async (inputPath, inputMetadata) => {
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
    return await runChunkableHostedPdfOcr(filePath, step1Metadata, opts, 'OpenAI OCR', async (inputPath, inputMetadata) => {
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

  if (hasAnthropicOcr(opts)) {
    await ensureAnthropicOcrSetup()
    warnAnthropicOnlyFlags(opts)
    const ocrModel = opts.anthropicOcrModel as string
    return await runChunkableHostedPdfOcr(filePath, step1Metadata, opts, 'Anthropic OCR', async (inputPath, inputMetadata) => {
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
    return await runChunkableHostedPdfOcr(filePath, step1Metadata, opts, 'Gemini OCR', async (inputPath, inputMetadata) => {
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
    return await runChunkableHostedPdfOcr(filePath, step1Metadata, opts, 'AWS Textract', async (inputPath, inputMetadata) => {
      await assertHostedOcrWithinLimits(inputPath, inputMetadata, opts)
      const run = await runAwsTextract(inputPath, inputMetadata, ocrModel, {
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
    return await runChunkableHostedPdfOcr(filePath, step1Metadata, opts, 'Google Cloud Document AI', async (inputPath, inputMetadata) => {
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

  throw CLIUsageError('Hosted OCR requested without a configured hosted OCR model.')
}
