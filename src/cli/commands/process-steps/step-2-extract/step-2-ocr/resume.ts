import { join, resolve as resolvePath } from 'node:path'
import { fileURLToPath } from 'node:url'
import * as l from '~/utils/logger'
import { logResumeItem, logResumeSummary } from '../../resume/resume-logging'
import {
  DocumentMetadataSchema,
  type BatchManifestEntry,
  type OcrTarget,
  type PreparedDocument,
  type RuntimeOptions,
  type Step1SourceRef,
  type WebArticleMetadata
} from '~/types'
import { CLIUsageError } from '~/utils/error-handler'
import { validateData } from '~/utils/validate/validation'
import { processOcr } from '~/cli/commands/process-steps/step-2-extract/step-2-ocr/process-ocr'
import { downloadDocumentUrlToTempFile } from '../../step-1-download/document/resolve-document-source'
import {
  buildMissingTargetsFromEntry,
  inferStoredCompletionStatus,
  parseStoredRequestedTargets
} from './ocr-run-state'
import { readOcrRunManifestEntry, writeOcrBatchManifest, writeOcrRunManifest } from './manifest'
import { readBatchManifest } from '../../manifest-utils'
import type { ResumeTarget } from '~/types'
import type { ResumeOcrEntry } from '~/types'
import { resolveAdditiveResumeProviderSelection } from '../../resume/resume-provider-selection'

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const resolveStoredOutputDir = async (
  entry: Record<string, unknown>
): Promise<string | undefined> => {
  if (typeof entry['outputDir'] === 'string' && entry['outputDir'].length > 0) {
    return resolvePath(entry['outputDir'])
  }
  return undefined
}

const toStoredSource = (entry: Record<string, unknown>): Step1SourceRef => {
  const source = isRecord(entry['source']) ? entry['source'] : undefined
  const filePath = typeof source?.['filePath'] === 'string'
    ? source['filePath']
    : undefined
  const url = typeof source?.['url'] === 'string'
    ? source['url']
    : typeof entry['url'] === 'string'
      ? entry['url']
      : undefined

  if (filePath) {
    return { filePath }
  }

  if (!url) {
    throw CLIUsageError('Run entry is missing source information and cannot be resumed.')
  }

  if (url.startsWith('file://')) {
    try {
      return { filePath: fileURLToPath(url) }
    } catch {
      return { filePath: decodeURIComponent(url.replace(/^file:\/\/+/, '/')) }
    }
  }

  return { url }
}

const parseResumeEntry = async (
  entry: unknown,
  selectedTargets: OcrTarget[] | undefined
): Promise<ResumeOcrEntry | undefined> => {
  if (!isRecord(entry)) {
    return undefined
  }

  const outputDir = await resolveStoredOutputDir(entry)
  if (!outputDir) {
    return undefined
  }

  const storedRequestedTargets = parseStoredRequestedTargets(entry)
  if (storedRequestedTargets.length === 0 && (!selectedTargets || selectedTargets.length === 0)) {
    return undefined
  }

  const source = toStoredSource(entry)
  const storedMissingTargets = buildMissingTargetsFromEntry(entry, storedRequestedTargets)
  const resolvedTargets = resolveAdditiveResumeProviderSelection({
    storedProviders: storedRequestedTargets,
    runnableStoredProviders: storedMissingTargets,
    ...(selectedTargets ? { selectedProviders: selectedTargets } : {})
  })
  const requestedTargets = resolvedTargets.requestedProviders

  return {
    outputDir,
    source,
    requestedTargets,
    missingTargets: resolvedTargets.providersToRun,
    completionStatus: inferStoredCompletionStatus(entry, requestedTargets),
    rawEntry: entry
  }
}

const readOutputMetadata = async (outputDir: string): Promise<BatchManifestEntry> => {
  const raw = await readOcrRunManifestEntry(outputDir)
  if (!isRecord(raw)) {
    throw CLIUsageError(`Invalid OCR manifest at ${outputDir}/run.json`)
  }
  return raw
}

const readPreparedDocument = async (outputDir: string): Promise<PreparedDocument> => {
  const metadata = await readOutputMetadata(outputDir)
  if (!isRecord(metadata['step1'])) {
    throw CLIUsageError(`Invalid OCR manifest at ${outputDir}/run.json`)
  }

  const step1Metadata = validateData(DocumentMetadataSchema, metadata['step1'], 'stored OCR step1 metadata')
  const web = isRecord(metadata['web']) ? metadata['web'] as WebArticleMetadata : undefined

  return {
    outputDir,
    step1Metadata,
    ...(web ? { web } : {})
  }
}

const withOutputDir = (
  metadata: BatchManifestEntry,
  outputDir: string
): BatchManifestEntry => ({
  ...metadata,
  outputDir
})

const stripOutputDir = (
  metadata: BatchManifestEntry
): Record<string, unknown> => {
  const { outputDir: _outputDir, ...rest } = metadata
  return rest
}

const readResumeTargetManifest = async (
  target: ResumeTarget
): Promise<{ infoPath: string, entries: BatchManifestEntry[], source?: Record<string, unknown> } | undefined> => {
  if (target.scope === 'batch') {
    const manifest = await readBatchManifest(target.dir, 'extract')
    if (!manifest) {
      return undefined
    }

    return {
      infoPath: manifest.manifestPath,
      entries: manifest.manifest.items,
      ...(manifest.manifest.source ? { source: manifest.manifest.source } : {})
    }
  }

  const metadata = await readOutputMetadata(target.dir)
  return {
    infoPath: target.manifestPath,
    entries: [withOutputDir(metadata, target.dir)]
  }
}

export const hasResumableOcrTargetWork = async (
  target: ResumeTarget,
  selectedTargets: OcrTarget[] | undefined
): Promise<boolean> => {
  const manifest = await readResumeTargetManifest(target)
  if (!manifest) {
    return false
  }

  for (const entry of manifest.entries) {
    try {
      const parsed = await parseResumeEntry(entry, selectedTargets)
      if (parsed && parsed.missingTargets.length > 0) {
        return true
      }
    } catch {
      continue
    }
  }

  return false
}

const buildResumeExtractionOpts = (
  opts: RuntimeOptions,
  outputDir: string
) => {
  const step2SelectionOrigins = opts.step2SelectionOrigins
    ? Object.fromEntries(
        Object.entries(opts.step2SelectionOrigins).filter(([, value]) => value !== undefined)
      ) as Record<string, 'default' | 'explicit' | 'all-shortcut'>
    : undefined

  return {
    filePath: '',
    outputDir,
    dpi: opts.dpi,
    languages: opts.lang,
    oem: opts.oem,
    psm: opts.psm,
    outputFormat: opts.out,
    password: opts.password,
    pageSeparator: opts.pageSeparator ?? '\n\n',
    ocrProviderConcurrency: opts.ocrProviderConcurrency,
    ocrLocalConcurrency: opts.ocrLocalConcurrency,
    preserveInterwordSpaces: opts.preserveSpaces,
    rotate: opts.rotate,
    awsRegion: opts.awsRegion,
    awsBucket: opts.awsBucket,
    configPath: opts.configPath,
    ...(opts.useEpubBun ? { useEpubBun: true } : {}),
    ...(opts.useEpubCalibre ? { useEpubCalibre: true } : {}),
    ...(step2SelectionOrigins ? { step2SelectionOrigins } : {})
  }
}

const runResumeOcrTarget = async (
  target: ResumeTarget,
  opts: RuntimeOptions,
  selectedTargets?: OcrTarget[]
): Promise<void> => {
  const manifest = await readResumeTargetManifest(target)
  if (!manifest) {
    throw CLIUsageError(
      target.scope === 'batch'
        ? `Invalid batch manifest at ${join(target.dir, 'batch.json')}`
        : `Invalid OCR manifest at ${join(target.dir, 'run.json')}`
    )
  }

  const parsedEntries = await Promise.all(
    manifest.entries.map(async (entry) => await parseResumeEntry(entry, selectedTargets))
  )

  let full = 0
  let incomplete = 0
  let failed = 0
  let resumableIncomplete = 0
  let resumableFailed = 0
  const updatedEntries: BatchManifestEntry[] = []

  for (let index = 0; index < parsedEntries.length; index++) {
    const entry = parsedEntries[index]
    if (!entry) {
      const rawEntry = manifest.entries[index]
      if (rawEntry) {
        updatedEntries.push(rawEntry)
      }
      continue
    }

    const entryLabel = `${index + 1}/${parsedEntries.length}`
    const providerLabels = entry.missingTargets.map((runTarget) => `${runTarget.service}/${runTarget.model}`)
    const wasComplete = entry.completionStatus === 'full' && entry.missingTargets.length === 0
    if (wasComplete) {
      logResumeItem(l, {
        item: entryLabel,
        status: 'full',
        outputDir: entry.outputDir,
        providers: 'none',
        detail: 'already full'
      }, 'success')
      full += 1
      updatedEntries.push(withOutputDir(entry.rawEntry, entry.outputDir))
      continue
    }

    if (entry.missingTargets.length === 0) {
      logResumeItem(l, {
        item: entryLabel,
        status: entry.completionStatus,
        outputDir: entry.outputDir,
        providers: 'none',
        detail: 'no matching failed or missing providers selected'
      }, 'warn')
      const metadata = await readOutputMetadata(entry.outputDir)
      updatedEntries.push(withOutputDir(metadata, entry.outputDir))
      if (metadata['completionStatus'] === 'failed') {
        failed += 1
      } else if (metadata['completionStatus'] === 'full') {
        full += 1
      } else {
        incomplete += 1
      }
      continue
    }

    logResumeItem(l, {
      item: entryLabel,
      status: 'processing',
      outputDir: entry.outputDir,
      providers: providerLabels,
      detail: 'resuming providers'
    }, 'info')

    const preparedDocument = await readPreparedDocument(entry.outputDir)
    let resumeFilePath = entry.source.filePath
    let cleanup: (() => Promise<void>) | undefined
    if (!resumeFilePath && entry.source.url) {
      const downloaded = await downloadDocumentUrlToTempFile(entry.source.url)
      resumeFilePath = downloaded.filePath
      cleanup = downloaded.cleanup
    }

    if (!resumeFilePath) {
      throw CLIUsageError('OCR resume entry is missing a resumable file path.')
    }

    try {
      await processOcr(
        resumeFilePath,
        buildResumeExtractionOpts(opts, entry.outputDir),
        entry.source,
        preparedDocument,
        undefined,
        {
          outputDir: entry.outputDir,
          requestedTargets: entry.requestedTargets,
          targetsToRun: entry.missingTargets
        }
      )
    } catch (error) {
      if (!(error instanceof Error) || typeof (error as Error & { outputDir?: unknown }).outputDir !== 'string') {
        throw error
      }
    } finally {
      if (cleanup) {
        await cleanup()
      }
    }

    const metadata = await readOutputMetadata(entry.outputDir)
    updatedEntries.push(withOutputDir(metadata, entry.outputDir))
    const remainingResumableEntry = await parseResumeEntry(
      withOutputDir(metadata, entry.outputDir),
      selectedTargets
    )
    const hasRemainingResumableWork = (remainingResumableEntry?.missingTargets.length ?? 0) > 0
    if (metadata['completionStatus'] === 'failed') {
      failed += 1
      if (hasRemainingResumableWork) {
        resumableFailed += 1
      }
      logResumeItem(l, {
        item: entryLabel,
        status: 'failed',
        outputDir: entry.outputDir,
        providers: providerLabels,
        detail: hasRemainingResumableWork ? 'resume failed' : 'no resumable providers remain'
      }, 'error')
    } else if (metadata['completionStatus'] === 'full') {
      full += 1
      logResumeItem(l, {
        item: entryLabel,
        status: 'full',
        outputDir: entry.outputDir,
        providers: providerLabels,
        detail: 'resume complete'
      }, 'success')
    } else {
      incomplete += 1
      if (hasRemainingResumableWork) {
        resumableIncomplete += 1
      }
      logResumeItem(l, {
        item: entryLabel,
        status: 'incomplete',
        outputDir: entry.outputDir,
        providers: providerLabels,
        detail: hasRemainingResumableWork ? 'resume incomplete' : 'no resumable providers remain'
      }, 'warn')
    }
  }

  if (target.scope === 'batch') {
    await writeOcrBatchManifest(target.dir, updatedEntries, manifest.source)
  } else if (updatedEntries[0]) {
    await writeOcrRunManifest(target.dir, stripOutputDir(updatedEntries[0]))
  }
  logResumeSummary(l, { full, incomplete, failed })

  if (resumableIncomplete > 0 || resumableFailed > 0) {
    const error = new Error(`OCR resume still has ${resumableIncomplete} incomplete and ${resumableFailed} failed item(s) with resumable providers`)
    ;(error as Error & { exitCode?: number }).exitCode = 2
    throw error
  }
}

export const resumeOcrTarget = async (
  target: ResumeTarget,
  opts: RuntimeOptions,
  selectedTargets?: OcrTarget[]
): Promise<void> => {
  await runResumeOcrTarget(target, opts, selectedTargets)
}
