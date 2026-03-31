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
import { handleInputListTargetBatch } from './url-list-target'
import { handleDirectoryTargetBatch } from './directory-target'
import { resolveYoutubeCollectionItems, tryHandleYoutubeCollectionTarget } from './youtube-collection-target'
import { handleSingleTarget, processSingleTarget } from './single-target'
import { tryResolveBatchSource } from './batch/batch-router'
import { buildAggregatedPriceEstimate } from '~/utils/pricing/aggregate-pricing'
import { runPreflight } from '~/utils/pricing/preflight'
import { resolveConfigPath, loadConfig, resolveMaxCents } from '~/cli/commands/config/config-loader'
import { extractExplicitFlags, mergeConfigIntoRawFlags } from '~/cli/commands/config/config-merge'
import { resolveLLMDefaults } from './llm-defaults'
import { collectTtsTargets, getTtsArtifactFileName } from '~/cli/commands/process-steps/step-4-tts/tts-targets'

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
    return opts.save ? ['metadata.json'] : ['metadata (logged to terminal)']
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

const resolvePriceTargets = async (
  command: ProcessCommand,
  resolvedTarget: string,
  opts: RuntimeOptions
): Promise<string[]> => {
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
    return all
  }

  if (topLevel.kind === 'input_list') {
    const items = await readInputList(resolvedTarget)
    if (items.length === 0) {
      throw CLIUsageError(`No valid inputs found in ${resolvedTarget}. Provide newline-delimited URLs or local file paths in a .md or .txt file.`)
    }
    return items
  }

  const resolved = await tryResolveBatchSource(resolvedTarget, command, opts)
  if (resolved) {
    return resolved.selectedUrls
  }

  const youtubeCollectionItems = await resolveYoutubeCollectionItems(resolvedTarget, command)
  if (youtubeCollectionItems) {
    return youtubeCollectionItems
  }

  return [resolvedTarget]
}

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

  if (opts.price) {
    const targets = await resolvePriceTargets(command, resolvedTarget, opts)
    if (targets.length === 0) {
      return
    }

    if (targets.length === 1) {
      const estimate = await buildAggregatedPriceEstimate(command, targets[0] as string, opts, undefined)
      l.report.estimate(estimate)
      l.report.expectedOutput('./output/<timestamp>_<label>/', buildExpectedFilesList(command, opts))
      return
    }

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
    return
  }

  const { estimate, shouldExit } = await runPreflight(command, resolvedTarget, opts, maxCents, undefined)
  if (shouldExit) return

  const topLevel = await classifyTopLevelTarget(resolvedTarget)

  if (topLevel.kind === 'directory') {
    await handleDirectoryTargetBatch(resolvedTarget, command, opts)
    return
  }
  if (topLevel.kind === 'input_list') {
    await handleInputListTargetBatch(resolvedTarget, command, opts)
    return
  }

  const resolved = await tryResolveBatchSource(resolvedTarget, command, opts)
  if (resolved) {
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

  if (await tryHandleYoutubeCollectionTarget(resolvedTarget, command, opts)) {
    return
  }

  await handleSingleTarget(resolvedTarget, command, opts, estimate)
}
