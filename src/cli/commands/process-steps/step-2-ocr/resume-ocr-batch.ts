import { readdir } from 'node:fs/promises'
import { join, resolve as resolvePath } from 'node:path'
import { fileURLToPath } from 'node:url'
import * as l from '~/logger'
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
import { processOcr } from '~/cli/commands/process-steps/process-ocr'
import { downloadDocumentUrlToTempFile } from '../step-1-download/document/resolve-document-source'
import {
  buildMissingTargetsFromEntry,
  getOcrTargetKey,
  inferStoredCompletionStatus,
  parseStoredRequestedTargets
} from './ocr-run-state'

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

type ResumeOcrBatchEntry = {
  outputDir: string
  source: Step1SourceRef
  requestedTargets: OcrTarget[]
  missingTargets: OcrTarget[]
  completionStatus: 'full' | 'incomplete' | 'failed'
  rawEntry: BatchManifestEntry
}

const resolveStoredOutputDir = async (
  batchDir: string,
  entry: Record<string, unknown>
): Promise<string | undefined> => {
  if (typeof entry['outputDir'] === 'string' && entry['outputDir'].length > 0) {
    return resolvePath(entry['outputDir'])
  }

  const batchEntries = await readdir(batchDir, { withFileTypes: true })
  const expectedSlug = isRecord(entry['step1']) && typeof entry['step1']['slug'] === 'string'
    ? entry['step1']['slug']
    : undefined

  for (const dirent of batchEntries) {
    if (!dirent.isDirectory()) {
      continue
    }

    const candidateDir = join(batchDir, dirent.name)
    const metadataPath = join(candidateDir, 'metadata.json')
    if (!await Bun.file(metadataPath).exists()) {
      continue
    }

    try {
      const metadata = await Bun.file(metadataPath).json() as unknown
      if (!isRecord(metadata) || !isRecord(metadata['step1'])) {
        continue
      }

      if (expectedSlug && metadata['step1']['slug'] === expectedSlug) {
        return candidateDir
      }
    } catch {
    }
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
    throw CLIUsageError('Batch entry is missing source information and cannot be resumed.')
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
  batchDir: string,
  entry: unknown,
  selectedTargets: OcrTarget[] | undefined
): Promise<ResumeOcrBatchEntry | undefined> => {
  if (!isRecord(entry)) {
    return undefined
  }

  const outputDir = await resolveStoredOutputDir(batchDir, entry)
  if (!outputDir) {
    return undefined
  }

  const requestedTargets = parseStoredRequestedTargets(entry)
  if (requestedTargets.length === 0) {
    return undefined
  }

  const selectedKeys = selectedTargets ? new Set(selectedTargets.map(getOcrTargetKey)) : undefined
  if (selectedKeys) {
    const requestedKeys = new Set(requestedTargets.map(getOcrTargetKey))
    const unexpected = [...selectedKeys].filter((key) => !requestedKeys.has(key))
    if (unexpected.length > 0) {
      throw CLIUsageError(`Requested resume providers are not a subset of the original batch providers: ${unexpected.join(', ')}`)
    }
  }

  const source = toStoredSource(entry)
  const missingTargets = buildMissingTargetsFromEntry(entry, requestedTargets)
    .filter((target) => selectedKeys ? selectedKeys.has(getOcrTargetKey(target)) : true)

  return {
    outputDir,
    source,
    requestedTargets,
    missingTargets,
    completionStatus: inferStoredCompletionStatus(entry, requestedTargets),
    rawEntry: entry
  }
}

const readResumeBatchManifest = async (
  batchDir: string
): Promise<{ infoPath: string, entries: BatchManifestEntry[] } | undefined> => {
  const infoPath = join(batchDir, 'info.json')
  if (!await Bun.file(infoPath).exists()) {
    return undefined
  }

  try {
    const raw = await Bun.file(infoPath).json() as unknown
    if (!Array.isArray(raw)) {
      return undefined
    }

    return {
      infoPath,
      entries: raw.filter((entry): entry is BatchManifestEntry => isRecord(entry))
    }
  } catch {
    return undefined
  }
}

const readOutputMetadata = async (outputDir: string): Promise<BatchManifestEntry> => {
  const raw = await Bun.file(join(outputDir, 'metadata.json')).json() as unknown
  if (!isRecord(raw)) {
    throw CLIUsageError(`Invalid OCR metadata at ${outputDir}/metadata.json`)
  }
  return raw
}

const readPreparedDocument = async (outputDir: string): Promise<PreparedDocument> => {
  const metadata = await readOutputMetadata(outputDir)
  if (!isRecord(metadata['step1'])) {
    throw CLIUsageError(`Invalid OCR metadata at ${outputDir}/metadata.json`)
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

const batchHasResumableWork = async (
  batchDir: string,
  selectedTargets: OcrTarget[] | undefined
): Promise<boolean> => {
  const manifest = await readResumeBatchManifest(batchDir)
  if (!manifest) {
    return false
  }

  for (const entry of manifest.entries) {
    const requestedTargets = parseStoredRequestedTargets(entry)
    if (requestedTargets.length < 2) {
      continue
    }

    const parsed = await parseResumeEntry(batchDir, entry, selectedTargets)
    if (parsed && parsed.missingTargets.length > 0) {
      return true
    }
  }

  return false
}

export const discoverLatestResumableOcrBatchDir = async (
  outputRootInput: string,
  selectedTargets?: OcrTarget[]
): Promise<string | undefined> => {
  const outputRoot = resolvePath(outputRootInput)

  let batchNames: string[]
  try {
    const entries = await readdir(outputRoot, { withFileTypes: true })
    batchNames = entries
      .filter((dirent) => dirent.isDirectory())
      .map((dirent) => dirent.name)
      .sort((left, right) => right.localeCompare(left))
  } catch {
    return undefined
  }

  for (const batchName of batchNames) {
    const batchDir = join(outputRoot, batchName)
    if (await batchHasResumableWork(batchDir, selectedTargets)) {
      return batchDir
    }
  }

  return undefined
}

export const resolveResumeOcrBatchDir = async (
  batchDirInput: string | undefined,
  selectedTargets?: OcrTarget[],
  outputRootInput = './output'
): Promise<string> => {
  if (typeof batchDirInput === 'string' && batchDirInput.trim().length > 0) {
    return batchDirInput
  }

  const discoveredBatchDir = await discoverLatestResumableOcrBatchDir(outputRootInput, selectedTargets)
  if (discoveredBatchDir) {
    return discoveredBatchDir
  }

  if (selectedTargets && selectedTargets.length > 0) {
    throw CLIUsageError(`Could not find a resumable OCR batch under ${outputRootInput} that matches the selected provider flags. Pass --resume-missing <batch-dir> explicitly.`)
  }

  throw CLIUsageError(`Could not find a resumable OCR batch under ${outputRootInput}. Pass --resume-missing <batch-dir> explicitly.`)
}

const buildResumeExtractionOpts = (
  opts: RuntimeOptions,
  outputDir: string
) => ({
  filePath: '',
  outputDir,
  dpi: opts.dpi,
  languages: opts.lang,
  oem: opts.oem,
  psm: opts.psm,
  outputFormat: opts.out,
  password: opts.password,
  pageSeparator: opts.pageSeparator ?? '\n\n',
  preserveInterwordSpaces: opts.preserveSpaces,
  rotate: opts.rotate,
  ...(opts.useEpubBun ? { useEpubBun: true } : {}),
  ...(opts.useEpubCalibre ? { useEpubCalibre: true } : {})
})

const formatResumeSummary = (
  full: number,
  incomplete: number,
  failed: number
): string => `Batch complete: ${full} full, ${incomplete} incomplete, ${failed} failed`

export const resumeOcrMissingFromBatchDir = async (
  batchDirInput: string,
  opts: RuntimeOptions,
  selectedTargets?: OcrTarget[]
): Promise<void> => {
  const batchDir = resolvePath(batchDirInput)
  const manifest = await readResumeBatchManifest(batchDir)
  if (!manifest) {
    throw CLIUsageError(`Invalid batch manifest at ${join(batchDir, 'info.json')}`)
  }

  const parsedEntries = await Promise.all(
    manifest.entries.map(async (entry) => await parseResumeEntry(batchDir, entry, selectedTargets))
  )

  let full = 0
  let incomplete = 0
  let failed = 0
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
    const wasComplete = entry.completionStatus === 'full' && entry.missingTargets.length === 0
    if (wasComplete) {
      l.success(`Resume ${entryLabel}: already full (${entry.outputDir})`)
      full += 1
      updatedEntries.push(withOutputDir(entry.rawEntry, entry.outputDir))
      continue
    }

    if (entry.requestedTargets.length < 2) {
      l.warn(`Resume ${entryLabel}: OCR resume requires multiple original providers; skipping ${entry.outputDir}`)
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

    if (entry.missingTargets.length === 0) {
      l.warn(`Resume ${entryLabel}: no matching missing providers selected; keeping ${entry.completionStatus} state (${entry.outputDir})`)
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

    l.info(`Resume ${entryLabel}: ${entry.outputDir} -> ${entry.missingTargets.map((target) => `${target.service}/${target.model}`).join(', ')}`)

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
    if (metadata['completionStatus'] === 'failed') {
      failed += 1
      l.warn(`Resume ${entryLabel}: failed`)
    } else if (metadata['completionStatus'] === 'full') {
      full += 1
      l.success(`Resume ${entryLabel}: complete`)
    } else {
      incomplete += 1
      l.warn(`Resume ${entryLabel}: incomplete`)
    }
  }

  await Bun.write(manifest.infoPath, JSON.stringify(updatedEntries, null, 2))
  l.info(formatResumeSummary(full, incomplete, failed))

  if (incomplete > 0 || failed > 0) {
    const error = new Error(`OCR batch resume still has ${incomplete} incomplete and ${failed} failed item(s)`)
    ;(error as Error & { exitCode?: number }).exitCode = 2
    throw error
  }
}
