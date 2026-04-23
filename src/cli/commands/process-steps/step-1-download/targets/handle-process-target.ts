import { join, relative } from 'node:path'
import * as l from '~/logger'
import { logLocationsTable, logSingleRowTable } from '~/logger/human-table'
import { CLIUsageError } from '~/utils/error-handler'
import { logSuitePriceSummary } from '~/cli/commands/process-steps/suite-price-logging'
import type {
  AggregatedPriceEstimate,
  BatchItem,
  BatchManifestEntry,
  BatchProcessResult,
  BatchSource,
  ExtractBatchManifest,
  PlannedBatchInput,
  ProcessCommand,
  ResolvedBatch,
  ResolvedProcessTargetPlan,
  RoutedChildKind,
  RuntimeOptions
} from '~/types'
import { canonicalizeProcessCommand, isExtractCommand, isOcrCommand, isSttCommand } from '~/cli/commands/process-steps/process-command-kinds'
import {
  buildOptsFromFlags,
  classifyTopLevelTarget,
  collectInputFiles,
  isInputDirectoryPath,
  isDocumentLikeTarget,
  isHtmlArticleTarget,
  planBatchInputsForCommand,
  processBatch,
  resolveInputRoutingForCommand,
  readInputList
} from './target-utils'
import { resolveInputListBatch } from './url-list-target'
import { resolveListBatchItems } from './list-batch-resolver'
import { resolveYoutubeCollectionItems } from './youtube-collection-target'
import { handleSingleTarget, processSingleTarget } from './single-target'
import { tryResolveBatchSource } from './batch/batch-router'
import { buildAggregatedPriceEstimate } from '~/utils/pricing/aggregate-pricing'
import { runPreflight } from '~/utils/pricing/preflight'
import { resolveConfigPath, loadConfig, resolveMaxCents } from '~/cli/commands/setup-and-utilities/config/config-loader'
import { extractExplicitFlags, mergeConfigIntoRawFlags } from '~/cli/commands/setup-and-utilities/config/config-merge'
import { resolveLLMDefaults } from './llm-defaults'
import { collectTtsTargets, getTtsArtifactFileName } from '~/cli/commands/process-steps/step-4-tts/tts-targets'
import { collectImageTargets } from '~/cli/commands/process-steps/step-5-image/image-targets'
import { collectVideoTargets } from '~/cli/commands/process-steps/step-6-video/video-targets'
import { collectMusicTargets } from '~/cli/commands/process-steps/step-7-music/music-targets'
import { collectSttTargets } from '~/cli/commands/process-steps/step-2-stt/stt-targets'
import { runSttBatch, throwIfSttBatchIncomplete } from '~/cli/commands/process-steps/step-2-stt/batch'
import { collectExplicitOcrTargets } from '~/cli/commands/process-steps/step-2-ocr/ocr-targets'
import { collectTextInputFiles, isTextInputPath } from '~/cli/commands/process-steps/step-3-write/text-input-utils'
import { hasConfiguredOcrProviderSelection, HTML_ARTICLE_OCR_FLAGS_IGNORED_WARNING } from '~/cli/commands/process-steps/step-2-shared/inactive-flag-warnings'
import { ensureDirectory } from '~/utils/cli-utils'
import { createUniqueDirectoryName } from '~/cli/commands/process-steps/step-1-download/audio/metadata-utils'
import { readBatchManifest, writeExtractBatchManifest } from '~/cli/commands/process-steps/manifest-utils'

const runWithConcurrency = async <T,>(
  items: T[],
  concurrency: number,
  worker: (item: T, index: number) => Promise<void>
): Promise<void> => {
  const normalizedConcurrency = Math.max(1, concurrency)
  let nextIndex = 0

  const runWorker = async (): Promise<void> => {
    while (true) {
      const currentIndex = nextIndex
      nextIndex += 1
      if (currentIndex >= items.length) {
        return
      }
      await worker(items[currentIndex] as T, currentIndex)
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(normalizedConcurrency, items.length) }, async () => {
      await runWorker()
    })
  )
}

const getEffectiveLlmOutputCount = (opts: RuntimeOptions): number => {
  const llmConfig = resolveLLMDefaults(opts)
  return [
    ...(llmConfig.openaiModels ?? (llmConfig.openaiModel ? [llmConfig.openaiModel] : [])),
    ...(llmConfig.groqModels ?? (llmConfig.groqModel ? [llmConfig.groqModel] : [])),
    ...(llmConfig.geminiModels ?? (llmConfig.geminiModel ? [llmConfig.geminiModel] : [])),
    ...(llmConfig.anthropicModels ?? (llmConfig.anthropicModel ? [llmConfig.anthropicModel] : [])),
    ...(llmConfig.minimaxModels ?? (llmConfig.minimaxModel ? [llmConfig.minimaxModel] : [])),
    ...(llmConfig.grokModels ?? (llmConfig.grokModel ? [llmConfig.grokModel] : [])),
    ...(llmConfig.llamaModels ?? (llmConfig.llamaModel ? [llmConfig.llamaModel] : []))
  ].filter((value): value is string => typeof value === 'string' && value.length > 0).length
}

const getExpectedOcrArtifact = (opts: RuntimeOptions): string => {
  if (opts.out === 'tsv') {
    return 'extraction.tsv'
  }
  if (opts.out === 'hocr') {
    return 'extraction.hocr'
  }
  if (opts.out === 'json') {
    return 'result.json'
  }
  return 'extraction.txt'
}

const getExpectedOcrExportArtifacts = (opts: RuntimeOptions): string[] => {
  const artifacts: string[] = []
  if (opts.epubChapterFiles) {
    artifacts.push('chapters/*.txt (EPUB native text runs, or PDF chapter autodetection)')
  }
  if (typeof opts.epubChunkLimitChars === 'number' && !opts.epubChapterFiles) {
    artifacts.push('chunks/*.txt (EPUB native text runs only)')
  }
  return artifacts
}

const buildUnsupportedExtractInputMessage = (
  input: string
): string => `Could not classify extract input "${input}". Verify the file type or route it explicitly as media or document content.`

export const buildExpectedFilesList = async (command: ProcessCommand, opts: RuntimeOptions, resolvedTarget?: string): Promise<string[]> => {
  const routing = typeof resolvedTarget === 'string'
    ? await resolveInputRoutingForCommand(command === 'download' || command === 'metadata' ? 'write' : command, resolvedTarget, opts)
    : undefined
  const routedChildKind = routing?.routedChildKind

  if (command === 'metadata') {
    if (!opts.save) {
      return [opts.markdown ? 'metadata (logged to terminal as Markdown frontmatter YAML)' : 'metadata (logged to terminal)']
    }
    return opts.markdown ? ['run.json', 'metadata.md'] : ['run.json']
  }
  if (command === 'download') {
    const documentDownload = typeof resolvedTarget === 'string' && await isDocumentLikeTarget(resolvedTarget, opts)
    return documentDownload ? ['run.json'] : ['Audio file', 'run.json']
  }
  if (isOcrCommand(command) || (isExtractCommand(command) && routedChildKind === 'ocr')) {
    const ocrArtifact = getExpectedOcrArtifact(opts)
    const ocrExportArtifacts = getExpectedOcrExportArtifacts(opts)
    const htmlArticleInput = routing?.family === 'html_article'
    if (opts.useEpubBun || opts.useEpubCalibre) {
      return ['run.json (includes EPUB inspection payload)', 'Extracted text (non-EPUB fallback inputs only)', ...ocrExportArtifacts]
    }
    if (!htmlArticleInput && collectExplicitOcrTargets(opts).length > 1) {
      return [ocrArtifact, ...ocrExportArtifacts, 'providers/<service>-<model>/result.json', 'run.json']
    }
    return [ocrArtifact, ...ocrExportArtifacts, 'run.json']
  }
  if (isSttCommand(command) || (isExtractCommand(command) && routedChildKind === 'stt')) {
    const files = collectSttTargets(opts).length > 1
      ? ['Shared audio artifact(s)', 'providers/<service>-<model>/transcription.txt', 'providers/<service>-<model>/result.json', 'prompt.md', 'run.json']
      : ['Audio file', 'transcription.txt', 'result.json', 'prompt.md', 'run.json']
    if (opts.youtubeCaptions) {
      files.splice(files.length - 2, 0, 'youtube-captions.vtt (when available)', 'youtube-captions.json (when available)')
    }
    return files
  }
  if (command === 'write' && opts.textInput) {
    const llmOutputCount = getEffectiveLlmOutputCount(opts)
    const canRunPostGeneration = llmOutputCount === 1
    const files = [llmOutputCount <= 1 ? 'text.json' : 'text-<provider>.json']
    if (opts.renderedText) {
      files.push(llmOutputCount <= 1 ? 'text.md' : 'text-<provider>.md')
    }
    if (typeof opts.renderedOutDir === 'string' && opts.renderedOutDir.length > 0) {
      files.push(`${opts.renderedOutDir}/*.md`)
    }
    const ttsTargets = collectTtsTargets(opts)
    const imageTargets = collectImageTargets(opts)
    const videoTargets = collectVideoTargets(opts)
    const musicTargets = collectMusicTargets(opts)
    if (ttsTargets.length > 0 && canRunPostGeneration) {
      for (const target of ttsTargets) {
        files.push(getTtsArtifactFileName(target, ttsTargets.length === 1))
      }
    }
    if (canRunPostGeneration && imageTargets.length > 0) {
      files.push('generated-image.png')
    }
    if (canRunPostGeneration && videoTargets.length > 0) {
      files.push('Video file')
    }
    if (canRunPostGeneration && musicTargets.length > 0) {
      files.push('Music file')
    }
    files.push('prompt.md')
    files.push('run.json')
    return files
  }
  const summaryFile = 'text.json'
  const documentWrite = command === 'write'
    && (routing?.family === 'document' || routing?.family === 'html_article')
  if (documentWrite) {
    const files = opts.useEpubBun || opts.useEpubCalibre
      ? [summaryFile, 'run.json (includes EPUB inspection payload)']
      : [getExpectedOcrArtifact(opts), summaryFile]
    files.push(...getExpectedOcrExportArtifacts(opts))
    const htmlArticleInput = routing?.family === 'html_article'
    if (!htmlArticleInput && collectExplicitOcrTargets(opts).length > 1) {
      files.push('providers/<service>-<model>/result.json')
    }
    files.push('prompt.md')
    if (!files.some((entry) => entry.startsWith('run.json'))) {
      files.push('run.json')
    }
    return files
  }
  const files = ['Audio file', 'transcription.txt', 'result.json', summaryFile]
  if (collectSttTargets(opts).length > 1) {
    files.push('providers/<service>-<model>/transcription.txt')
    files.push('providers/<service>-<model>/result.json')
  }
  const ttsTargets = collectTtsTargets(opts)
  const imageTargets = collectImageTargets(opts)
  const videoTargets = collectVideoTargets(opts)
  const musicTargets = collectMusicTargets(opts)
  const canRunPostGeneration = getEffectiveLlmOutputCount(opts) === 1
  if (ttsTargets.length > 0 && canRunPostGeneration) {
    for (const target of ttsTargets) {
      files.push(getTtsArtifactFileName(target, ttsTargets.length === 1))
    }
  }
  if (canRunPostGeneration && imageTargets.length > 0) {
    files.push('generated-image.png')
  }
  if (canRunPostGeneration && videoTargets.length > 0) {
    files.push('Video file')
  }
  if (canRunPostGeneration && musicTargets.length > 0) {
    files.push('Music file')
  }
  if (opts.youtubeCaptions) {
    files.push('youtube-captions.vtt (when available)')
    files.push('youtube-captions.json (when available)')
  }
  files.push('prompt.md')
  files.push('run.json')
  return files
}

const TRANSCRIBE_UNSUPPORTED_LLM_FLAGS = ['openai', 'groq', 'gemini', 'anthropic', 'minimax', 'grok', 'llama', 'mistral'] as const
const hasTranscribeUnsupportedLLMFlags = (flags: Record<string, unknown>, doubleDashArgs: string[] = []): boolean => {
  const inParsedFlags = TRANSCRIBE_UNSUPPORTED_LLM_FLAGS.some((key) => flags[key] !== undefined)
  if (inParsedFlags) {
    return true
  }

  for (const token of doubleDashArgs) {
    if (!token.startsWith('--')) {
      continue
    }
    const key = token.slice(2)
    if (TRANSCRIBE_UNSUPPORTED_LLM_FLAGS.includes(key as typeof TRANSCRIBE_UNSUPPORTED_LLM_FLAGS[number])) {
      return true
    }
  }

  return false
}

const validateWriteStep2ProviderSelection = (command: ProcessCommand, opts: RuntimeOptions): void => {
  if (command !== 'write') {
    return
  }

  const sttTargets = collectSttTargets(opts)
  if (sttTargets.length > 1) {
    throw CLIUsageError('write accepts at most one STT provider (--whisper-stt, --reverb-stt, --*-stt).')
  }

  const ocrTargets = collectExplicitOcrTargets(opts)
  if (ocrTargets.length > 1) {
    throw CLIUsageError('write accepts at most one OCR provider (--ocrmypdf, --paddle-ocr, --mistral-ocr, --glm-ocr, --openai-ocr, --anthropic-ocr, --gemini-ocr).')
  }
}

const resolveProcessTargetPlan = async (
  command: ProcessCommand,
  resolvedTarget: string,
  opts: RuntimeOptions
): Promise<ResolvedProcessTargetPlan> => {
  if (command === 'write' && opts.textInput) {
    if (/^https?:\/\//i.test(resolvedTarget)) {
      throw CLIUsageError('write --text-input only accepts local .md or .txt files or directories')
    }

    const topLevel = await classifyTopLevelTarget(resolvedTarget)
    if (!topLevel.exists) {
      throw CLIUsageError(`Input does not exist: ${resolvedTarget}. Run: bun as help write`)
    }

    if (topLevel.kind === 'directory') {
      return {
        kind: 'directory',
        targets: await collectTextInputFiles(resolvedTarget)
      }
    }

    if (!isTextInputPath(resolvedTarget)) {
      throw CLIUsageError(`write --text-input only accepts .md or .txt files. Got: ${resolvedTarget}`)
    }

    return { kind: 'single', target: resolvedTarget }
  }

  const topLevel = await classifyTopLevelTarget(resolvedTarget)

  if (topLevel.kind === 'directory') {
    const allFiles = await collectInputFiles(resolvedTarget)

    const includeUrlsFromInputDir = isInputDirectoryPath(resolvedTarget)
    const listedInputEntries = includeUrlsFromInputDir
      ? await readInputList(`${resolvedTarget}/2-urls.md`)
      : []
    const listedInputs = listedInputEntries.length > 0
      ? (await resolveListBatchItems(listedInputEntries, `${resolvedTarget}/2-urls.md`, command, opts)).selectedUrls
      : []

    const all = includeUrlsFromInputDir ? [...allFiles, ...listedInputs] : allFiles
    if (all.length === 0) {
      l.warn(`No inputs found in ${resolvedTarget}`)
    }
    return { kind: 'directory', targets: all }
  }

  if (topLevel.kind === 'input_list') {
    return {
      kind: 'input_list',
      resolvedBatch: await resolveInputListBatch(resolvedTarget, command, opts)
    }
  }

  const resolved = await tryResolveBatchSource(resolvedTarget, command, opts)
  if (resolved) {
    return { kind: 'resolved_batch', resolvedBatch: resolved }
  }

  const youtubeCollectionItems = await resolveYoutubeCollectionItems(resolvedTarget, command)
  if (youtubeCollectionItems) {
    return { kind: 'youtube_collection', targets: youtubeCollectionItems }
  }

  return { kind: 'single', target: resolvedTarget }
}

type BatchExecutionPlan = {
  label: string
  items: string[]
  selectedItems?: Array<BatchItem | undefined>
  initialEntries: Record<string, unknown>[]
  resultEntryIndexes: number[]
  plannedInputs: PlannedBatchInput[]
  source?: BatchSource
  totalCount?: number
}

const planResolvedBatchExecution = async (
  resolvedBatch: ResolvedBatch,
  command: ProcessCommand,
  opts: RuntimeOptions,
  label: string
): Promise<BatchExecutionPlan> => {
  const batchPlan = await planBatchInputsForCommand(
    command,
    resolvedBatch.selectedUrls,
    opts,
    resolvedBatch.selectedItems
  )

  return {
    label,
    items: batchPlan.items,
    ...(batchPlan.selectedItems ? { selectedItems: batchPlan.selectedItems } : {}),
    initialEntries: batchPlan.initialEntries,
    resultEntryIndexes: batchPlan.resultEntryIndexes,
    plannedInputs: batchPlan.plannedInputs,
    source: resolvedBatch.source,
    totalCount: resolvedBatch.totalCount
  }
}

const planDirectoryBatchExecution = async (
  resolvedTarget: string,
  command: ProcessCommand,
  opts: RuntimeOptions
): Promise<BatchExecutionPlan | undefined> => {
  const allFiles = command === 'write' && opts.textInput
    ? await collectTextInputFiles(resolvedTarget)
    : await collectInputFiles(resolvedTarget)
  const includeUrlsFromInputDir = !opts.textInput && isInputDirectoryPath(resolvedTarget)
  const listedInputEntries = includeUrlsFromInputDir ? await readInputList(`${resolvedTarget}/2-urls.md`) : []
  const resolvedListedInputs = listedInputEntries.length > 0
    ? await resolveListBatchItems(listedInputEntries, `${resolvedTarget}/2-urls.md`, command, opts)
    : undefined
  const listedInputs = resolvedListedInputs?.selectedUrls ?? []
  const all = includeUrlsFromInputDir ? [...allFiles, ...listedInputs] : allFiles

  if (all.length === 0) {
    return undefined
  }

  const selectedItems: Array<BatchItem | undefined> | undefined = includeUrlsFromInputDir
    ? [
        ...allFiles.map(() => undefined),
        ...(resolvedListedInputs?.selectedItems ?? [])
      ]
    : undefined
  const batchPlan = await planBatchInputsForCommand(command, all, opts, selectedItems)

  return {
    label: command === 'write' && opts.textInput
      ? 'text'
      : includeUrlsFromInputDir
        ? 'input'
        : 'files',
    items: batchPlan.items,
    ...(batchPlan.selectedItems ? { selectedItems: batchPlan.selectedItems } : {}),
    initialEntries: batchPlan.initialEntries,
    resultEntryIndexes: batchPlan.resultEntryIndexes,
    plannedInputs: batchPlan.plannedInputs
  }
}

const planProcessTargetBatchExecution = async (
  plan: ResolvedProcessTargetPlan,
  command: ProcessCommand,
  opts: RuntimeOptions,
  resolvedTarget: string
): Promise<BatchExecutionPlan | undefined> => {
  if (plan.kind === 'directory') {
    return await planDirectoryBatchExecution(resolvedTarget, command, opts)
  }

  if (plan.kind === 'input_list') {
    return await planResolvedBatchExecution(plan.resolvedBatch, command, opts, 'inputs')
  }

  if (plan.kind === 'resolved_batch') {
    return await planResolvedBatchExecution(
      plan.resolvedBatch,
      command,
      opts,
      plan.resolvedBatch.source.title ?? plan.resolvedBatch.source.sourceKind
    )
  }

  if (plan.kind === 'youtube_collection') {
    const batchPlan = await planBatchInputsForCommand(command, plan.targets, opts)
    return {
      label: 'youtube_collection',
      items: batchPlan.items,
      ...(batchPlan.selectedItems ? { selectedItems: batchPlan.selectedItems } : {}),
      initialEntries: batchPlan.initialEntries,
      resultEntryIndexes: batchPlan.resultEntryIndexes,
      plannedInputs: batchPlan.plannedInputs
    }
  }

  return undefined
}

type ExtractChildBatchPlan = {
  kind: RoutedChildKind
  items: string[]
  selectedItems?: Array<BatchItem | undefined>
  initialEntries: Record<string, unknown>[]
  resultEntryIndexes: number[]
  parentIndexes: number[]
}

const createExtractChildBatchPlan = (
  kind: RoutedChildKind
): ExtractChildBatchPlan => ({
  kind,
  items: [],
  initialEntries: [],
  resultEntryIndexes: [],
  parentIndexes: []
})

const isBatchEntryCompletionStatus = (
  value: unknown
): value is ExtractBatchManifest['items'][number]['completionStatus'] =>
  value === 'full' || value === 'incomplete' || value === 'failed' || value === 'skipped'

const toRelativeOutputDir = (
  batchDir: string,
  outputDir: unknown
): string | undefined => {
  if (typeof outputDir !== 'string' || outputDir.length === 0) {
    return undefined
  }

  const relativePath = relative(batchDir, outputDir)
  return relativePath.length > 0 ? relativePath : '.'
}

const partitionExtractBatchPlan = (
  batchPlan: BatchExecutionPlan
): {
  childPlans: Record<RoutedChildKind, ExtractChildBatchPlan>
  manifestItems: ExtractBatchManifest['items']
} => {
  const childPlans: Record<RoutedChildKind, ExtractChildBatchPlan> = {
    stt: createExtractChildBatchPlan('stt'),
    ocr: createExtractChildBatchPlan('ocr')
  }
  const manifestItems: ExtractBatchManifest['items'] = []
  let runnableIndex = 0

  for (const [index, plannedInput] of batchPlan.plannedInputs.entries()) {
    const initialEntry = batchPlan.initialEntries[index] as BatchManifestEntry | undefined
    const routedChildKind = plannedInput.routedChildKind

    if (!routedChildKind || batchPlan.items[runnableIndex] === undefined) {
      manifestItems.push({
        input: plannedInput.input,
        inputFamily: plannedInput.inputFamily,
        completionStatus: 'skipped',
        ...(typeof initialEntry?.['skipReason'] === 'string' ? { skipReason: initialEntry['skipReason'] } : {})
      })
      continue
    }

    const childPlan = childPlans[routedChildKind]
    const selectedItem = batchPlan.selectedItems?.[runnableIndex]
    childPlan.items.push(batchPlan.items[runnableIndex] as string)
    childPlan.initialEntries.push((initialEntry ?? {}) as Record<string, unknown>)
    childPlan.resultEntryIndexes.push(childPlan.initialEntries.length - 1)
    childPlan.parentIndexes.push(index)
    if (batchPlan.selectedItems) {
      childPlan.selectedItems ??= []
      childPlan.selectedItems.push(selectedItem)
    }

    manifestItems.push({
      input: plannedInput.input,
      inputFamily: plannedInput.inputFamily,
      routedChildKind,
      completionStatus: 'incomplete'
    })
    runnableIndex += 1
  }

  return { childPlans, manifestItems }
}

const runExtractOcrChildBatch = async (
  batchDir: string,
  opts: RuntimeOptions,
  batchPlan: ExtractChildBatchPlan,
  source?: BatchSource
): Promise<BatchProcessResult> =>
  await processBatch(
    batchPlan.items,
    batchPlan.kind,
    'ocr',
    opts,
    async (commandName, item, childBatchDir, batchOpts, batchItem) =>
      await processSingleTarget(commandName, item, childBatchDir, batchOpts, undefined, {
        batchChildContext: {
          batchDir: childBatchDir,
          ...(batchItem ? { batchItem } : {})
        }
      }, batchItem),
    {
      ...(source ? { source } : {}),
      ...(batchPlan.selectedItems ? { selectedItems: batchPlan.selectedItems } : {}),
      initialEntries: batchPlan.initialEntries,
      resultEntryIndexes: batchPlan.resultEntryIndexes,
      concurrency: opts.batchConcurrency,
      parentBatchDir: batchDir
    }
  )

const executeExtractBatchPlan = async (
  opts: RuntimeOptions,
  batchPlan: BatchExecutionPlan
): Promise<void> => {
  const batchDirName = createUniqueDirectoryName(batchPlan.label)
  const batchDir = `./output/${batchDirName}`
  await ensureDirectory(batchDir)
  logLocationsTable(l, [{ artifact: 'outputDir', path: batchDir }])

  const { childPlans, manifestItems } = partitionExtractBatchPlan(batchPlan)
  const childBatches = {
    ...(childPlans.stt.items.length > 0 ? { stt: 'stt' } : {}),
    ...(childPlans.ocr.items.length > 0 ? { ocr: 'ocr' } : {})
  }

  const initialManifest: ExtractBatchManifest = {
    schemaVersion: 1,
    createdAt: new Date().toISOString(),
    items: manifestItems,
    childBatches
  }

  await writeExtractBatchManifest(batchDir, initialManifest)
  logLocationsTable(l, [{ artifact: 'extractBatchManifest', path: `${batchDir}/extract-batch.json` }])

  if (childPlans.stt.items.length === 0 && childPlans.ocr.items.length === 0) {
    l.warn('No supported inputs to process')
    return
  }

  const [sttResult, ocrResult] = await Promise.all([
    childPlans.stt.items.length > 0
      ? runSttBatch(childPlans.stt.items, childPlans.stt.kind, opts, {
          ...(batchPlan.source ? { source: batchPlan.source } : {}),
          ...(childPlans.stt.selectedItems ? { selectedItems: childPlans.stt.selectedItems } : {}),
          initialEntries: childPlans.stt.initialEntries,
          resultEntryIndexes: childPlans.stt.resultEntryIndexes,
          concurrency: opts.batchConcurrency,
          parentBatchDir: batchDir
        })
      : Promise.resolve(undefined),
    childPlans.ocr.items.length > 0
      ? runExtractOcrChildBatch(batchDir, opts, childPlans.ocr, batchPlan.source)
      : Promise.resolve(undefined)
  ])

  const finalItems = initialManifest.items.map((item) => ({ ...item }))
  for (const childKind of ['stt', 'ocr'] as const) {
    const childPlan = childPlans[childKind]
    if (childPlan.items.length === 0) {
      continue
    }

    const childManifest = await readBatchManifest(join(batchDir, childKind), childKind)
    const childEntries = childManifest?.manifest.items ?? []

    childPlan.parentIndexes.forEach((parentIndex, childIndex) => {
      const existingItem = finalItems[parentIndex]
      if (!existingItem) {
        return
      }

      const childEntry = childEntries[childIndex] as BatchManifestEntry | undefined
      const outputDir = toRelativeOutputDir(batchDir, childEntry?.['outputDir'])
      finalItems[parentIndex] = {
        ...existingItem,
        routedChildKind: childKind,
        childBatchEntry: { kind: childKind, index: childIndex },
        completionStatus: isBatchEntryCompletionStatus(childEntry?.['completionStatus'])
          ? childEntry['completionStatus']
          : 'failed',
        ...(typeof childEntry?.['skipReason'] === 'string' ? { skipReason: childEntry['skipReason'] } : {}),
        ...(outputDir ? { outputDir } : {})
      }
    })
  }

  await writeExtractBatchManifest(batchDir, {
    ...initialManifest,
    items: finalItems
  })

  if (sttResult) {
    throwIfSttBatchIncomplete(sttResult)
  }

  if (ocrResult && ocrResult.ok === 0 && ocrResult.fail > 0) {
    const error = new Error(`Batch processing failed for ${ocrResult.fail} item(s)`)
    if (ocrResult.failureExitCode !== undefined) {
      ;(error as Error & { exitCode?: number }).exitCode = ocrResult.failureExitCode
    }
    throw error
  }
}

const executeBatchPlan = async (
  command: ProcessCommand,
  opts: RuntimeOptions,
  batchPlan: BatchExecutionPlan
): Promise<void> => {
  if (isExtractCommand(command)) {
    await executeExtractBatchPlan(opts, batchPlan)
    return
  }

  if (isSttCommand(command)) {
    const result = await runSttBatch(
      batchPlan.items,
      batchPlan.label,
      opts,
      {
        ...(batchPlan.source ? { source: batchPlan.source } : {}),
        ...(batchPlan.selectedItems ? { selectedItems: batchPlan.selectedItems } : {}),
        ...(typeof batchPlan.totalCount === 'number' ? { totalCount: batchPlan.totalCount } : {}),
        initialEntries: batchPlan.initialEntries,
        resultEntryIndexes: batchPlan.resultEntryIndexes,
        concurrency: opts.batchConcurrency
      }
    )
    throwIfSttBatchIncomplete(result)
    return
  }

  const { ok, fail, failureExitCode } = await processBatch(
    batchPlan.items,
    batchPlan.label,
    command,
    opts,
    async (commandName, item, batchDir, batchOpts, batchItem) =>
      await processSingleTarget(commandName, item, batchDir, batchOpts, undefined, {
        batchChildContext: {
          batchDir,
          ...(batchItem ? { batchItem } : {})
        }
      }, batchItem),
    {
      ...(batchPlan.source ? { source: batchPlan.source } : {}),
      ...(batchPlan.selectedItems ? { selectedItems: batchPlan.selectedItems } : {}),
      ...(typeof batchPlan.totalCount === 'number' ? { totalCount: batchPlan.totalCount } : {}),
      initialEntries: batchPlan.initialEntries,
      resultEntryIndexes: batchPlan.resultEntryIndexes,
      concurrency: opts.batchConcurrency
    }
  )

  if (ok === 0 && fail > 0) {
    const error = new Error(`Batch processing failed for ${fail} item(s)`)
    if (failureExitCode !== undefined) {
      ;(error as Error & { exitCode?: number }).exitCode = failureExitCode
    }
    throw error
  }
}

const reportSuitePriceEstimate = async (
  command: ProcessCommand,
  targets: string[],
  opts: RuntimeOptions
): Promise<number> => {
  logSingleRowTable(l, 'Suite Price Estimate', {
    itemType: targets.length === 1 ? 'target' : 'targets',
    itemCount: targets.length
  }, { category: 'pricing', columns: ['itemType', 'itemCount'] })

  let suiteTotalEstimatedCost = 0
  const concurrency = isSttCommand(command) || isExtractCommand(command) ? opts.sttPreflightConcurrency : 1

  await runWithConcurrency(targets, concurrency, async (item) => {
    const estimate = await buildAggregatedPriceEstimate(command, item, opts, undefined)
    l.report.estimate(estimate)
    suiteTotalEstimatedCost += estimate.totalEstimatedCost
  })

  logSuitePriceSummary(l, {
    checkedLabel: targets.length === 1 ? 'command' : 'commands',
    checkedCount: targets.length,
    totalEstimatedCost: suiteTotalEstimatedCost
  })

  return suiteTotalEstimatedCost
}

const formatCents = (amount: number): string => `${amount.toFixed(4)}¢`

export const shouldRunCommandPreflight = (
  opts: Pick<RuntimeOptions, 'price'>,
  maxCents: number | undefined
): boolean => opts.price || maxCents !== undefined

export const handleProcessTarget = async (
  command: ProcessCommand,
  target: string | undefined,
  rawFlags: Record<string, unknown>,
  doubleDash: string[] = []
): Promise<void> => {
  const displayCommand = canonicalizeProcessCommand(command)

  if ((isSttCommand(command) || isExtractCommand(command)) && hasTranscribeUnsupportedLLMFlags(rawFlags, doubleDash)) {
    throw CLIUsageError(`LLM provider flags are not supported with "${displayCommand}" (--openai, --groq, --gemini, --anthropic, --minimax, --grok, --llama, --mistral). For Mistral STT, use --mistral-stt <model>.`)
  }

  const configPathOverride = typeof rawFlags['config-path'] === 'string' ? rawFlags['config-path'] : undefined
  const resolvedConfigPath = await resolveConfigPath(configPathOverride)
  const config = await loadConfig(resolvedConfigPath)
  const explicitFlags = extractExplicitFlags(Bun.argv.slice(2))
  const mergedFlags = mergeConfigIntoRawFlags(rawFlags, config, explicitFlags)

  const opts = buildOptsFromFlags(
    isSttCommand(command) || isExtractCommand(command) || command === 'download' || command === 'metadata',
    mergedFlags,
    doubleDash,
    {},
    explicitFlags,
    Bun.argv.slice(2)
  )

  validateWriteStep2ProviderSelection(command, opts)

  const maxCents = resolveMaxCents(config.pricing)

  let resolvedTarget: string
  if (typeof target === 'string' && target.length > 0) {
    resolvedTarget = target
  } else if (doubleDash.length === 1) {
    resolvedTarget = doubleDash[0] as string
  } else if (doubleDash.length > 1) {
    throw CLIUsageError(`Too many positional inputs for "${displayCommand}": ${doubleDash.join(' ')}. Run: bun as help ${displayCommand}`)
  } else {
    throw CLIUsageError(`Missing input for "${displayCommand}". Run: bun as help ${displayCommand}`)
  }

  const plan = await resolveProcessTargetPlan(command, resolvedTarget, opts)
  const singleRouting = plan.kind === 'single' && isExtractCommand(command)
    ? await resolveInputRoutingForCommand(command, plan.target, opts)
    : undefined

  if (singleRouting?.family === 'unsupported') {
    throw CLIUsageError(buildUnsupportedExtractInputMessage(resolvedTarget))
  }

  const batchPlan = await planProcessTargetBatchExecution(plan, command, opts, resolvedTarget)
  const preflightTargets = batchPlan
    ? batchPlan.items
    : plan.kind === 'single'
      ? [plan.target]
      : []
  const shouldRunPreflight = shouldRunCommandPreflight(opts, maxCents)

  if (opts.price) {
    if (preflightTargets.length === 0) {
      return
    }

    if (preflightTargets.length === 1) {
      const estimate = await buildAggregatedPriceEstimate(command, preflightTargets[0] as string, opts, undefined)
      l.report.estimate(estimate)
      if (typeof preflightTargets[0] === 'string' && await isHtmlArticleTarget(preflightTargets[0] as string, opts) && hasConfiguredOcrProviderSelection(opts)) {
        l.warn(`${HTML_ARTICLE_OCR_FLAGS_IGNORED_WARNING.slice(0, -1)} during extraction pricing and execution.`)
      }
      l.report.expectedOutput('./output/<timestamp>_<label>/', await buildExpectedFilesList(command, opts, preflightTargets[0] as string))
      return
    }

    await reportSuitePriceEstimate(command, preflightTargets, opts)
    return
  }

  let singleEstimate: AggregatedPriceEstimate | undefined
  if (shouldRunPreflight) {
    if (preflightTargets.length === 1) {
      const { estimate, shouldExit } = await runPreflight(command, preflightTargets[0] as string, opts, maxCents, undefined)
      singleEstimate = estimate
      if (shouldExit) return
    } else if (preflightTargets.length > 1) {
      const suiteTotalEstimatedCost = await reportSuitePriceEstimate(command, preflightTargets, opts)
      if (maxCents !== undefined && suiteTotalEstimatedCost > maxCents) {
        if (!opts.allowOverBudget) {
          throw CLIUsageError(
            `Estimated suite cost ${formatCents(suiteTotalEstimatedCost)} exceeds configured budget ${formatCents(maxCents)}. Use --allow-over-budget to proceed.`
          )
        }
        l.warn(`Estimated suite cost ${formatCents(suiteTotalEstimatedCost)} exceeds budget ${formatCents(maxCents)} — continuing because --allow-over-budget is set.`)
      }
    }
  }

  if (plan.kind !== 'single' && !batchPlan) {
    return
  }

  if (batchPlan) {
    if (plan.kind === 'directory' && batchPlan.initialEntries.length === 0) {
      l.warn(`No inputs found in ${resolvedTarget}`)
      return
    }
    if (plan.kind === 'youtube_collection') {
      l.write('info', `Detected YouTube collection URL, processing ${batchPlan.initialEntries.length} videos`)
    }
    await executeBatchPlan(command, opts, batchPlan)
    return
  }

  await handleSingleTarget(resolvedTarget, command, opts, singleEstimate)
}
