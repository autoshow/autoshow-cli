import { mkdir, rm } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { writeFile } from '~/utils/cli-utils'
import { validateData } from '~/utils/validate/validation'
import {
  ExtractionOptionsSchema,
  type AggregatedPriceEstimate,
  type ExtractionOptions,
  type ExtractionMetadata,
  type ExtractionResult,
  type OcrCompletionStatus,
  type OcrMetadataOptions,
  type OcrProviderSuccess,
  type PreparedDocument,
  type ProcessDocumentOutput,
  type ResolvedStep2Execution,
  type Step1SourceRef,
  type TextArtifactFile,
  type OcrResumeRun
} from '~/types'
import { computeActualCosts } from '~/utils/pricing/compute-actual-costs'
import { computeActualProcessingTimes, computeEstimatedProcessingTimes } from '~/utils/pricing/compute-processing-time'
import { downloadDocument } from '../../step-1-download/document/dl-document'
import { runOcr } from './orchestrator'
import { l, runWithLogContext } from '~/utils/logger'
import {
  buildExtractionOptionsForTarget,
  collectExplicitOcrTargets,
  getOcrTargetDirectoryName,
  resolvePrimaryOcrTarget
} from './ocr-targets'
import {
  classifyOcrProviderFailure,
  buildMetadataErrorEntries,
  buildMissingProviders,
  buildProviderStates,
  readExistingOcrRun,
  resolveCompletionStatus,
  toRequestedProvider
} from './ocr-run-state'
import { runOcrProviderTargetPools } from './ocr-provider-pool'
import { writeOcrRunManifest } from './manifest'
import { serializeOneOrMany } from '../../target-runner'
import { writeProviderResult } from '../../manifest-utils'
import { resolveOcrStep2ExecutionFromFormat } from '../step-2-shared/resolved-step2'
import { getOutputRoot } from '~/cli/commands/process-steps/output-root'
import { buildOcrCostDiagnostics, collectEstimatedExtractTargets, resolveExtractEstimatedCosts } from './ocr-costs'
import { logExtractManifestConsoleSummary } from '../../write-manifest-log'
import { logOcrProviderLifecycle } from './ocr-logging'
import { cleanupOcrPreparationCache, createOcrPreparationCache } from './ocr-utils/preparation-cache'
import { writeInvalidOcrStructuredResponse } from './ocr-structured-response-error'

const isEpubInspectMode = (metadata: ExtractionMetadata): boolean =>
  metadata.extractionMethod === 'epub-bun' || metadata.extractionMethod === 'epub-calibre'

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

const isRemoteDocumentSource = (
  source: Step1SourceRef
): boolean => typeof source.url === 'string' && /^https?:\/\//i.test(source.url)

const resolveRecordedOcrStep2 = (
  format: ProcessDocumentOutput['step1Metadata']['format'],
  opts: ExtractionOptions,
  source: Step1SourceRef,
  requestedTargets?: Array<{ service: string, model: string }>,
  preparedMarkdown?: string
): ResolvedStep2Execution => {
  const resolved = resolveOcrStep2ExecutionFromFormat(format as Parameters<typeof resolveOcrStep2ExecutionFromFormat>[0], {
    ...opts,
    preparedMarkdown,
    localHtmlDocument: format === 'html' && !isRemoteDocumentSource(source)
  } as unknown as Parameters<typeof resolveOcrStep2ExecutionFromFormat>[1])

  if (resolved.route !== 'ocr' || !requestedTargets || requestedTargets.length === 0) {
    return resolved
  }

  return {
    ...resolved,
    providers: requestedTargets.map((target) => ({
      service: target.service,
      model: target.model,
      origin: resolved.providers.find((provider) =>
        provider.service === target.service && provider.model === target.model
      )?.origin
    }))
  }
}

const toResolvedRequestedProviders = (
  resolvedStep2: ResolvedStep2Execution
): Array<{ service: string, model: string }> | undefined =>
  resolvedStep2.route === 'ocr'
    ? resolvedStep2.providers.map((provider) => ({
        service: provider.service,
        model: provider.model
      }))
    : undefined

const buildSuccessfulResolvedProviderStates = (
  resolvedProviders: Array<{ service: string, model: string }>
): Array<Record<string, unknown>> =>
  resolvedProviders.map((provider) => ({
    service: provider.service,
    model: provider.model,
    artifactDir: '.',
    status: 'succeeded',
    attempts: 1
  }))

const buildDocumentMetadataPayload = (
  step1Metadata: ProcessDocumentOutput['step1Metadata'],
  step2Metadata: ProcessDocumentOutput['step2Metadata'] | undefined,
  options: OcrMetadataOptions & { preflightEstimate?: AggregatedPriceEstimate | undefined } = {}
): Record<string, unknown> => {
  const normalizedStep2 = step2Metadata === undefined
    ? []
    : Array.isArray(step2Metadata)
      ? step2Metadata
      : [step2Metadata]
  const failures = options.failures ?? []
  const extractTargets = collectEstimatedExtractTargets(normalizedStep2)
  const estimated = resolveExtractEstimatedCosts(options.preflightEstimate, normalizedStep2)
  const actual = computeActualCosts({ step2: normalizedStep2 })
  const ocrDiagnostics = buildOcrCostDiagnostics(normalizedStep2, estimated, actual)
  const cost = {
    estimated,
    actual,
    ...(ocrDiagnostics.length > 0 ? { ocrDiagnostics } : {})
  }

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
    ...(options.resolvedStep2 ? { resolvedStep2: options.resolvedStep2 } : {}),
    cost,
    ...(timing ? { timing } : {}),
    ...(options.completionStatus ? { completionStatus: options.completionStatus } : {}),
    ...(options.requestedProviders ? { requestedProviders: options.requestedProviders } : {}),
    ...(options.providerStates ? { providerStates: options.providerStates } : {}),
    ...(options.missingProviders ? { missingProviders: options.missingProviders } : {}),
    ...(options.primaryProvider ? { primaryProvider: options.primaryProvider } : {}),
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
  preflightEstimate?: AggregatedPriceEstimate,
  resumeRun?: OcrResumeRun
): Promise<ProcessDocumentOutput> => {
  const resolvedOutputDir = resumeRun?.outputDir !== undefined
    ? resumeRun.outputDir
    : rawOpts.outputDir || getOutputRoot()

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
    ocrProviderConcurrency: rawOpts.ocrProviderConcurrency ?? 2,
    ocrLocalConcurrency: rawOpts.ocrLocalConcurrency ?? 1,
    preserveInterwordSpaces: rawOpts.preserveInterwordSpaces ?? false,
    rotate: rawOpts.rotate ?? 0,
    ...(rawOpts.useTesseract ? { useTesseract: true } : {}),
    ...(rawOpts.useOcrmypdf ? { useOcrmypdf: true } : {}),
    ...(rawOpts.usePaddleOcr ? { usePaddleOcr: true } : {}),
    ...(rawOpts.mistralOcrModel ? { mistralOcrModel: rawOpts.mistralOcrModel } : {}),
    ...(rawOpts.mistralOcrModels ? { mistralOcrModels: rawOpts.mistralOcrModels } : {}),
    ...(rawOpts.glmOcrModel ? { glmOcrModel: rawOpts.glmOcrModel } : {}),
    ...(rawOpts.glmOcrModels ? { glmOcrModels: rawOpts.glmOcrModels } : {}),
    ...(rawOpts.kimiOcrModel ? { kimiOcrModel: rawOpts.kimiOcrModel } : {}),
    ...(rawOpts.kimiOcrModels ? { kimiOcrModels: rawOpts.kimiOcrModels } : {}),
    ...(rawOpts.openaiOcrModel ? { openaiOcrModel: rawOpts.openaiOcrModel } : {}),
    ...(rawOpts.openaiOcrModels ? { openaiOcrModels: rawOpts.openaiOcrModels } : {}),
    ...(rawOpts.anthropicOcrModel ? { anthropicOcrModel: rawOpts.anthropicOcrModel } : {}),
    ...(rawOpts.anthropicOcrModels ? { anthropicOcrModels: rawOpts.anthropicOcrModels } : {}),
    ...(rawOpts.geminiOcrModel ? { geminiOcrModel: rawOpts.geminiOcrModel } : {}),
    ...(rawOpts.geminiOcrModels ? { geminiOcrModels: rawOpts.geminiOcrModels } : {}),
    ...(rawOpts.deepinfraOcrModel ? { deepinfraOcrModel: rawOpts.deepinfraOcrModel } : {}),
    ...(rawOpts.deepinfraOcrModels ? { deepinfraOcrModels: rawOpts.deepinfraOcrModels } : {}),
    ...(rawOpts.awsTextractModel ? { awsTextractModel: rawOpts.awsTextractModel } : {}),
    ...(rawOpts.awsTextractModels ? { awsTextractModels: rawOpts.awsTextractModels } : {}),
    ...(rawOpts.awsRegion ? { awsRegion: rawOpts.awsRegion } : {}),
    ...(rawOpts.awsBucket ? { awsBucket: rawOpts.awsBucket } : {}),
    ...(rawOpts.configPath ? { configPath: rawOpts.configPath } : {}),
    ...(rawOpts.gcloudDocaiModel ? { gcloudDocaiModel: rawOpts.gcloudDocaiModel } : {}),
    ...(rawOpts.gcloudDocaiModels ? { gcloudDocaiModels: rawOpts.gcloudDocaiModels } : {}),
    ...(rawOpts.primaryOcr ? { primaryOcr: rawOpts.primaryOcr } : {}),
    ...(rawOpts.epubChapterFiles ? { epubChapterFiles: true } : {}),
    ...(typeof rawOpts.epubChunkLimitChars === 'number' ? { epubChunkLimitChars: rawOpts.epubChunkLimitChars } : {}),
    pdfChapterMode: rawOpts.pdfChapterMode ?? 'local',
    ...(rawOpts.pdfChapterLlmService ? { pdfChapterLlmService: rawOpts.pdfChapterLlmService } : {}),
    ...(rawOpts.pdfChapterLlmModel ? { pdfChapterLlmModel: rawOpts.pdfChapterLlmModel } : {}),
    ...(rawOpts.useEpubBun ? { useEpubBun: true } : {}),
    ...(rawOpts.useEpubCalibre ? { useEpubCalibre: true } : {}),
    ...(rawOpts.step2SelectionOrigins ? { step2SelectionOrigins: rawOpts.step2SelectionOrigins } : {}),
    ...(preparedDocument?.preparedMarkdown ? { preparedMarkdown: preparedDocument.preparedMarkdown } : {}),
    ...(preparedDocument?.htmlArticleBackend ? { htmlArticleBackend: preparedDocument.htmlArticleBackend } : {})
  }, 'document extraction options')

  const prepared = preparedDocument
    ? preparedDocument
    : await runWithLogContext({ step: 'step-1-download' }, async () =>
      await downloadDocument(filePath, opts.outputDir, opts.password, sourceRef)
    )
  const ocrPreparationCache = createOcrPreparationCache()
  const optsWithPreparationCache: ExtractionOptions = {
    ...opts,
    ocrPreparationCache
  }

  const { outputDir, step1Metadata, effectiveFilePath, tempCleanup, web } = prepared
  const extractFilePath = effectiveFilePath ?? filePath

  const explicitTargets = optsWithPreparationCache.preparedMarkdown ? [] : collectExplicitOcrTargets(optsWithPreparationCache)
  const documentSource = buildDocumentSource(filePath, sourceRef)

  try {
    if (resumeRun || explicitTargets.length > 1) {
      const requestedTargets = resumeRun?.requestedTargets ?? explicitTargets
      const targetsToRun = resumeRun?.targetsToRun ?? requestedTargets
      const primaryTarget = resolvePrimaryOcrTarget(requestedTargets, opts.primaryOcr)
      const resolvedStep2 = resolveRecordedOcrStep2(
        step1Metadata.format,
        optsWithPreparationCache,
        documentSource,
        requestedTargets,
        prepared.preparedMarkdown
      )
      const providersDir = `${outputDir}/providers`
      await mkdir(providersDir, { recursive: true })

      const existingRun = await readExistingOcrRun(outputDir, requestedTargets)
      const successes: Array<OcrProviderSuccess | undefined> = [...existingRun.successes]
      const failuresByIndex = new Map<number, { message: string, retryable?: boolean | undefined }>()
      const failures: Array<{ service: string, model: string, message: string }> = []
      let checkpointWrite = Promise.resolve()
      const queueCheckpointWrite = (): void => {
        const snapshotSuccesses = [...successes]
        const snapshotFailuresByIndex = new Map(failuresByIndex)
        checkpointWrite = checkpointWrite.then(async () => {
          const providerStates = buildProviderStates(
            requestedTargets,
            snapshotSuccesses,
            snapshotFailuresByIndex,
            existingRun.providerStates
          )
          const missingProviders = buildMissingProviders(providerStates, requestedTargets)
          const completionStatus = resolveCompletionStatus(requestedTargets, snapshotSuccesses)
          const metadataErrors = buildMetadataErrorEntries(providerStates).map((value) => ({
            service: value['service'] as string,
            model: value['model'] as string,
            message: value['message'] as string
          }))
          const step2Metadata = snapshotSuccesses
            .filter((entry): entry is OcrProviderSuccess => entry !== undefined)
            .map((entry) => entry.metadata)
          const checkpointMetadata = buildDocumentMetadataPayload(step1Metadata, step2Metadata, {
            failures: metadataErrors,
            web,
            source: documentSource,
            completionStatus,
            resolvedStep2,
            requestedProviders: requestedTargets.map(toRequestedProvider),
            providerStates,
            missingProviders,
            ...(primaryTarget ? { primaryProvider: toRequestedProvider(primaryTarget) } : {}),
            preflightEstimate
          })
          await writeOcrRunManifest(outputDir, checkpointMetadata)
        })
      }

      await runOcrProviderTargetPools(
        requestedTargets,
        targetsToRun,
        {
          provider: opts.ocrProviderConcurrency,
          local: opts.ocrLocalConcurrency
        },
        async (requestedIndex, target) => {
          const providerDirName = getOcrTargetDirectoryName(target)
          const providerDir = `${providersDir}/${providerDirName}`
          const providerStartedAt = Date.now()
          await mkdir(providerDir, { recursive: true })

          logOcrProviderLifecycle(l, {
            provider: target.service,
            model: target.model,
            status: 'started'
          })
          try {
            const providerOpts = buildExtractionOptionsForTarget({
              ...optsWithPreparationCache,
              outputDir: providerDir,
              ocrPreparationCache
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
            queueCheckpointWrite()
            logOcrProviderLifecycle(l, {
              provider: target.service,
              model: target.model,
              status: 'succeeded',
              elapsedMs: Date.now() - providerStartedAt
            })
          } catch (error) {
            await writeInvalidOcrStructuredResponse(providerDir, error)
            const failure = classifyOcrProviderFailure(error)
            failuresByIndex.set(requestedIndex, failure)
            failures.push({
              service: target.service,
              model: target.model,
              message: failure.message
            })
            queueCheckpointWrite()
            logOcrProviderLifecycle(l, {
              provider: target.service,
              model: target.model,
              status: 'failed',
              elapsedMs: Date.now() - providerStartedAt,
              detail: failure.message
            })
          }
        }
      )
      await checkpointWrite

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
      const primary = primaryTarget
        ? successes.find((entry) => entry?.target.service === primaryTarget.service && entry.target.model === primaryTarget.model)
        : undefined
      const firstSuccess = successes.find((entry): entry is OcrProviderSuccess => entry !== undefined)

      const writtenMetadata = buildDocumentMetadataPayload(step1Metadata, step2Metadata, {
        failures: metadataErrors,
        web,
        source: documentSource,
        completionStatus,
        resolvedStep2,
        requestedProviders: requestedTargets.map(toRequestedProvider),
        providerStates,
        missingProviders,
        ...(primaryTarget ? { primaryProvider: toRequestedProvider(primaryTarget) } : {}),
        preflightEstimate
      })
      await writeOcrRunManifest(outputDir, writtenMetadata)
      logExtractManifestConsoleSummary(outputDir, writtenMetadata)

      if (!firstSuccess) {
        throw new OcrBatchCompletionError(
          outputDir,
          completionStatus,
          `No extract outputs were generated. ${failures.map((failure) => `${failure.service}/${failure.model}: ${failure.message}`).join('; ')}`
        )
      }

      if (primary) {
        await writeExtractionArtifact(
          outputDir,
          primary.result,
          opts.outputFormat ?? 'text',
          isEpubInspectMode(primary.metadata),
          'result.json'
        )
      }

      return {
        result: (primary ?? firstSuccess).result,
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
      ? buildExtractionOptionsForTarget(optsWithPreparationCache, explicitTargets[0] as typeof explicitTargets[number])
      : optsWithPreparationCache
    const extracted = await runWithLogContext({ step: 'step-2-ocr' }, async () =>
      await runOcr(extractFilePath, step1Metadata, singleTargetOpts)
    )
    const resolvedStep2 = resolveRecordedOcrStep2(
      step1Metadata.format,
      optsWithPreparationCache,
      documentSource,
      explicitTargets.length === 1 ? explicitTargets : undefined,
      prepared.preparedMarkdown
    )
    const resolvedRequestedProviders = toResolvedRequestedProviders(resolvedStep2)

    const rootMetadata = buildDocumentMetadataPayload(step1Metadata, extracted.step2Metadata, {
      web,
      source: documentSource,
      resolvedStep2,
      completionStatus: 'full',
      ...(resolvedRequestedProviders
        ? {
            requestedProviders: resolvedRequestedProviders,
            providerStates: buildSuccessfulResolvedProviderStates(resolvedRequestedProviders),
            missingProviders: []
          }
        : {}),
      preflightEstimate
    })
    await writeOcrRunManifest(outputDir, rootMetadata)
    logExtractManifestConsoleSummary(outputDir, rootMetadata)
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
      ...(resolvedRequestedProviders
        ? {
            requestedProviders: resolvedRequestedProviders,
            providerStates: buildSuccessfulResolvedProviderStates(resolvedRequestedProviders),
            missingProviders: []
          }
        : {}),
      ...(web ? { web } : {}),
      outputDir
    }
  } finally {
    await cleanupOcrPreparationCache(ocrPreparationCache)
    if (tempCleanup) await tempCleanup()
  }
}
