import * as l from '~/logger'
import { CLIUsageError } from '~/utils/error-handler'
import type { ProcessCommand, RuntimeOptions } from '~/types'
import { canonicalizeProcessCommand, isOcrCommand, isSttCommand } from '~/types'
import {
  buildOptsFromFlags,
  classifyTopLevelTarget,
  collectInputFiles,
  isDocumentByExtension,
  isInputDirectoryPath,
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
import { resolveConfigPath, loadConfig, resolveMaxCents } from '~/cli/commands/config/config-loader'
import { extractExplicitFlags, mergeConfigIntoRawFlags } from '~/cli/commands/config/config-merge'
import { resolveLLMDefaults } from './llm-defaults'
import { collectTtsTargets, getTtsArtifactFileName } from '~/cli/commands/process-steps/step-4-tts/tts-targets'
import type { AggregatedPriceEstimate, ResolvedBatch } from '~/types'

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

const buildExpectedFilesList = (command: ProcessCommand, opts: RuntimeOptions): string[] => {
  if (command === 'metadata') {
    if (!opts.save) {
      return [opts.markdown ? 'metadata (logged to terminal as Markdown frontmatter YAML)' : 'metadata (logged to terminal)']
    }
    return opts.markdown ? ['metadata.json', 'metadata.md'] : ['metadata.json']
  }
  if (command === 'download') {
    return ['Audio or document file', 'metadata.json']
  }
  if (isOcrCommand(command)) {
    if (opts.useEpubBun || opts.useEpubCalibre) {
      return ['metadata.json (includes EPUB inspection payload)', 'Extracted text (non-EPUB fallback inputs only)']
    }
    return ['Extracted text', 'metadata.json']
  }
  if (isSttCommand(command)) {
    return ['Audio file', 'transcription.txt', 'prompt.md', 'metadata.json']
  }
  const hasNonLlamaLlmProvider = !!(
    opts.useOpenAI
    || opts.groqModel
    || opts.useGemini
    || opts.useAnthropic
    || opts.minimaxModel
    || opts.grokModel
  )
  const summaryFile = opts.structured && hasNonLlamaLlmProvider ? 'text.json' : 'text.md'
  const files = ['Audio file', 'transcription.txt', summaryFile]
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
  files.push('prompt.md')
  files.push('metadata.json')
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

type ResolvedProcessTargetPlan =
  | { kind: 'directory', targets: string[] }
  | { kind: 'input_list', resolvedBatch: ResolvedBatch }
  | { kind: 'resolved_batch', resolvedBatch: ResolvedBatch }
  | { kind: 'youtube_collection', targets: string[] }
  | { kind: 'single', target: string }

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

  for (let index = 0; index < targets.length; index++) {
    const item = targets[index] as string
    l.info(`Price check ${index + 1}/${targets.length}: ${item}`)

    const estimate = await buildAggregatedPriceEstimate(command, item, opts, undefined)
    l.report.estimate(estimate)
    suiteTotalEstimatedCost += estimate.totalEstimatedCost
  }

  l.info('')
  l.info(`Suite Cost Summary`)
  l.info(`  Commands checked: ${targets.length}`)
  l.info(`  Suite total estimated cost: ${suiteTotalEstimatedCost.toFixed(5)}¢`)

  return suiteTotalEstimatedCost
}

const formatCents = (amount: number): string => `${amount.toFixed(4)}¢`

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


  const configPathOverride = typeof rawFlags['config-path'] === 'string' ? rawFlags['config-path'] : undefined
  const resolvedConfigPath = await resolveConfigPath(configPathOverride)
  const config = await loadConfig(resolvedConfigPath)
  const explicitFlags = extractExplicitFlags(Bun.argv.slice(2))
  const mergedFlags = mergeConfigIntoRawFlags(rawFlags, config, explicitFlags)

  const opts = buildOptsFromFlags(isSttCommand(command) || command === 'download' || command === 'metadata', mergedFlags, doubleDash)

  if (command === 'write' || isSttCommand(command)) {
    const sttEngineCount = [opts.useReverb, opts.elevenlabsSttModel, opts.groqSttModel, opts.openaiSttModel, opts.mistralSttModel, opts.assemblyaiSttModel].filter(Boolean).length
    if (sttEngineCount > 1) {
      throw CLIUsageError('Cannot use more than one transcription engine at the same time (--reverb, --elevenlabs-stt, --groq-stt, --openai-stt, --mistral-stt, --assemblyai-stt)')
    }
  }

  if (isOcrCommand(command) || command === 'write') {
    const ocrEngineCount = [opts.useOcrmypdf, opts.usePaddleOcr, opts.mistralOcrModel].filter(Boolean).length
    if (ocrEngineCount > 1) {
      throw CLIUsageError('Cannot use more than one extract OCR engine at the same time (--ocrmypdf, --paddle-ocr, --mistral-ocr)')
    }
  }

  if (command === 'write') {
    const musicProviderCount = [opts.elevenlabsMusicModel, opts.minimaxMusicModel].filter(Boolean).length
    if (musicProviderCount > 1) {
      throw CLIUsageError('Cannot use more than one music provider at the same time (--elevenlabs-music, --minimax-music)')
    }
  }

  const maxCents = resolveMaxCents(config.pricing)
  const plan = await resolveProcessTargetPlan(command, resolvedTarget, opts)
  const preflightTargets = getPlanTargets(plan)

  if (opts.price) {
    if (preflightTargets.length === 0) {
      return
    }

    if (preflightTargets.length === 1) {
      const estimate = await buildAggregatedPriceEstimate(command, preflightTargets[0] as string, opts, undefined)
      l.report.estimate(estimate)
      l.report.expectedOutput('./output/<timestamp>_<label>/', buildExpectedFilesList(command, opts))
      return
    }

    await reportSuitePriceEstimate(command, preflightTargets, opts)
    return
  }

  let singleEstimate: AggregatedPriceEstimate | undefined
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
    const { ok, fail } = await processBatch(
      resolved.selectedUrls,
      resolved.source.title ?? resolved.source.sourceKind,
      command,
      opts,
      processSingleTarget,
      {
        source: resolved.source,
        selectedItems: resolved.selectedItems,
        concurrency: opts.batchConcurrency,
        totalCount: resolved.totalCount
      }
    )
    if (ok === 0 && fail > 0) {
      throw new Error(`Batch processing failed for all ${fail} item(s)`)
    }
    return
  }

  if (plan.kind === 'youtube_collection') {
    l.info(`Detected YouTube collection URL, processing ${plan.targets.length} videos`)
    const { fail } = await processBatch(plan.targets, 'youtube_collection', command, opts, processSingleTarget)
    if (plan.targets.length > 0 && fail === plan.targets.length) {
      throw new Error(`Batch processing failed for ${fail} item(s)`)
    }
    return
  }

  await handleSingleTarget(resolvedTarget, command, opts, singleEstimate)
}
