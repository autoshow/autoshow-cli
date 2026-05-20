import { mkdir, stat } from 'node:fs/promises'
import { join } from 'node:path'
import * as l from '~/utils/logger'
import { runWithLogContext } from '~/utils/logger'
import { createKeyValueTable } from '~/utils/logger/human-table'
import { ensureDirectory, writeFile } from '~/utils/cli-utils'
import { validateData } from '~/utils/validate/validation'
import { estimateTokens } from '~/utils/text-utils'
import { reserveBatchChildOutputDir } from '~/cli/commands/process-steps/batch-child-output'
import { createUniqueDirectoryName } from '~/cli/commands/process-steps/step-1-download/audio/metadata-utils'
import { buildArticleSlug } from '~/cli/commands/process-steps/step-1-download/document/prepare-html-article'
import { writeProviderResult, writeRunManifest } from '~/cli/commands/process-steps/manifest-utils'
import { runProviderTargetScheduler } from '~/cli/commands/process-steps/provider-target-scheduler'
import { logExtractManifestConsoleSummary } from '~/cli/commands/process-steps/write-manifest-log'
import {
  HOSTED_URL_ARTICLE_BACKENDS,
  runUrlArticleProvider,
  URL_ARTICLE_BACKENDS
} from './url-provider-registry'
import {
  fallbackTitleFromSource,
  formatErrorMessage,
  isRemoteSource,
  type UrlArticleRunResult
} from './url-utils'
import {
  DocumentMetadataSchema,
  ExtractionMetadataSchema,
  ExtractionResultSchema,
  type AggregatedPriceEstimate,
  type BatchChildRunContext,
  type DocumentMetadata,
  type ExtractionMetadata,
  type ExtractionOptions,
  type ExtractionResult,
  type HtmlArticleBackend,
  type ProcessDocumentOutput,
  type ProviderRunStateBase,
  type RuntimeOptions,
  type WebArticleMetadata
} from '~/types'
import { computeActualCosts } from '~/utils/pricing/compute-actual-costs'
import { computeActualProcessingTimes, computeEstimatedProcessingTimes } from '~/utils/pricing/compute-processing-time'
import { collectEstimatedExtractTargets, resolveExtractEstimatedCosts, resolveExtractObservedEstimateCosts } from '../step-2-ocr/ocr-costs'
import { buildExtractionCallOpts } from '../../step-1-download/targets/single/document-write'
import {
  formatHtmlArticleOcrFlagsIgnoredWarning,
  hasConfiguredOcrProviderSelection
} from '../step-2-shared/inactive-flag-warnings'

type UrlProviderError = {
  message: string
}

type UrlProviderState = ProviderRunStateBase<HtmlArticleBackend, UrlProviderError>

type UrlProviderSuccess = {
  backend: HtmlArticleBackend
  article: UrlArticleRunResult
  result: ExtractionResult
  metadata: ExtractionMetadata
  relativeDir?: string | undefined
}

type UrlProviderFailure = {
  backend: HtmlArticleBackend
  message: string
}

type UrlProviderRunOutcome =
  | { status: 'succeeded', success: UrlProviderSuccess }
  | { status: 'failed', backend: HtmlArticleBackend, message: string }
  | { status: 'skipped', backend: HtmlArticleBackend, message: string }

const isLocalUrlBackend = (backend: HtmlArticleBackend): boolean => backend === 'defuddle'

const getUrlProviderDirectoryName = (backend: HtmlArticleBackend): string => backend

const getUrlProviderArtifactDir = (backend: HtmlArticleBackend): string =>
  `providers/${getUrlProviderDirectoryName(backend)}`

const toRequestedProvider = (
  backend: HtmlArticleBackend
): { service: HtmlArticleBackend, model: HtmlArticleBackend } => ({
  service: backend,
  model: backend
})

const readLocalHtmlFileSize = async (source: string): Promise<number | undefined> => {
  if (isRemoteSource(source)) {
    return undefined
  }
  try {
    return (await stat(source)).size
  } catch {
    return undefined
  }
}

const buildFallbackStep1Metadata = async (
  source: string
): Promise<DocumentMetadata> => {
  const fallbackTitle = fallbackTitleFromSource(source)
  const slug = buildArticleSlug(source, fallbackTitle)
  return validateData(DocumentMetadataSchema, {
    title: fallbackTitle,
    slug,
    pageCount: 1,
    format: 'html',
    fileSize: await readLocalHtmlFileSize(source) ?? 0
  }, 'html article metadata')
}

const buildStep1MetadataFromArticle = (
  source: string,
  article: UrlArticleRunResult | undefined,
  fallback: DocumentMetadata
): DocumentMetadata => {
  if (!article) {
    return fallback
  }

  const title = article.title ?? article.web.title ?? fallback.title ?? fallbackTitleFromSource(source)
  const slug = buildArticleSlug(isRemoteSource(source) ? (article.web.finalUrl ?? source) : source, title)
  return validateData(DocumentMetadataSchema, {
    ...(title ? { title } : {}),
    slug,
    ...(article.author ?? article.web.author ? { author: article.author ?? article.web.author } : {}),
    pageCount: 1,
    format: 'html',
    fileSize: article.fileSize
  }, 'html article metadata')
}

const reserveUrlOutputDir = async (
  source: string,
  baseDir: string,
  opts: RuntimeOptions,
  fallbackStep1: DocumentMetadata,
  article: UrlArticleRunResult | undefined,
  batchChildContext?: BatchChildRunContext
): Promise<string> => {
  const outputBaseDir = baseDir && baseDir.trim().length > 0 ? baseDir : opts.outputRootDir
  const title = article?.title ?? fallbackStep1.title ?? fallbackTitleFromSource(source)
  const slug = article
    ? buildArticleSlug(isRemoteSource(source) ? (article.web.finalUrl ?? source) : source, title)
    : fallbackStep1.slug
  const outputDir = await reserveBatchChildOutputDir(batchChildContext, {
    slug,
    publishedAt: batchChildContext?.batchItem?.publishedAt ?? article?.web.published,
    fallbackLabel: title || slug || 'article'
  }) ?? join(outputBaseDir, createUniqueDirectoryName(title || slug || 'article'))
  await ensureDirectory(outputDir)
  return outputDir
}

const buildUrlExtractionResult = (
  article: UrlArticleRunResult
): ExtractionResult =>
  validateData(ExtractionResultSchema, {
    text: article.markdown.trim(),
    pages: [{
      pageNumber: 1,
      method: 'text',
      text: article.markdown.trim()
    }],
    totalPages: 1,
    ocrPages: 0,
    textPages: 1
  }, 'URL extraction result')

const buildUrlExtractionMetadata = (
  backend: HtmlArticleBackend,
  result: ExtractionResult,
  processingTimeMs: number,
  opts: Pick<ExtractionOptions, 'dpi' | 'languages' | 'outputFormat'>
): ExtractionMetadata =>
  validateData(ExtractionMetadataSchema, {
    extractionMethod: `html+${backend}`,
    totalPages: result.totalPages,
    ocrPages: result.ocrPages,
    textPages: result.textPages,
    processingTime: processingTimeMs,
    dpi: opts.dpi,
    languages: opts.languages,
    tokenEstimate: estimateTokens(result.text),
    inputFamily: 'html',
    outputFidelity: 'markdown',
    outputFormat: opts.outputFormat
  }, 'URL extraction metadata')

const writeExtractionArtifact = async (
  outputDir: string,
  extractionResult: ExtractionResult,
  outputFormat: ExtractionOptions['outputFormat']
): Promise<void> => {
  if (outputFormat === 'json') {
    await writeFile(join(outputDir, 'result.json'), `${JSON.stringify(extractionResult, null, 2)}\n`)
    return
  }

  if (outputFormat === 'tsv') {
    const tsv = extractionResult.pages.map(page => `${page.pageNumber}\t${page.text.replace(/\n/g, ' ')}`).join('\n')
    await writeFile(join(outputDir, 'extraction.tsv'), `${tsv}\n`)
    return
  }

  if (outputFormat === 'hocr') {
    const hocr = extractionResult.pages.map(page => `<div class="page" data-page="${page.pageNumber}">${page.text}</div>`).join('\n')
    await writeFile(join(outputDir, 'extraction.hocr'), `${hocr}\n`)
    return
  }

  await writeFile(join(outputDir, 'extraction.txt'), `${extractionResult.text}\n`)
}

const writeUrlProviderArtifacts = async (
  outputDir: string,
  success: UrlProviderSuccess
): Promise<void> => {
  const providerDir = join(outputDir, getUrlProviderArtifactDir(success.backend))
  await mkdir(providerDir, { recursive: true })
  await writeFile(join(providerDir, 'extraction.txt'), `${success.result.text}\n`)
  await writeProviderResult(
    providerDir,
    success.backend,
    success.backend,
    success.metadata as Record<string, unknown>,
    success.result as Record<string, unknown>
  )
}

const runSingleUrlBackend = async (
  source: string,
  requestedBackend: HtmlArticleBackend,
  sourceUrl: string | undefined,
  extractionOpts: Pick<ExtractionOptions, 'dpi' | 'languages' | 'outputFormat'>
): Promise<UrlProviderSuccess> => {
  let backend = requestedBackend
  const startedAt = Date.now()
  let article: UrlArticleRunResult

  if (requestedBackend === 'defuddle' && sourceUrl) {
    try {
      article = await runUrlArticleProvider('defuddle', source, sourceUrl)
    } catch (defuddleError) {
      l.warn(`Defuddle article extraction failed; falling back to Firecrawl: ${formatErrorMessage(defuddleError)}`)
      try {
        article = await runUrlArticleProvider('firecrawl', source, sourceUrl)
        backend = 'firecrawl'
      } catch (firecrawlError) {
        throw new Error(
          `Defuddle article extraction failed and Firecrawl fallback failed. ` +
          `Defuddle: ${formatErrorMessage(defuddleError)} Firecrawl: ${formatErrorMessage(firecrawlError)}`
        )
      }
    }
  } else {
    article = await runUrlArticleProvider(requestedBackend, source, sourceUrl)
  }

  const result = buildUrlExtractionResult(article)
  const metadata = buildUrlExtractionMetadata(backend, result, Date.now() - startedAt, extractionOpts)
  return {
    backend,
    article,
    result,
    metadata
  }
}

const runUrlBackendDirect = async (
  source: string,
  backend: HtmlArticleBackend,
  sourceUrl: string | undefined,
  extractionOpts: Pick<ExtractionOptions, 'dpi' | 'languages' | 'outputFormat'>
): Promise<UrlProviderSuccess> => {
  const startedAt = Date.now()
  const article = await runUrlArticleProvider(backend, source, sourceUrl)
  const result = buildUrlExtractionResult(article)
  const metadata = buildUrlExtractionMetadata(backend, result, Date.now() - startedAt, extractionOpts)
  return {
    backend,
    article,
    result,
    metadata,
    relativeDir: getUrlProviderArtifactDir(backend)
  }
}

const buildProviderStates = (
  requestedBackends: HtmlArticleBackend[],
  outcomes: UrlProviderRunOutcome[]
): UrlProviderState[] => {
  const byBackend = new Map<HtmlArticleBackend, UrlProviderRunOutcome>(
    outcomes.map((outcome) => [
      outcome.status === 'succeeded' ? outcome.success.backend : outcome.backend,
      outcome
    ])
  )

  return requestedBackends.map((backend) => {
    const outcome = byBackend.get(backend)
    if (!outcome) {
      return {
        service: backend,
        model: backend,
        artifactDir: getUrlProviderArtifactDir(backend),
        status: 'missing',
        attempts: 0
      }
    }

    if (outcome.status === 'succeeded') {
      return {
        service: backend,
        model: backend,
        artifactDir: getUrlProviderArtifactDir(backend),
        status: 'succeeded',
        attempts: 1
      }
    }

    return {
      service: backend,
      model: backend,
      artifactDir: getUrlProviderArtifactDir(backend),
      status: outcome.status,
      attempts: outcome.status === 'skipped' ? 0 : 1,
      lastError: {
        message: outcome.message
      }
    }
  })
}

const resolveCompletionStatus = (
  requestedBackends: HtmlArticleBackend[],
  successes: UrlProviderSuccess[]
): 'full' | 'incomplete' | 'failed' => {
  if (successes.length === 0) {
    return 'failed'
  }
  return successes.length === requestedBackends.length ? 'full' : 'incomplete'
}

const buildManifestMetadata = (
  step1Metadata: DocumentMetadata,
  step2Metadata: ExtractionMetadata | ExtractionMetadata[] | undefined,
  options: {
    source: { url?: string, filePath?: string }
    web?: WebArticleMetadata | undefined
    preflightEstimate?: AggregatedPriceEstimate | undefined
    completionStatus: 'full' | 'incomplete' | 'failed'
    requestedBackends: HtmlArticleBackend[]
    providerStates: UrlProviderState[]
    failures: UrlProviderFailure[]
  }
): Record<string, unknown> => {
  const normalizedStep2 = step2Metadata === undefined
    ? []
    : Array.isArray(step2Metadata)
      ? step2Metadata
      : [step2Metadata]
  const extractTargets = collectEstimatedExtractTargets(normalizedStep2)
  const estimated = resolveExtractEstimatedCosts(options.preflightEstimate, normalizedStep2)
  const observedEstimate = resolveExtractObservedEstimateCosts(normalizedStep2)
  const actual = computeActualCosts({ step2: normalizedStep2 })
  const estimatedTiming = computeEstimatedProcessingTimes({
    extractTargets: extractTargets.map((target) => ({
      provider: target.provider,
      model: target.model,
      pageCount: target.pageCount ?? step1Metadata.pageCount
    }))
  })
  const actualTiming = computeActualProcessingTimes({ step2: normalizedStep2 })
  const timing = estimatedTiming.steps.length > 0 || actualTiming.steps.length > 0
    ? { estimated: estimatedTiming, actual: actualTiming }
    : undefined

  return {
    step1: step1Metadata,
    step2: normalizedStep2.length === 1 ? normalizedStep2[0] : normalizedStep2,
    resolvedStep2: {
      route: 'article',
      sourceKind: 'article',
      backend: options.requestedBackends[0] ?? 'defuddle',
      ...(options.requestedBackends.length > 1 ? { backends: options.requestedBackends } : {})
    },
    completionStatus: options.completionStatus,
    requestedProviders: options.requestedBackends.map(toRequestedProvider),
    providerStates: options.providerStates,
    missingProviders: options.providerStates
      .filter((state) => state.status === 'missing' || state.status === 'failed')
      .map((state) => ({ service: state.service, model: state.model })),
    ...(options.web ? { web: options.web } : {}),
    source: options.source,
    cost: options.preflightEstimate ? { estimated, observedEstimate, actual } : { estimated, actual },
    ...(timing ? { timing } : {}),
    ...(options.failures.length > 0 ? { errors: options.failures.map((failure) => ({
      service: failure.backend,
      model: failure.backend,
      message: failure.message
    })) } : {})
  }
}

const runAllUrlBackends = async (
  source: string,
  requestedBackends: HtmlArticleBackend[],
  sourceUrl: string | undefined,
  opts: RuntimeOptions,
  extractionOpts: Pick<ExtractionOptions, 'dpi' | 'languages' | 'outputFormat'>
): Promise<UrlProviderRunOutcome[]> => {
  const scheduled = await runProviderTargetScheduler<HtmlArticleBackend, UrlProviderRunOutcome>({
    entries: requestedBackends.map((backend, index) => ({
      index,
      target: backend,
      priority: URL_ARTICLE_BACKENDS.length - index
    })),
    concurrency: {
      provider: opts.urlProviderConcurrency,
      local: 1
    },
    getPool: (backend) => isLocalUrlBackend(backend) ? 'local' : 'hosted',
    runTarget: async (_index, backend) => {
      try {
        const success = await runWithLogContext({ step: 'step-2-url', provider: backend }, async () =>
          await runUrlBackendDirect(source, backend, sourceUrl, extractionOpts)
        )
        return { status: 'succeeded', success }
      } catch (error) {
        return {
          status: 'failed',
          backend,
          message: formatErrorMessage(error)
        }
      }
    }
  })

  return scheduled.results.filter((entry): entry is UrlProviderRunOutcome => entry !== undefined)
}

export const processUrlArticle = async (
  source: string,
  baseDir: string,
  opts: RuntimeOptions,
  preflightEstimate?: AggregatedPriceEstimate,
  batchChildContext?: BatchChildRunContext
): Promise<ProcessDocumentOutput> => {
  const remote = isRemoteSource(source)
  const sourceRef = remote ? { url: source } : { filePath: source }
  const sourceUrl = remote ? source : undefined
  const extractionOpts = buildExtractionCallOpts(source, baseDir, opts) as Pick<ExtractionOptions, 'dpi' | 'languages' | 'outputFormat'>
  const fallbackStep1 = await buildFallbackStep1Metadata(source)

  if (hasConfiguredOcrProviderSelection(opts)) {
    l.warn(formatHtmlArticleOcrFlagsIgnoredWarning(source))
  }

  const allUrlMode = Array.isArray(opts.urlBackends) && opts.urlBackends.length > 0
  const requestedBackends = allUrlMode
    ? remote
      ? opts.urlBackends ?? [...URL_ARTICLE_BACKENDS]
      : [...URL_ARTICLE_BACKENDS]
    : [remote ? opts.urlBackend : 'defuddle']

  if (!remote && opts.urlBackend !== 'defuddle' && !allUrlMode) {
    l.warn(`Ignoring --url-backend ${opts.urlBackend} for local HTML inputs; using defuddle instead`)
  }

  if (allUrlMode && !remote) {
    l.warn('--all-url with a local HTML input runs defuddle only; hosted URL backends are skipped for local inputs')
  }

  const outcomes = allUrlMode
    ? [
        ...await runAllUrlBackends(
          source,
          remote ? requestedBackends : ['defuddle'],
          sourceUrl,
          opts,
          extractionOpts
        ),
        ...(!remote
          ? HOSTED_URL_ARTICLE_BACKENDS.map((backend) => ({
              status: 'skipped' as const,
              backend,
              message: 'Local HTML inputs are only supported by defuddle'
            }))
          : [])
      ]
    : [await runWithLogContext({ step: 'step-2-url' }, async () => ({
        status: 'succeeded' as const,
        success: await runSingleUrlBackend(source, requestedBackends[0] ?? 'defuddle', sourceUrl, extractionOpts)
      })).catch((error) => ({
        status: 'failed' as const,
        backend: requestedBackends[0] ?? 'defuddle',
        message: formatErrorMessage(error)
      }))]

  const successes = outcomes
    .filter((outcome): outcome is Extract<UrlProviderRunOutcome, { status: 'succeeded' }> => outcome.status === 'succeeded')
    .map((outcome) => outcome.success)
  const failures = outcomes
    .filter((outcome): outcome is Extract<UrlProviderRunOutcome, { status: 'failed' }> => outcome.status === 'failed')
    .map((outcome) => ({
      backend: outcome.backend,
      message: outcome.message
    }))
  const step1Metadata = buildStep1MetadataFromArticle(source, successes[0]?.article, fallbackStep1)
  const outputDir = await reserveUrlOutputDir(source, baseDir, opts, fallbackStep1, successes[0]?.article, batchChildContext)
  const step2Metadata = allUrlMode
    ? successes.map((success) => success.metadata)
    : successes[0]?.metadata
  const providerStates = buildProviderStates(allUrlMode ? requestedBackends : successes[0] ? [successes[0].backend] : requestedBackends, outcomes)
  const completionStatus = resolveCompletionStatus(providerStates.map((state) => state.service), successes)
  const manifestMetadata = buildManifestMetadata(step1Metadata, step2Metadata, {
    source: sourceRef,
    web: successes[0]?.article.web,
    preflightEstimate,
    completionStatus,
    requestedBackends: providerStates.map((state) => state.service),
    providerStates,
    failures
  })

  if (allUrlMode) {
    await mkdir(join(outputDir, 'providers'), { recursive: true })
    for (const success of successes) {
      await writeUrlProviderArtifacts(outputDir, success)
    }
  } else if (successes[0]) {
    await writeExtractionArtifact(outputDir, successes[0].result, extractionOpts.outputFormat)
  }

  await writeRunManifest(outputDir, 'extract', manifestMetadata)
  logExtractManifestConsoleSummary(outputDir, manifestMetadata)

  if (successes.length === 0) {
    const message = failures.length > 0
      ? failures.map((failure) => `${failure.backend}: ${failure.message}`).join('; ')
      : 'No URL article providers were run.'
    throw new Error(`No URL article outputs were generated. ${message}`)
  }
  const primarySuccess = successes[0] as UrlProviderSuccess

  const artifactFiles: Record<string, string> = { run: 'run.json' }
  if (allUrlMode) {
    for (const success of successes) {
      artifactFiles[`result-${success.backend}`] = `${getUrlProviderArtifactDir(success.backend)}/result.json`
      artifactFiles[`extraction-${success.backend}`] = `${getUrlProviderArtifactDir(success.backend)}/extraction.txt`
    }
  } else {
    artifactFiles[extractionOpts.outputFormat === 'json' ? 'result' : 'extraction'] = extractionOpts.outputFormat === 'json'
      ? 'result.json'
      : extractionOpts.outputFormat === 'tsv'
        ? 'extraction.tsv'
        : extractionOpts.outputFormat === 'hocr'
          ? 'extraction.hocr'
          : 'extraction.txt'
  }

  if (completionStatus !== 'full') {
    const runStatus = {
      completionStatus,
      requested: providerStates.length,
      succeeded: successes.length,
      failed: failures.length,
      missing: providerStates.filter((state) => state.status === 'missing').length
    }
    l.write('warn', 'Run Status', {
      category: 'pipeline',
      humanTable: createKeyValueTable([
        ['completionStatus', runStatus.completionStatus],
        ['requested', runStatus.requested],
        ['succeeded', runStatus.succeeded],
        ['failed', runStatus.failed],
        ['missing', runStatus.missing]
      ]),
      metadata: runStatus
    })
    l.write('warn', 'Locations', {
      category: 'artifact',
      humanTable: createKeyValueTable([['retryOutputDir', outputDir]], 'artifact', 'path')
    })
  } else {
    l.report.complete(outputDir, artifactFiles, allUrlMode
      ? {
          metrics: {
            providersRequested: providerStates.length,
            providersSucceeded: successes.length,
            providersFailed: failures.length,
            partial: false,
            completionStatus
          }
        }
      : undefined)
  }

  return {
    result: primarySuccess.result,
    step1Metadata,
    step2Metadata: step2Metadata ?? [],
    completionStatus,
    requestedProviders: providerStates.map((state) => ({ service: state.service, model: state.model })),
    providerStates: providerStates as unknown as Array<Record<string, unknown>>,
    missingProviders: providerStates
      .filter((state) => state.status === 'missing' || state.status === 'failed')
      .map((state) => ({ service: state.service, model: state.model })),
    ...(primarySuccess.article.web ? { web: primarySuccess.article.web } : {}),
    ...(failures.length > 0 ? { step2Errors: failures.map((failure) => ({
      service: failure.backend,
      model: failure.backend,
      message: failure.message
    })) } : {}),
    outputDir
  }
}
