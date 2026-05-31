import { stat } from 'node:fs/promises'
import { basename, extname } from 'node:path'
import { defineCliCommand } from '~/cli/native'
import { ttsCommandFlags } from '~/cli/flags'
import { CLIUsageError } from '~/utils/error-handler'
import { buildOptsFromFlags } from '~/cli/commands/process-steps/step-1-download/targets/build-opts-from-flags'
import { extractExplicitFlags } from '~/cli/commands/setup-and-utilities/config/config-merge'
import {
  normalizeLegacyMultiSpeakerFlags,
  normalizeGenericProviderSelectorFlags,
  normalizeGenericTtsOptionFlags,
  STANDALONE_TTS_PROVIDER_TARGETS
} from '~/cli/commands/process-steps/service-selector-normalization'
import { runTts } from './run-tts'
import { buildEstimatedTtsTargets, buildTtsArtifactMap, collectTtsTargets, getTtsArtifactFileName } from './tts-targets'
import { collectTextInputFiles, isTextInputPath } from '~/cli/commands/process-steps/step-3-write/text-input-utils'
import { reserveBatchChildOutputDir } from '~/cli/commands/process-steps/batch-child-output'
import { writeBatchManifest } from '~/cli/commands/process-steps/manifest-utils'
import { buildBatchManifestEntryForItem } from '~/cli/commands/process-steps/step-1-download/targets/batch/batch-manifest'
import { logBatchCompletionTable, logBatchItemStatus } from '~/cli/commands/process-steps/step-1-download/targets/batch/batch-summary'
import { computeActualCosts } from '~/utils/pricing/compute-actual-costs'
import { computeEstimatedCosts } from '~/utils/pricing/compute-estimated-costs'
import { computeActualProcessingTimes, computeEstimatedProcessingTimes } from '~/utils/pricing/compute-processing-time'
import { preflightToEstimated } from '~/utils/pricing/compute-costs'
import { runPreflight } from '~/utils/pricing/preflight'
import { buildProviderStepSummaries, createGenerationOutputDir, getGenerationExpectedOutputDir, resolveMaxCentsFromFlags, writeGenerationMetadata } from '~/cli/commands/process-steps/generation-command-utils'
import { buildAggregatedPriceEstimate } from '~/utils/pricing/aggregate-pricing'
import { logSuitePriceSummary } from '~/cli/commands/process-steps/suite-price-logging'
import { createDetailTable, logLocationsTable } from '~/utils/logger/human-table'
import { formatDuration, formatEstimatedCostWithExactCents } from '~/utils/logger/formatters'
import * as l from '~/utils/logger'
import { runWithLogContext } from '~/utils/logger'
import {
  isMultiSpeakerRequested,
  normalizeDialogueFromOptions
} from './dialogue-normalizer'
import { buildTtsBatchEstimateSummary, computeSuccessfulTtsBatchActualCost } from './tts-batch-summary'
import type { SuccessfulTtsBatchItem, TtsBatchEstimateSummary } from './tts-batch-summary'
import type { AggregatedPriceEstimate, BatchManifestEntry, RuntimeOptions, Step4Metadata, TtsTarget } from '~/types'

type PreparedTtsInput = {
  inputPath: string
  text: string
  ttsCharacterCount: number
  ttsTimingInputText: string
  dialogueRequested: boolean
}

type TtsBatchEstimateReport = {
  estimates: AggregatedPriceEstimate[]
  totalEstimatedCost: number
  summary: TtsBatchEstimateSummary
}

const formatCents = (amount: number): string => `${amount.toFixed(3)}¢`

const getTtsInputKind = async (inputPath: string): Promise<'file' | 'directory'> => {
  try {
    const stats = await stat(inputPath)
    if (stats.isDirectory()) {
      return 'directory'
    }
    if (stats.isFile()) {
      return 'file'
    }
  } catch (error) {
    const code = error !== null && typeof error === 'object' && 'code' in error
      ? (error as { code?: unknown }).code
      : undefined
    if (code === 'ENOENT') {
      throw CLIUsageError(`File not found: ${inputPath}`)
    }
    throw error
  }

  throw CLIUsageError(`tts input must be a file or directory. Got: ${inputPath}`)
}

const getInputStem = (inputPath: string): string =>
  basename(inputPath, extname(inputPath)) || 'tts'

const prepareTtsInput = async (
  inputPath: string,
  ttsOptions: RuntimeOptions
): Promise<PreparedTtsInput> => {
  const text = await Bun.file(inputPath).text()
  if (!text.trim()) {
    throw CLIUsageError(`Input file is empty: ${inputPath}`)
  }

  const dialogueRequested = isMultiSpeakerRequested(ttsOptions)
  const dialoguePreview = dialogueRequested ? normalizeDialogueFromOptions(text, ttsOptions) : undefined

  return {
    inputPath,
    text,
    ttsCharacterCount: dialoguePreview?.spokenCharacterCount ?? text.length,
    ttsTimingInputText: dialoguePreview
      ? dialoguePreview.turns.map((turn) => turn.text).join('\n')
      : text,
    dialogueRequested
  }
}

const buildTtsEstimateForInput = async (
  prepared: PreparedTtsInput,
  ttsOptions: RuntimeOptions
): Promise<AggregatedPriceEstimate> =>
  await buildAggregatedPriceEstimate('tts', prepared.inputPath, ttsOptions, prepared.ttsCharacterCount, {
    ttsInputText: prepared.ttsTimingInputText
  })

const reportTtsBatchEstimates = async (
  preparedInputs: PreparedTtsInput[],
  ttsOptions: RuntimeOptions,
  logItems: boolean,
  batchConcurrency: number
): Promise<TtsBatchEstimateReport> => {
  const estimates: AggregatedPriceEstimate[] = []

  for (const prepared of preparedInputs) {
    if (logItems) {
      l.write('info', 'TTS Price Item', {
        category: 'pricing',
        humanTable: createDetailTable([
          ['input', prepared.inputPath],
          ['characters', prepared.ttsCharacterCount]
        ]),
        metadata: {
          input: prepared.inputPath,
          characters: prepared.ttsCharacterCount
        }
      })
    }

    const estimate = await buildTtsEstimateForInput(prepared, ttsOptions)
    estimates.push(estimate)

    if (logItems) {
      l.report.estimate(estimate)
    }
  }

  const summary = buildTtsBatchEstimateSummary(estimates, batchConcurrency, ttsOptions.ttsChunkConcurrency)
  l.write('info', 'TTS Batch Estimate', {
    category: 'pricing',
    humanTable: createDetailTable([
      ['inputs', summary.inputCount],
      ['batchConcurrency', summary.batchConcurrency],
      ['ttsChunkConcurrency', summary.ttsChunkConcurrency],
      ['totalEstimatedProcessingTime', formatDuration(summary.totalEstimatedProcessingTimeMs)],
      ['estimatedWallTime', formatDuration(summary.estimatedWallTimeMs)],
      ['totalEstimatedCost', formatEstimatedCostWithExactCents(summary.totalEstimatedCost)]
    ]),
    metadata: summary
  })

  if (logItems) {
    logSuitePriceSummary(l, {
      checkedLabel: preparedInputs.length === 1 ? 'TTS input' : 'TTS inputs',
      checkedCount: preparedInputs.length,
      totalEstimatedCost: summary.totalEstimatedCost
    })
  }

  return { estimates, totalEstimatedCost: summary.totalEstimatedCost, summary }
}

const enforceTtsBatchBudget = (
  totalEstimatedCost: number,
  maxCents: number | undefined,
  allowOverBudget: boolean
): void => {
  if (maxCents === undefined || totalEstimatedCost <= maxCents) {
    return
  }

  if (!allowOverBudget) {
    throw CLIUsageError(
      `Estimated suite cost ${formatCents(totalEstimatedCost)} exceeds configured budget ${formatCents(maxCents)}. Use --allow-over-budget to proceed.`
    )
  }

  l.warn(`Estimated suite cost ${formatCents(totalEstimatedCost)} exceeds budget ${formatCents(maxCents)} - continuing because --allow-over-budget is set.`)
}

const runPreparedTtsInput = async (
  prepared: PreparedTtsInput,
  outputDir: string,
  ttsOptions: RuntimeOptions,
  targets: TtsTarget[],
  preflightEstimate: AggregatedPriceEstimate
): Promise<Step4Metadata[]> => {
  const { metadata } = await runWithLogContext({ step: 'step-4-tts' }, async () =>
    await runTts(prepared.text, outputDir, ttsOptions)
  )

  const estimatedTtsTargets = buildEstimatedTtsTargets(targets)
  const observedEstimate = computeEstimatedCosts({
    applyCostMultipliers: false,
    ttsTargets: estimatedTtsTargets,
    ttsCharacterCount: prepared.ttsCharacterCount
  })
  const actual = computeActualCosts({
    step4: metadata,
    ttsCharacterCount: prepared.ttsCharacterCount
  })
  const cost = {
    estimated: preflightToEstimated(preflightEstimate),
    observedEstimate,
    actual
  }
  const timing = {
    estimated: computeEstimatedProcessingTimes({
      ttsTargets: estimatedTtsTargets,
      ttsCharacterCount: prepared.ttsCharacterCount,
      ttsInputText: prepared.ttsTimingInputText,
      ttsChunkConcurrency: ttsOptions.ttsChunkConcurrency,
    }),
    actual: computeActualProcessingTimes({
      step4: metadata,
      ttsCharacterCount: prepared.ttsCharacterCount,
    }),
  }

  await writeGenerationMetadata(outputDir, 'tts', metadata, cost, timing, {
    input: prepared.text,
    requestedProviders: targets.map((t) => ({ service: t.service, model: t.model }))
  })

  l.report.complete(
    outputDir,
    {
      ...buildTtsArtifactMap(metadata, 'audio'),
      ...(prepared.dialogueRequested ? { dialogue: 'dialogue-normalized.txt', segments: 'segments/' } : {}),
      run: 'run.json'
    },
    {
      steps: buildProviderStepSummaries(
        'TTS',
        'tts',
        metadata,
        actual.steps,
        (entry) => `${entry.ttsService}/${entry.ttsModel}`,
        (entry) => entry.processingTime
      ),
      totalTimeMs: metadata.reduce((sum, entry) => sum + entry.processingTime, 0),
      totalCost: actual.totalCost,
      includeOutputDir: false
    }
  )

  return metadata
}

const runSingleTtsInput = async (
  inputPath: string,
  flags: Record<string, unknown>,
  ttsOptions: RuntimeOptions,
  targets: TtsTarget[],
  maxCents: number | undefined
): Promise<void> => {
  if (!isTextInputPath(inputPath)) {
    throw CLIUsageError(`tts only accepts .md or .txt files. Got: ${inputPath}`)
  }

  const prepared = await prepareTtsInput(inputPath, ttsOptions)
  const { estimate: preflightEstimate, shouldExit } = await runPreflight('tts', inputPath, ttsOptions, maxCents, prepared.ttsCharacterCount, {
    ttsInputText: prepared.ttsTimingInputText
  })
  if (shouldExit) {
    l.report.expectedOutput(
      getGenerationExpectedOutputDir(flags, './output/<timestamp>_<label>/'),
      prepared.dialogueRequested
        ? ['dialogue-normalized.txt', 'segments/', 'speech.wav', 'run.json']
        : [...targets.map((target) => getTtsArtifactFileName(target, targets.length === 1)), 'run.json']
    )
    return
  }

  const outputDir = await createGenerationOutputDir(getInputStem(inputPath), flags)
  await runPreparedTtsInput(prepared, outputDir, ttsOptions, targets, preflightEstimate)
}

const buildTtsBatchInitialEntries = (
  preparedInputs: PreparedTtsInput[]
): BatchManifestEntry[] =>
  preparedInputs.map((prepared) => ({
    ...buildBatchManifestEntryForItem(prepared.inputPath),
    input: prepared.inputPath,
    inputKind: 'text',
    characterCount: prepared.ttsCharacterCount
  }))

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

const runTtsDirectoryBatch = async (
  inputPath: string,
  flags: Record<string, unknown>,
  ttsOptions: RuntimeOptions,
  targets: TtsTarget[],
  maxCents: number | undefined
): Promise<void> => {
  const inputFiles = await collectTextInputFiles(inputPath)
  if (inputFiles.length === 0) {
    l.warn(`No .md or .txt files found in ${inputPath}`)
    return
  }

  const preparedInputs = await Promise.all(inputFiles.map((file) => prepareTtsInput(file, ttsOptions)))
  const concurrency = Math.max(1, ttsOptions.batchConcurrency ?? 1)
  const shouldLogEstimates = ttsOptions.price || maxCents !== undefined
  const estimateReport = await reportTtsBatchEstimates(preparedInputs, ttsOptions, shouldLogEstimates, concurrency)
  enforceTtsBatchBudget(estimateReport.totalEstimatedCost, maxCents, ttsOptions.allowOverBudget)

  if (ttsOptions.price) {
    return
  }

  const batchDir = await createGenerationOutputDir(getInputStem(inputPath), flags)
  const batchSource = {
    sourceKind: 'directory',
    sourceUrl: inputPath,
    title: getInputStem(inputPath),
    selectedCount: preparedInputs.length
  }
  const finalEntries = buildTtsBatchInitialEntries(preparedInputs)
  await writeBatchManifest(batchDir, 'tts', finalEntries, batchSource)
  logLocationsTable(l, [{ artifact: 'batchManifest', path: `${batchDir}/batch.json` }])

  if (concurrency > 1) {
    l.write('info', `Processing ${preparedInputs.length} TTS inputs with concurrency ${concurrency}`)
  }

  let ok = 0
  let partial = 0
  let fail = 0
  const successfulItems: SuccessfulTtsBatchItem[] = []

  const batchStartedAt = Date.now()
  await runWithConcurrency(preparedInputs, concurrency, async (prepared, index) => {
    await runWithLogContext({ batchId: basename(batchDir), itemIndex: index + 1, itemCount: preparedInputs.length }, async () => {
      logBatchItemStatus('info', prepared.inputPath, 'processing')
      const childOutputDir = await reserveBatchChildOutputDir({ batchDir }, {
        title: getInputStem(prepared.inputPath),
        fallbackLabel: `item-${index + 1}`
      }) ?? `${batchDir}/${getInputStem(prepared.inputPath)}`

      try {
        const metadata = await runPreparedTtsInput(
          prepared,
          childOutputDir,
          ttsOptions,
          targets,
          estimateReport.estimates[index] ?? await buildTtsEstimateForInput(prepared, ttsOptions)
        )
        const isPartial = metadata.length < targets.length
        finalEntries[index] = {
          ...(finalEntries[index] ?? {}),
          outputDir: childOutputDir,
          completionStatus: isPartial ? 'incomplete' : 'full',
          tts: metadata
        }
        successfulItems.push({
          metadata,
          characterCount: prepared.ttsCharacterCount
        })
        ok++
        if (isPartial) {
          partial++
          logBatchItemStatus('warn', prepared.inputPath, 'incomplete', `${metadata.length}/${targets.length} providers completed`)
        } else {
          logBatchItemStatus('success', prepared.inputPath, 'done')
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        finalEntries[index] = {
          ...(finalEntries[index] ?? {}),
          outputDir: childOutputDir,
          completionStatus: 'failed',
          errors: [{ message }]
        }
        fail++
        logBatchItemStatus('error', prepared.inputPath, 'failed', message)
      }
    })
  })
  const actualBatchWallTimeMs = Date.now() - batchStartedAt
  const actualTotalCost = computeSuccessfulTtsBatchActualCost(successfulItems)

  await writeBatchManifest(batchDir, 'tts', finalEntries, batchSource)
  logBatchCompletionTable('tts', ok, partial, 0, fail)
  l.report.complete(batchDir, { batch: 'batch.json' }, {
    summaryMessage: 'TTS Batch Complete',
    totalTimeMs: actualBatchWallTimeMs,
    totalCost: actualTotalCost,
    steps: [],
    includeOutputDir: true
  })

  if (ok === 0 && fail > 0) {
    throw new Error(`TTS batch processing failed for ${fail} item(s)`)
  }
}

export const ttsCommand = defineCliCommand({
  name: 'tts',
  description: 'Generate speech audio from a text file (.md or .txt)',
  parameters: [{ key: '<input>', description: 'Path to .md or .txt file' }],
  flags: ttsCommandFlags,
  help: {
    examples: [
      ['bun as tts input/examples/tts/1-tts.md --provider kitten=kitten-tts-nano-0.8-int8', 'Generate speech with local Kitten TTS'],
      ['bun as tts input/examples/tts/1-tts.md --provider elevenlabs=eleven_v3', 'Generate speech with ElevenLabs'],
      ['bun as tts input/examples/tts/1-tts.md --provider elevenlabs=eleven_v3 --tts-ref-audio input/examples/audio/anthony-voice.mp3', 'Clone a voice with ElevenLabs IVC'],
      ['bun as tts input/examples/tts/1-tts.md --provider minimax=speech-2.8-turbo --tts-voice English_expressive_narrator', 'Use a MiniMax voice ID'],
      ['bun as tts input/examples/tts/1-tts.md --provider mistral=voxtral-mini-tts-2603 --tts-ref-audio input/examples/audio/anthony-voice.mp3', 'Generate speech with Mistral Voxtral']
    ]
  }
}, async (ctx) => {
  const inputPath = ctx.parameters.input
  const flags = ctx.flags as Record<string, unknown>
  const inputKind = await getTtsInputKind(inputPath)
  const maxCents = await resolveMaxCentsFromFlags(flags)
  const rawArgs = Bun.argv.slice(2)
  const explicitFlags = extractExplicitFlags(rawArgs)
  const providerNormalized = normalizeGenericProviderSelectorFlags(
    flags,
    explicitFlags,
    'provider',
    STANDALONE_TTS_PROVIDER_TARGETS,
    { allProvidersTarget: 'all-tts', rawArgs }
  )
  const ttsNormalized = normalizeGenericTtsOptionFlags(
    providerNormalized.flags,
    providerNormalized.explicitFlags,
    'kitten'
  )
  const legacyNormalized = normalizeLegacyMultiSpeakerFlags(
    ttsNormalized.flags,
    ttsNormalized.explicitFlags
  )
  const ttsOptions = buildOptsFromFlags(
    true,
    legacyNormalized.flags,
    [],
    { defaultTtsEngine: 'kitten' },
    legacyNormalized.explicitFlags,
    providerNormalized.rawArgs ?? rawArgs
  )
  const targets = collectTtsTargets(ttsOptions)

  if (inputKind === 'directory') {
    await runTtsDirectoryBatch(inputPath, flags, ttsOptions, targets, maxCents)
    return
  }

  await runSingleTtsInput(inputPath, flags, ttsOptions, targets, maxCents)
})
