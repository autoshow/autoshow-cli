import { basename } from 'node:path'
import * as l from '~/utils/logger'
import { createHumanTable, logLocationsTable } from '~/utils/logger/human-table'
import { ensureDirectory } from '~/utils/cli-utils'
import { reserveBatchChildOutputDir } from '~/cli/commands/process-steps/batch-child-output'
import { createUniqueDirectoryName } from '~/cli/commands/process-steps/step-1-download/audio/metadata-utils'
import { downloadDocument, prepareDocumentMetadata } from '~/cli/commands/process-steps/step-1-download/document/dl-document'
import { prepareHtmlArticle } from '~/cli/commands/process-steps/step-1-download/document/prepare-html-article'
import { processOcr } from '~/cli/commands/process-steps/step-2-extract/step-2-ocr/process-ocr'
import { writeRunManifest } from '~/cli/commands/process-steps/manifest-utils'
import type { AggregatedPriceEstimate, BatchChildRunContext, BatchItemProcessResult, PreparedDocument, RuntimeOptions, Step1SourceRef } from '~/types'
import { formatHtmlArticleOcrFlagsIgnoredWarning, hasConfiguredOcrProviderSelection } from '~/cli/commands/process-steps/step-2-extract/step-2-shared/inactive-flag-warnings'
import { buildDocumentMetadataView, writeMetadataTerminalOutput, writeSavedMetadataArtifacts } from './metadata-output'
import { appendChapterExportArtifacts, buildExtractionCallOpts } from './document-write'

const warnHtmlArticleFlagBehavior = (target: string, opts: RuntimeOptions, backend: PreparedDocument['htmlArticleBackend']): void => {
  if (hasConfiguredOcrProviderSelection(opts)) {
    l.warn(formatHtmlArticleOcrFlagsIgnoredWarning(target))
  }
  if (backend === 'firecrawl') {
    l.write('info', 'Article extraction backend: firecrawl')
  } else if (backend === 'glm-reader') {
    l.write('info', 'Article extraction backend: glm-reader')
  }
}

export const prepareArticleDocument = async (
  source: string,
  baseDir: string,
  opts: RuntimeOptions,
  batchChildContext?: BatchChildRunContext
): Promise<PreparedDocument> => {
  const effectiveBaseDir = baseDir && baseDir.trim().length > 0 ? baseDir : opts.outputRootDir
  const prepared = await prepareHtmlArticle(source, effectiveBaseDir, opts.urlBackend, batchChildContext)
  warnHtmlArticleFlagBehavior(source, opts, prepared.htmlArticleBackend)
  return prepared
}

export const processOcrSingle = async (
  target: string,
  baseDir: string,
  opts: RuntimeOptions,
  sourceRef?: Step1SourceRef,
  preparedDocument?: PreparedDocument,
  preflightEstimate?: AggregatedPriceEstimate,
  batchChildContext?: BatchChildRunContext
): Promise<{ outputDir: string }> => {
  const resolvedPreparedDocument = preparedDocument ?? (batchChildContext
    ? await downloadDocument(target, baseDir || opts.outputRootDir, opts.password, sourceRef, batchChildContext)
    : undefined)
  const extraction = await processOcr(
    target,
    buildExtractionCallOpts(target, baseDir, opts),
    sourceRef,
    resolvedPreparedDocument,
    preflightEstimate
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

  if (requestedMultipleProviders && !opts.primaryOcr) {
    delete artifactFiles['result']
    delete artifactFiles['extraction']
  }

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

export const processMetadataDocument = async (
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

    const effectiveBaseDir = baseDir?.trim().length > 0 ? baseDir : opts.outputRootDir
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

export const processMetadataPreparedDocument = async (
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

export const processDownloadDocument = async (
  target: string,
  baseDir: string,
  opts: RuntimeOptions,
  sourceRef?: Step1SourceRef,
  batchChildContext?: BatchChildRunContext
): Promise<{ outputDir: string }> => {
  const effectiveBaseDir = baseDir && baseDir.trim().length > 0 ? baseDir : opts.outputRootDir
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

export const processDownloadPreparedDocument = async (
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
