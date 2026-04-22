import { mkdir, rm } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { writeFile } from '~/utils/cli-utils'
import { validateData } from '~/utils/validate/validation'
import {
  ExtractionOptionsSchema,
  type ExtractionOptions,
  type ProcessDocumentOutput,
  type ExtractionMetadata,
  type ExtractionResult,
  type PreparedDocument,
  type Step1SourceRef,
  type OcrResumeRun
} from '~/types'
import { computeActualCosts, computeEstimatedCosts } from '~/utils/pricing/compute-costs'
import { computeActualProcessingTimes, computeEstimatedProcessingTimes } from '~/utils/pricing/compute-processing-time'
import { downloadDocument } from './step-1-download/document/dl-document'
import { runOcr } from './step-2-ocr/orchestrator'
import { runWithLogContext } from '~/logger'
import {
  buildExtractionOptionsForTarget,
  collectExplicitOcrTargets,
  getOcrTargetDirectoryName
} from './step-2-ocr/ocr-targets'
import {
  buildMetadataErrorEntries,
  buildMissingProviders,
  buildProviderStates,
  pickPrimarySuccess,
  readExistingOcrRun,
  resolveCompletionStatus,
  toRequestedProvider,
  type OcrCompletionStatus,
  type OcrProviderSuccess
} from './step-2-ocr/ocr-run-state'
import { writeOcrRunManifest } from './step-2-ocr/manifest'
import { FIRECRAWL_PRICE_NOTE } from './step-2-ocr/ocr-utils/extract-pricing'
import { serializeOneOrMany } from './target-runner'
import { writeProviderResult } from './manifest-utils'
import type { TextArtifactFile } from './step-2-ocr/epub/export'

const isEpubInspectMode = (metadata: ExtractionMetadata): boolean =>
  metadata.extractionMethod === 'epub-bun' || metadata.extractionMethod === 'epub-calibre'

const collectEstimatedExtractTargets = (
  metadata: ExtractionMetadata | ExtractionMetadata[],
  opts: Pick<ExtractionOptions, 'mistralOcrModel' | 'glmOcrModel' | 'openaiOcrModel'>
): Array<{
  provider: 'mistral' | 'glm' | 'openai' | 'firecrawl'
  model: string
  pageCount?: number
  promptTokens?: number
  completionTokens?: number
  estimateType?: 'heuristic' | 'exact'
  note?: string
}> => {
  const targets: Array<{
    provider: 'mistral' | 'glm' | 'openai' | 'firecrawl'
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
    }
  }

  return targets
}

const writeExtractionArtifact = async (
  outputDir: string,
  extractionResult: ExtractionResult,
  outputFormat: ExtractionOptions['outputFormat'],
  epubInspectMode: boolean,
  jsonFileName = 'result.json'
): Promise<void> => {
  if (epubInspectMode) {
    return
  }

  if (outputFormat === 'text') {
    await writeFile(`${outputDir}/extraction.txt`, extractionResult.text)
    return
  }

  if (outputFormat === 'json') {
    if (jsonFileName) {
      await writeFile(`${outputDir}/${jsonFileName}`, JSON.stringify(extractionResult, null, 2))
    }
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

const writeProviderArtifacts = async (
  providerDir: string,
  target: { service: string, model: string },
  extractionResult: ExtractionResult,
  step2Metadata: ExtractionMetadata,
  outputFormat: ExtractionOptions['outputFormat']
): Promise<void> => {
  await writeExtractionArtifact(
    providerDir,
    extractionResult,
    outputFormat,
    isEpubInspectMode(step2Metadata),
    undefined
  )
  await writeProviderResult(
    providerDir,
    target.service,
    target.model,
    step2Metadata as Record<string, unknown>,
    extractionResult as Record<string, unknown>
  )
}

const writeTextArtifactFiles = async (
  outputDir: string,
  files: TextArtifactFile[]
): Promise<void> => {
  const topLevelDirs = [...new Set(
    files
      .map((file) => file.relativePath.split('/')[0])
      .filter((dir): dir is string => typeof dir === 'string' && dir.length > 0)
  )]

  for (const dir of topLevelDirs) {
    await rm(join(outputDir, dir), { recursive: true, force: true })
    await mkdir(join(outputDir, dir), { recursive: true })
  }

  for (const file of files) {
    const absolutePath = join(outputDir, file.relativePath)
    await mkdir(dirname(absolutePath), { recursive: true })
    await writeFile(absolutePath, file.text)
  }
}

const buildDocumentSource = (
  filePath: string,
  sourceRef?: Step1SourceRef
): Step1SourceRef => {
  if (typeof sourceRef?.url === 'string' && sourceRef.url.length > 0) {
    return { url: sourceRef.url }
  }
  if (typeof sourceRef?.filePath === 'string' && sourceRef.filePath.length > 0) {
    return { filePath: sourceRef.filePath }
  }
  return { filePath }
}

type OcrMetadataOptions = {
  failures?: Array<{ service: string, model: string, message: string }>
  web?: ProcessDocumentOutput['web']
  source?: Step1SourceRef
  completionStatus?: OcrCompletionStatus
  requestedProviders?: Array<{ service: string, model: string }>
  providerStates?: Array<Record<string, unknown>>
  missingProviders?: Array<{ service: string, model: string }>
}

const buildDocumentMetadataPayload = (
  step1Metadata: ProcessDocumentOutput['step1Metadata'],
  step2Metadata: ProcessDocumentOutput['step2Metadata'] | undefined,
  opts: ExtractionOptions,
  options: OcrMetadataOptions = {}
): Record<string, unknown> => {
  const normalizedStep2 = step2Metadata === undefined
    ? []
    : Array.isArray(step2Metadata)
      ? step2Metadata
      : [step2Metadata]
  const failures = options.failures ?? []
  const extractTargets = collectEstimatedExtractTargets(normalizedStep2, opts)
  const estimated = computeEstimatedCosts({
    extractTargets
  })
  const actual = computeActualCosts({ step2: normalizedStep2 })
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
    step2: normalizedStep2,
  })
  const timing = estimatedTiming.steps.length > 0 || actualTiming.steps.length > 0
    ? { estimated: estimatedTiming, actual: actualTiming }
    : undefined

  return {
    step1: step1Metadata,
    step2: serializeOneOrMany(normalizedStep2),
    ...(options.web ? { web: options.web } : {}),
    ...(options.source ? { source: options.source } : {}),
    cost,
    ...(timing ? { timing } : {}),
    ...(options.completionStatus ? { completionStatus: options.completionStatus } : {}),
    ...(options.requestedProviders ? { requestedProviders: options.requestedProviders } : {}),
    ...(options.providerStates ? { providerStates: options.providerStates } : {}),
    ...(options.missingProviders ? { missingProviders: options.missingProviders } : {}),
    ...(failures.length > 0 ? { errors: failures } : {}),
  }
}

class OcrBatchCompletionError extends Error {
  outputDir: string
  completionStatus: OcrCompletionStatus
  exitCode: number

  constructor(outputDir: string, completionStatus: OcrCompletionStatus, message: string) {
    super(message)
    this.name = 'OcrBatchCompletionError'
    this.outputDir = outputDir
    this.completionStatus = completionStatus
    this.exitCode = 2
  }
}

export const processOcr = async (
  filePath: string,
  rawOpts: Partial<ExtractionOptions>,
  sourceRef?: Step1SourceRef,
  preparedDocument?: PreparedDocument,
  resumeRun?: OcrResumeRun
): Promise<ProcessDocumentOutput> => {
  const resolvedOutputDir = resumeRun?.outputDir !== undefined
    ? resumeRun.outputDir
    : rawOpts.outputDir || './output'

  const opts = validateData(ExtractionOptionsSchema, {
    filePath,
    outputDir: resolvedOutputDir,
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
    ...(rawOpts.openaiOcrModel ? { openaiOcrModel: rawOpts.openaiOcrModel } : {}),
    ...(rawOpts.epubChapterFiles ? { epubChapterFiles: true } : {}),
    ...(typeof rawOpts.epubChunkLimitChars === 'number' ? { epubChunkLimitChars: rawOpts.epubChunkLimitChars } : {}),
    pdfChapterMode: rawOpts.pdfChapterMode ?? 'local',
    ...(rawOpts.pdfChapterLlmService ? { pdfChapterLlmService: rawOpts.pdfChapterLlmService } : {}),
    ...(rawOpts.pdfChapterLlmModel ? { pdfChapterLlmModel: rawOpts.pdfChapterLlmModel } : {}),
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

  const explicitTargets = opts.preparedMarkdown ? [] : collectExplicitOcrTargets(opts)
  const documentSource = buildDocumentSource(filePath, sourceRef)

  try {
    if (resumeRun || explicitTargets.length > 1) {
      const requestedTargets = resumeRun?.requestedTargets ?? explicitTargets
      const targetsToRun = resumeRun?.targetsToRun ?? requestedTargets
      const providersDir = `${outputDir}/providers`
      await mkdir(providersDir, { recursive: true })

      const existingRun = await readExistingOcrRun(outputDir, requestedTargets)
      const successes: Array<OcrProviderSuccess | undefined> = [...existingRun.successes]
      const failuresByIndex = new Map<number, { message: string, retryable?: boolean | undefined }>()
      const failures: Array<{ service: string, model: string, message: string }> = []

      for (const target of targetsToRun) {
        const requestedIndex = requestedTargets.findIndex((requestedTarget) =>
          requestedTarget.service === target.service && requestedTarget.model === target.model
        )
        if (requestedIndex === -1) {
          continue
        }

        const providerDirName = getOcrTargetDirectoryName(target)
        const providerDir = `${providersDir}/${providerDirName}`
        await mkdir(providerDir, { recursive: true })

        try {
          const providerOpts = buildExtractionOptionsForTarget({
            ...opts,
            outputDir: providerDir
          }, target)
          const extracted = await runWithLogContext({ step: 'step-2-ocr', provider: providerDirName }, async () =>
            await runOcr(extractFilePath, step1Metadata, providerOpts)
          )

          await writeProviderArtifacts(
            providerDir,
            target,
            extracted.result,
            extracted.step2Metadata,
            opts.outputFormat ?? 'text'
          )

          successes[requestedIndex] = {
            target,
            result: extracted.result,
            metadata: extracted.step2Metadata,
            relativeDir: `providers/${providerDirName}`
          }
          failuresByIndex.delete(requestedIndex)
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error)
          failuresByIndex.set(requestedIndex, { message })
          failures.push({
            service: target.service,
            model: target.model,
            message
          })
        }
      }

      const providerStates = buildProviderStates(
        requestedTargets,
        successes,
        failuresByIndex,
        existingRun.providerStates
      )
      const missingProviders = buildMissingProviders(providerStates, requestedTargets)
      const completionStatus = resolveCompletionStatus(requestedTargets, successes)
      const metadataErrors = buildMetadataErrorEntries(providerStates).map((value) => ({
        service: value['service'] as string,
        model: value['model'] as string,
        message: value['message'] as string
      }))
      const step2Metadata = successes
        .filter((entry): entry is OcrProviderSuccess => entry !== undefined)
        .map((entry) => entry.metadata)
      const primary = pickPrimarySuccess(requestedTargets, successes)

      await writeOcrRunManifest(
        outputDir,
        buildDocumentMetadataPayload(step1Metadata, step2Metadata, opts, {
          failures: metadataErrors,
          web,
          source: documentSource,
          completionStatus,
          requestedProviders: requestedTargets.map(toRequestedProvider),
          providerStates,
          missingProviders
        })
      )

      if (!primary) {
        throw new OcrBatchCompletionError(
          outputDir,
          completionStatus,
          `No extract outputs were generated. ${failures.map((failure) => `${failure.service}/${failure.model}: ${failure.message}`).join('; ')}`
        )
      }

      await writeExtractionArtifact(
        outputDir,
        primary.result,
        opts.outputFormat ?? 'text',
        isEpubInspectMode(primary.metadata),
        'result.json'
      )

      return {
        result: primary.result,
        step1Metadata,
        step2Metadata,
        completionStatus,
        requestedProviders: requestedTargets.map(toRequestedProvider),
        providerStates,
        missingProviders,
        ...(web ? { web } : {}),
        ...(failures.length > 0 ? { step2Errors: failures } : {}),
        outputDir
      }
    }

    const singleTargetOpts = explicitTargets.length === 1
      ? buildExtractionOptionsForTarget(opts, explicitTargets[0] as typeof explicitTargets[number])
      : opts
    const extracted = await runWithLogContext({ step: 'step-2-ocr' }, async () =>
      await runOcr(extractFilePath, step1Metadata, singleTargetOpts)
    )

    const rootMetadata = buildDocumentMetadataPayload(step1Metadata, extracted.step2Metadata, opts, {
      web,
      source: documentSource,
      completionStatus: 'full',
      ...(explicitTargets.length === 1
        ? {
            requestedProviders: explicitTargets.map(toRequestedProvider),
            missingProviders: []
          }
        : {})
    })
    await writeOcrRunManifest(outputDir, rootMetadata)
    await writeExtractionArtifact(
      outputDir,
      extracted.result,
      opts.outputFormat ?? 'text',
      isEpubInspectMode(extracted.step2Metadata),
      'result.json'
    )
    if (Array.isArray(extracted.artifactFiles)) {
      await writeTextArtifactFiles(outputDir, extracted.artifactFiles)
    }

    return {
      result: extracted.result,
      step1Metadata,
      step2Metadata: extracted.step2Metadata,
      completionStatus: 'full',
      ...(explicitTargets.length === 1
        ? {
            requestedProviders: explicitTargets.map(toRequestedProvider),
            missingProviders: []
          }
        : {}),
      ...(web ? { web } : {}),
      outputDir
    }
  } finally {
    if (tempCleanup) await tempCleanup()
  }
}
