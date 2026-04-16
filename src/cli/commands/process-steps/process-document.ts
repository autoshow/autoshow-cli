import { mkdir, rm } from 'node:fs/promises'
import { writeFile } from '~/utils/cli-utils'
import { validateData } from '~/utils/validate/validation'
import {
  ExtractionOptionsSchema,
  type ExtractionOptions,
  type ProcessDocumentOutput,
  type ExtractionMetadata,
  type ExtractionResult,
  type PreparedDocument
} from '~/types'
import { computeActualCosts, computeEstimatedCosts } from '~/utils/pricing/compute-costs'
import { computeActualProcessingTimes, computeEstimatedProcessingTimes } from '~/utils/pricing/compute-processing-time'
import { downloadDocument } from './step-1-download/document/dl-document'
import { runExtract } from './step-2-document/run-extract'
import { runWithLogContext } from '~/logger'
import type { Step1SourceRef } from './step-1-download/audio/metadata-utils'
import {
  buildExtractionOptionsForTarget,
  collectExplicitExtractTargets,
  getExtractTargetDirectoryName,
  type ExtractTarget
} from './step-2-document/extract-targets'
import { FIRECRAWL_PRICE_NOTE } from './step-2-document/document-utils/extract-pricing'
import { serializeOneOrMany } from './target-runner'

const isEpubInspectMode = (metadata: ExtractionMetadata): boolean =>
  metadata.extractionMethod === 'epub-bun' || metadata.extractionMethod === 'epub-calibre'

const collectEstimatedExtractTargets = (
  metadata: ExtractionMetadata | ExtractionMetadata[],
  opts: Pick<ExtractionOptions, 'mistralOcrModel' | 'glmOcrModel'>
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

const writeExtractionArtifact = async (
  outputDir: string,
  extractionResult: ExtractionResult,
  outputFormat: ExtractionOptions['outputFormat'],
  epubInspectMode: boolean
): Promise<void> => {
  if (epubInspectMode) {
    return
  }

  if (outputFormat === 'text') {
    await writeFile(`${outputDir}/extraction.txt`, extractionResult.text)
    return
  }

  if (outputFormat === 'json') {
    await writeFile(`${outputDir}/extraction.json`, JSON.stringify(extractionResult, null, 2))
    return
  }

  if (outputFormat === 'tsv') {
    const tsv = extractionResult.pages.map(p => `${p.pageNumber}\t${p.text.replace(/\n/g, ' ')}`).join('\n')
    await writeFile(`${outputDir}/extraction.tsv`, tsv)
    return
  }

  const hocr = extractionResult.pages.map(p => `<div class="page" data-page="${p.pageNumber}">${p.text}</div>`).join('\n')
  await writeFile(`${outputDir}/extraction.hocr`, hocr)
}

const buildDocumentMetadataPayload = (
  step1Metadata: ProcessDocumentOutput['step1Metadata'],
  step2Metadata: ProcessDocumentOutput['step2Metadata'],
  opts: ExtractionOptions,
  failures: Array<{ service: string, model: string, message: string }> = [],
  web?: ProcessDocumentOutput['web']
): Record<string, unknown> => {
  const extractTargets = collectEstimatedExtractTargets(step2Metadata, opts)
  const estimated = computeEstimatedCosts({
    extractTargets
  })
  const actual = computeActualCosts({ step2: step2Metadata })
  const cost = { estimated, actual }

  const estimatedTiming = computeEstimatedProcessingTimes({
    extractTargets: extractTargets.map((target) => ({
      provider: target.provider,
      model: target.model,
      pageCount: target.pageCount ?? step1Metadata.pageCount
    })),
  })
  const actualTiming = computeActualProcessingTimes({
    step1: step1Metadata,
    step2: step2Metadata,
  })
  const timing = estimatedTiming.steps.length > 0 || actualTiming.steps.length > 0
    ? { estimated: estimatedTiming, actual: actualTiming }
    : undefined

  return {
    step1: step1Metadata,
    step2: serializeOneOrMany(Array.isArray(step2Metadata) ? step2Metadata : [step2Metadata]),
    ...(web ? { web } : {}),
    cost,
    ...(timing ? { timing } : {}),
    ...(failures.length > 0 ? { errors: failures } : {}),
  }
}

export const processDocument = async (
  filePath: string,
  rawOpts: Partial<ExtractionOptions>,
  sourceRef?: Step1SourceRef,
  preparedDocument?: PreparedDocument
): Promise<ProcessDocumentOutput> => {
  const opts = validateData(ExtractionOptionsSchema, {
    filePath,
    outputDir: rawOpts.outputDir || './output',
    dpi: rawOpts.dpi ?? 300,
    languages: rawOpts.languages ?? 'eng',
    oem: rawOpts.oem ?? 1,
    psm: rawOpts.psm ?? 3,
    outputFormat: rawOpts.outputFormat ?? 'text',
    password: rawOpts.password,
    pageSeparator: rawOpts.pageSeparator ?? '\n\n',
    renderConcurrency: rawOpts.renderConcurrency,
    ocrConcurrency: rawOpts.ocrConcurrency,
    preserveInterwordSpaces: rawOpts.preserveInterwordSpaces ?? false,
    rotate: rawOpts.rotate ?? 0,
    ...(rawOpts.useOcrmypdf ? { useOcrmypdf: true } : {}),
    ...(rawOpts.usePaddleOcr ? { usePaddleOcr: true } : {}),
    ...(rawOpts.mistralOcrModel ? { mistralOcrModel: rawOpts.mistralOcrModel } : {}),
    ...(rawOpts.glmOcrModel ? { glmOcrModel: rawOpts.glmOcrModel } : {}),
    ...(rawOpts.useEpubBun ? { useEpubBun: true } : {}),
    ...(rawOpts.useEpubCalibre ? { useEpubCalibre: true } : {}),
    ...(preparedDocument?.preparedMarkdown ? { preparedMarkdown: preparedDocument.preparedMarkdown } : {}),
    ...(preparedDocument?.htmlArticleBackend ? { htmlArticleBackend: preparedDocument.htmlArticleBackend } : {})
  }, 'document extraction options')

  const prepared = preparedDocument
    ? preparedDocument
    : await runWithLogContext({ step: 'step-1-download' }, async () =>
      await downloadDocument(filePath, opts.outputDir, opts.password, sourceRef)
    )

  const { outputDir, step1Metadata, effectiveFilePath, tempCleanup, web } = prepared
  const extractFilePath = effectiveFilePath ?? filePath

  const explicitTargets = opts.preparedMarkdown ? [] : collectExplicitExtractTargets(opts)

  try {
    if (explicitTargets.length > 1) {
      const providersDir = `${outputDir}/providers`
      await mkdir(providersDir, { recursive: true })

      const successes: Array<{
        target: ExtractTarget
        result: ExtractionResult
        step2Metadata: ExtractionMetadata
      }> = []
      const failures: Array<{ service: string, model: string, message: string }> = []

      for (const target of explicitTargets) {
        const providerDirName = getExtractTargetDirectoryName(target)
        const providerDir = `${providersDir}/${providerDirName}`
        await mkdir(providerDir, { recursive: true })

        try {
          const providerOpts = buildExtractionOptionsForTarget({
            ...opts,
            outputDir: providerDir
          }, target)
          const extracted = await runWithLogContext({ step: 'step-2-document', provider: providerDirName }, async () =>
            await runExtract(extractFilePath, step1Metadata, providerOpts)
          )

          await writeExtractionArtifact(
            providerDir,
            extracted.result,
            opts.outputFormat ?? 'text',
            isEpubInspectMode(extracted.step2Metadata)
          )
          await writeFile(`${providerDir}/metadata.json`, JSON.stringify(extracted.step2Metadata, null, 2))

          successes.push({
            target,
            result: extracted.result,
            step2Metadata: extracted.step2Metadata
          })
        } catch (error) {
          await rm(providerDir, { recursive: true, force: true })
          failures.push({
            service: target.service,
            model: target.model,
            message: error instanceof Error ? error.message : String(error)
          })
        }
      }

      if (successes.length === 0) {
        throw new Error(`No extract outputs were generated. ${failures.map((failure) => `${failure.service}/${failure.model}: ${failure.message}`).join('; ')}`)
      }

      const primary = successes[0] as (typeof successes)[number]
      const step2Metadata = successes.map((entry) => entry.step2Metadata)

      await writeFile(
        `${outputDir}/metadata.json`,
        JSON.stringify(buildDocumentMetadataPayload(step1Metadata, step2Metadata, opts, failures, web), null, 2)
      )
      await writeExtractionArtifact(
        outputDir,
        primary.result,
        opts.outputFormat ?? 'text',
        isEpubInspectMode(primary.step2Metadata)
      )

      return {
        result: primary.result,
        step1Metadata,
        step2Metadata,
        ...(web ? { web } : {}),
        ...(failures.length > 0 ? { step2Errors: failures } : {}),
        outputDir
      }
    }

    const extracted = await runWithLogContext({ step: 'step-2-document' }, async () =>
      await runExtract(extractFilePath, step1Metadata, opts)
    )

    await writeFile(
      `${outputDir}/metadata.json`,
      JSON.stringify(buildDocumentMetadataPayload(step1Metadata, extracted.step2Metadata, opts, [], web), null, 2)
    )
    await writeExtractionArtifact(
      outputDir,
      extracted.result,
      opts.outputFormat ?? 'text',
      isEpubInspectMode(extracted.step2Metadata)
    )

    return {
      result: extracted.result,
      step1Metadata,
      step2Metadata: extracted.step2Metadata,
      ...(web ? { web } : {}),
      outputDir
    }
  } finally {
    if (tempCleanup) await tempCleanup()
  }
}
