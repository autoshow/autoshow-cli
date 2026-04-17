import * as l from '~/logger'
import { CLIUsageError } from '~/utils/error-handler'
import type { ProcessCommand, RuntimeOptions } from '~/types'
import { canonicalizeProcessCommand, isOcrCommand, isSttCommand } from '~/cli/commands/process-steps/process-command-kinds'
import {
  buildOptsFromFlags,
  classifyTopLevelTarget,
  collectInputFiles,
  isDocumentByExtension,
  isInputDirectoryPath,
  isDocumentLikeTarget,
  isHtmlArticleTarget,
  processBatch,
  readInputList
} from './target-utils'
import { processResolvedInputListBatch, resolveInputListBatch } from './url-list-target'
import { handleDirectoryTargetBatch } from './directory-target'
import { resolveYoutubeCollectionItems } from './youtube-collection-target'
import { handleSingleTarget, processSingleTarget } from './single-target'
import { tryResolveBatchSource } from './batch/batch-router'
import { buildAggregatedPriceEstimate } from '~/utils/pricing/aggregate-pricing'
import { runPreflight } from '~/utils/pricing/preflight'
import { resolveConfigPath, loadConfig, resolveMaxCents } from '~/cli/commands/setup-and-utilities/config/config-loader'
import { extractExplicitFlags, mergeConfigIntoRawFlags } from '~/cli/commands/setup-and-utilities/config/config-merge'
import { resolveLLMDefaults } from './llm-defaults'
import { collectTtsTargets, getTtsArtifactFileName } from '~/cli/commands/process-steps/step-4-tts/tts-targets'
import type { AggregatedPriceEstimate, ResolvedProcessTargetPlan } from '~/types'
import { collectSttTargets } from '~/cli/commands/process-steps/step-2-stt/stt-targets'
import { runSttBatch, throwIfSttBatchIncomplete } from '~/cli/commands/process-steps/step-2-stt/batch'
import { collectExplicitOcrTargets } from '~/cli/commands/process-steps/step-2-ocr/ocr-targets'
import { dispatchResumeMissing } from '~/cli/commands/process-steps/resume-missing/resume-dispatch'

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
    llmConfig.openaiModel,
    llmConfig.groqModel,
    llmConfig.geminiModel,
    llmConfig.anthropicModel,
    llmConfig.minimaxModel,
    llmConfig.grokModel,
    llmConfig.llamaModel
  ].filter((value): value is string => typeof value === 'string' && value.length > 0).length
}

const hasIgnoredHtmlOcrFlags = (opts: RuntimeOptions): boolean =>
  opts.useOcrmypdf || opts.usePaddleOcr || typeof opts.mistralOcrModel === 'string' || typeof opts.glmOcrModel === 'string'

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
    artifacts.push('chapters/*.txt (EPUB native text runs only)')
  }
  if (typeof opts.epubChunkLimitChars === 'number' && !opts.epubChapterFiles) {
    artifacts.push('chunks/*.txt (EPUB native text runs only)')
  }
  return artifacts
}

export const buildExpectedFilesList = async (command: ProcessCommand, opts: RuntimeOptions, resolvedTarget?: string): Promise<string[]> => {
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
  if (isOcrCommand(command)) {
    const ocrArtifact = getExpectedOcrArtifact(opts)
    const ocrExportArtifacts = getExpectedOcrExportArtifacts(opts)
    const htmlArticleInput = typeof resolvedTarget === 'string' && await isHtmlArticleTarget(resolvedTarget, opts)
    if (opts.useEpubBun || opts.useEpubCalibre) {
      return ['run.json (includes EPUB inspection payload)', 'Extracted text (non-EPUB fallback inputs only)', ...ocrExportArtifacts]
    }
    if (!htmlArticleInput && collectExplicitOcrTargets(opts).length > 1) {
      return [ocrArtifact, ...ocrExportArtifacts, 'providers/<service>-<model>/result.json', 'run.json']
    }
    return [ocrArtifact, ...ocrExportArtifacts, 'run.json']
  }
  if (isSttCommand(command)) {
    const files = collectSttTargets(opts).length > 1
      ? ['Shared audio artifact(s)', 'providers/<service>-<model>/transcription.txt', 'providers/<service>-<model>/result.json', 'prompt.md', 'run.json']
      : ['Audio file', 'transcription.txt', 'prompt.md', 'run.json']
    if (opts.youtubeCaptions) {
      files.splice(files.length - 2, 0, 'youtube-captions.vtt (when available)', 'youtube-captions.json (when available)')
    }
    return files
  }
  const summaryFile = 'text.json'
  const documentWrite = command === 'write'
    && typeof resolvedTarget === 'string'
    && await isDocumentLikeTarget(resolvedTarget, opts)
  if (documentWrite) {
    const files = [getExpectedOcrArtifact(opts), summaryFile]
    files.push(...getExpectedOcrExportArtifacts(opts))
    const htmlArticleInput = typeof resolvedTarget === 'string' && await isHtmlArticleTarget(resolvedTarget, opts)
    if (!htmlArticleInput && collectExplicitOcrTargets(opts).length > 1) {
      files.push('providers/<service>-<model>/result.json')
    }
    files.push('prompt.md')
    files.push('run.json')
    return files
  }
  const files = ['Audio file', 'transcription.txt', summaryFile]
  if (collectSttTargets(opts).length > 1) {
    files.push('providers/<service>-<model>/transcription.txt')
    files.push('providers/<service>-<model>/result.json')
  }
  const ttsTargets = collectTtsTargets(opts)
  if (ttsTargets.length > 0 && getEffectiveLlmOutputCount(opts) === 1) {
    for (const target of ttsTargets) {
      files.push(getTtsArtifactFileName(target, ttsTargets.length === 1))
    }
  }
  if (opts.geminiImageModel || opts.openaiImageModel || opts.minimaxImageModel) {
    files.push('generated-image.png')
  }
  if (opts.geminiVideoModel || opts.minimaxVideoModel) {
    files.push('Video file')
  }
  if (opts.elevenlabsMusicModel || opts.minimaxMusicModel) {
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

const resolveProcessTargetPlan = async (
  command: ProcessCommand,
  resolvedTarget: string,
  opts: RuntimeOptions
): Promise<ResolvedProcessTargetPlan> => {
  const topLevel = await classifyTopLevelTarget(resolvedTarget)

  if (topLevel.kind === 'directory') {
    const allFiles = await collectInputFiles(resolvedTarget)
    const files = isOcrCommand(command)
      ? allFiles.filter(file => isDocumentByExtension(file))
      : allFiles

    const includeUrlsFromInputDir = isInputDirectoryPath(resolvedTarget)
    const listedInputs = includeUrlsFromInputDir
      ? await readInputList(`${resolvedTarget}/2-urls.md`)
      : []

    const all = includeUrlsFromInputDir ? [...files, ...listedInputs] : files
    if (all.length === 0) {
      l.warn(`No inputs found in ${resolvedTarget}`)
    }
    return { kind: 'directory', targets: all }
  }

  if (topLevel.kind === 'input_list') {
    return {
      kind: 'input_list',
      resolvedBatch: await resolveInputListBatch(resolvedTarget, opts)
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

const getPlanTargets = (plan: ResolvedProcessTargetPlan): string[] => {
  if (plan.kind === 'directory' || plan.kind === 'youtube_collection') {
    return plan.targets
  }

  if (plan.kind === 'input_list' || plan.kind === 'resolved_batch') {
    return plan.resolvedBatch.selectedUrls
  }

  return [plan.target]
}

const reportSuitePriceEstimate = async (
  command: ProcessCommand,
  targets: string[],
  opts: RuntimeOptions
): Promise<number> => {
  l.info(`Calculating suite price estimate across ${targets.length} target(s)`)

  let suiteTotalEstimatedCost = 0
  const concurrency = isSttCommand(command) ? opts.sttPreflightConcurrency : 1

  await runWithConcurrency(targets, concurrency, async (item, index) => {
    l.info(`Price check ${index + 1}/${targets.length}: ${item}`)
    const estimate = await buildAggregatedPriceEstimate(command, item, opts, undefined)
    l.report.estimate(estimate)
    suiteTotalEstimatedCost += estimate.totalEstimatedCost
  })

  l.info('')
  l.info(`Suite Cost Summary`)
  l.info(`  Commands checked: ${targets.length}`)
  l.info(`  Suite total estimated cost: ${suiteTotalEstimatedCost.toFixed(5)}¢`)

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

  if (isSttCommand(command) && hasTranscribeUnsupportedLLMFlags(rawFlags, doubleDash)) {
    throw CLIUsageError('LLM provider flags are not supported with "stt" (--openai, --groq, --gemini, --anthropic, --minimax, --grok, --llama, --mistral). For Mistral STT, use --mistral-stt <model>.')
  }

  const configPathOverride = typeof rawFlags['config-path'] === 'string' ? rawFlags['config-path'] : undefined
  const resolvedConfigPath = await resolveConfigPath(configPathOverride)
  const config = await loadConfig(resolvedConfigPath)
  const explicitFlags = extractExplicitFlags(Bun.argv.slice(2))
  const mergedFlags = mergeConfigIntoRawFlags(rawFlags, config, explicitFlags)

  const opts = buildOptsFromFlags(
    isSttCommand(command) || command === 'download' || command === 'metadata',
    mergedFlags,
    doubleDash,
    {},
    explicitFlags
  )

  const maxCents = resolveMaxCents(config.pricing)
  const resumeMissingRequested = explicitFlags.has('resume-missing') || opts.resumeMissing !== undefined

  if (resumeMissingRequested) {
    await dispatchResumeMissing(
      command,
      target,
      opts,
      explicitFlags,
      doubleDash,
      maxCents
    )
    return
  }

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
  const preflightTargets = getPlanTargets(plan)
  const shouldRunPreflight = shouldRunCommandPreflight(opts, maxCents)

  if (opts.price) {
    if (preflightTargets.length === 0) {
      return
    }

    if (preflightTargets.length === 1) {
      const estimate = await buildAggregatedPriceEstimate(command, preflightTargets[0] as string, opts, undefined)
      l.report.estimate(estimate)
      if (typeof preflightTargets[0] === 'string' && await isHtmlArticleTarget(preflightTargets[0] as string, opts) && hasIgnoredHtmlOcrFlags(opts)) {
        l.warn('OCR flags are ignored for HTML/article inputs during extraction pricing and execution.')
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

  if (plan.kind === 'directory') {
    await handleDirectoryTargetBatch(resolvedTarget, command, opts)
    return
  }
  if (plan.kind === 'input_list') {
    await processResolvedInputListBatch(plan.resolvedBatch, command, opts)
    return
  }

  if (plan.kind === 'resolved_batch') {
    const resolved = plan.resolvedBatch
    if (isSttCommand(command)) {
      const result = await runSttBatch(
        resolved.selectedUrls,
        resolved.source.title ?? resolved.source.sourceKind,
        opts,
        {
          source: resolved.source,
          selectedItems: resolved.selectedItems,
          concurrency: opts.batchConcurrency,
          totalCount: resolved.totalCount
        }
      )
      throwIfSttBatchIncomplete(result)
      return
    }

    const { ok, incomplete, fail, failureExitCode } = await processBatch(
      resolved.selectedUrls,
      resolved.source.title ?? resolved.source.sourceKind,
      command,
      opts,
      async (commandName, item, batchDir, batchOpts, batchItem) =>
        await processSingleTarget(commandName, item, batchDir, batchOpts, undefined, undefined, batchItem),
      {
        source: resolved.source,
        selectedItems: resolved.selectedItems,
        concurrency: opts.batchConcurrency,
        totalCount: resolved.totalCount
      }
    )
    if ((isSttCommand(command) && (incomplete > 0 || fail > 0)) || (!isSttCommand(command) && ok === 0 && fail > 0)) {
      const problemCount = isSttCommand(command) ? incomplete + fail : fail
      const error = new Error(`Batch processing failed for ${problemCount} item(s)`)
      if (failureExitCode !== undefined) {
        ;(error as Error & { exitCode?: number }).exitCode = failureExitCode
      }
      throw error
    }
    return
  }

  if (plan.kind === 'youtube_collection') {
    l.info(`Detected YouTube collection URL, processing ${plan.targets.length} videos`)
    if (isSttCommand(command)) {
      const result = await runSttBatch(plan.targets, 'youtube_collection', opts)
      throwIfSttBatchIncomplete(result)
      return
    }

    const { incomplete, fail, failureExitCode } = await processBatch(
      plan.targets,
      'youtube_collection',
      command,
      opts,
      async (commandName, item, batchDir, batchOpts, batchItem) =>
        await processSingleTarget(commandName, item, batchDir, batchOpts, undefined, undefined, batchItem)
    )
    if ((isSttCommand(command) && (incomplete > 0 || fail > 0)) || (!isSttCommand(command) && plan.targets.length > 0 && fail === plan.targets.length)) {
      const problemCount = isSttCommand(command) ? incomplete + fail : fail
      const error = new Error(`Batch processing failed for ${problemCount} item(s)`)
      if (failureExitCode !== undefined) {
        ;(error as Error & { exitCode?: number }).exitCode = failureExitCode
      }
      throw error
    }
    return
  }

  await handleSingleTarget(resolvedTarget, command, opts, singleEstimate)
}
