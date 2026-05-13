import * as l from '~/utils/logger'
import { CLIUsageError } from '~/utils/error-handler'
import type { AggregatedPriceEstimate, ProcessCommand, RuntimeOptions } from '~/types'
import { canonicalizeProcessCommand, isExtractCommand } from '~/cli/commands/process-steps/process-command-kinds'
import { buildOptsFromFlags, isHtmlArticleTarget, resolveInputRoutingForCommand } from './target-utils'
import { handleSingleTarget } from './single-target'
import { buildAggregatedPriceEstimate } from '~/utils/pricing/aggregate-pricing'
import { runPreflight } from '~/utils/pricing/preflight'
import { commandExists } from '~/utils/cli-utils'
import { resolveConfigPath, loadConfig, resolveMaxCents } from '~/cli/commands/setup-and-utilities/config/config-loader'
import { extractExplicitFlags, mergeConfigIntoRawFlags } from '~/cli/commands/setup-and-utilities/config/config-merge'
import { setupYtDependencies } from '~/cli/commands/setup-and-utilities/setup/setup-download/dl-audio/audio'
import { readPromptFileText, resolveWriteTextProjectDefaults } from '~/cli/commands/process-steps/step-3-write/text-input-utils'
import { hasConfiguredOcrProviderSelection, HTML_ARTICLE_OCR_FLAGS_IGNORED_WARNING } from '~/cli/commands/process-steps/step-2-extract/step-2-shared/inactive-flag-warnings'
import { executeBatchPlan } from './batch/batch-executor'
import { buildBatchExpectedFilesList, buildExpectedFilesList } from './expected-output'
import { planProcessTargetBatchExecution, resolveProcessTargetPlan } from './process-target-plan'
import { formatCents, reportSuitePriceEstimate, shouldRunCommandPreflight } from './process-target-preflight'
import { buildUnsupportedExtractInputMessage, validateWriteStep2ProviderSelection } from './process-target-validation'

export { buildExpectedFilesList } from './expected-output'
export { shouldRunCommandPreflight } from './process-target-preflight'

export type ResolvedProcessTargetDoubleDash =
  | { kind: 'target', resolvedTarget: string, ytDlpPassthroughArgs?: string[] | undefined }
  | { kind: 'raw-yt-dlp', ytDlpPassthroughArgs: string[] }

const isDownloadCommand = (command: ProcessCommand): boolean => command === 'download'

const buildPassthroughUnsupportedMessage = (): string =>
  'yt-dlp passthrough (--) is only supported for the "download" command'

export const resolveProcessTargetDoubleDash = (
  command: ProcessCommand,
  target: string | undefined,
  doubleDash: string[] = []
): ResolvedProcessTargetDoubleDash => {
  const displayCommand = canonicalizeProcessCommand(command)

  if (typeof target === 'string' && target.length > 0) {
    if (doubleDash.length > 0) {
      if (!isDownloadCommand(command)) {
        throw CLIUsageError(buildPassthroughUnsupportedMessage())
      }
      return { kind: 'target', resolvedTarget: target, ytDlpPassthroughArgs: [...doubleDash] }
    }
    return { kind: 'target', resolvedTarget: target }
  }

  if (doubleDash.length > 0 && doubleDash[0]?.startsWith('-')) {
    if (!isDownloadCommand(command)) {
      throw CLIUsageError(buildPassthroughUnsupportedMessage())
    }
    return { kind: 'raw-yt-dlp', ytDlpPassthroughArgs: [...doubleDash] }
  }

  if (doubleDash.length === 1) {
    return { kind: 'target', resolvedTarget: doubleDash[0] as string }
  }

  if (doubleDash.length > 1) {
    throw CLIUsageError(`Too many positional inputs for "${displayCommand}": ${doubleDash.join(' ')}. Run: bun as help ${displayCommand}`)
  }

  throw CLIUsageError(`Missing input for "${displayCommand}". Run: bun as help ${displayCommand}`)
}

export const runRawYtDlp = async (args: string[]): Promise<void> => {
  if (!commandExists('yt-dlp')) {
    await setupYtDependencies()
  }

  const proc = Bun.spawn(['yt-dlp', ...args], {
    stdin: 'inherit',
    stdout: 'inherit',
    stderr: 'inherit'
  })
  const exitCode = await proc.exited
  if (exitCode !== 0) {
    const error = new Error(`yt-dlp exited with code ${exitCode}`)
    ;(error as Error & { exitCode?: number }).exitCode = exitCode
    throw error
  }
}

export const handleProcessTarget = async (
  command: ProcessCommand,
  target: string | undefined,
  rawFlags: Record<string, unknown>,
  doubleDash: string[] = []
): Promise<void> => {
  const resolvedDoubleDash = resolveProcessTargetDoubleDash(command, target, doubleDash)
  if (resolvedDoubleDash.kind === 'raw-yt-dlp') {
    await runRawYtDlp(resolvedDoubleDash.ytDlpPassthroughArgs)
    return
  }

  const configPathOverride = typeof rawFlags['config-path'] === 'string' ? rawFlags['config-path'] : undefined
  const resolvedConfigPath = await resolveConfigPath(configPathOverride)
  const config = await loadConfig(resolvedConfigPath)
  const explicitFlags = extractExplicitFlags(Bun.argv.slice(2))
  const mergedFlags = mergeConfigIntoRawFlags(rawFlags, config, explicitFlags)

  const opts: RuntimeOptions = {
    ...buildOptsFromFlags(
      isExtractCommand(command) || command === 'download' || command === 'metadata',
      mergedFlags,
      doubleDash,
      {},
      explicitFlags,
      Bun.argv.slice(2)
    ),
    configPath: resolvedConfigPath
  }

  const maxCents = resolveMaxCents(config.pricing)

  const resolvedTarget = resolvedDoubleDash.resolvedTarget
  if (resolvedDoubleDash.ytDlpPassthroughArgs && resolvedDoubleDash.ytDlpPassthroughArgs.length > 0) {
    opts.ytDlpPassthroughArgs = resolvedDoubleDash.ytDlpPassthroughArgs
    l.write('info', `Forwarding ${resolvedDoubleDash.ytDlpPassthroughArgs.length} passthrough arg(s) to yt-dlp`)
  }

  const writeProjectDefaults = command === 'write'
    ? await resolveWriteTextProjectDefaults(resolvedTarget, opts, explicitFlags)
    : undefined
  const effectiveOpts: RuntimeOptions = writeProjectDefaults
    ? {
        ...opts,
        textInput: true,
        promptFile: writeProjectDefaults.promptFile,
        renderedOutDir: writeProjectDefaults.renderedOutDir,
        trackList: writeProjectDefaults.trackList
      }
    : opts

  if (writeProjectDefaults && !explicitFlags.has('prompt-file')) {
    await readPromptFileText(writeProjectDefaults.promptFile).catch(() => {
      throw CLIUsageError(`write project mode requires ${writeProjectDefaults.projectDir}/prompt.md or an explicit --prompt-file`)
    })
  }

  validateWriteStep2ProviderSelection(command, effectiveOpts)

  const plan = await resolveProcessTargetPlan(command, resolvedTarget, effectiveOpts)
  const singleRouting = plan.kind === 'single' && isExtractCommand(command)
    ? await resolveInputRoutingForCommand(command, plan.target, effectiveOpts)
    : undefined

  if (singleRouting?.family === 'unsupported') {
    throw CLIUsageError(buildUnsupportedExtractInputMessage(resolvedTarget))
  }

  const batchPlan = await planProcessTargetBatchExecution(plan, command, effectiveOpts, resolvedTarget)
  const preflightTargets = batchPlan
    ? batchPlan.items
    : plan.kind === 'single'
      ? [plan.target]
      : []
  const shouldRunPreflight = shouldRunCommandPreflight(effectiveOpts, maxCents)

  if (effectiveOpts.price) {
    if (preflightTargets.length === 0) {
      return
    }

    if (preflightTargets.length === 1) {
      const estimate = await buildAggregatedPriceEstimate(command, preflightTargets[0] as string, effectiveOpts, undefined)
      l.report.estimate(estimate)
      if (typeof preflightTargets[0] === 'string' && await isHtmlArticleTarget(preflightTargets[0] as string, effectiveOpts) && hasConfiguredOcrProviderSelection(effectiveOpts)) {
        l.warn(`${HTML_ARTICLE_OCR_FLAGS_IGNORED_WARNING.slice(0, -1)} during extraction pricing and execution.`)
      }
      l.report.expectedOutput('./output/<timestamp>_<label>/', await buildExpectedFilesList(command, effectiveOpts, preflightTargets[0] as string))
      return
    }

    await reportSuitePriceEstimate(command, preflightTargets, effectiveOpts)
    if (writeProjectDefaults) {
      l.report.expectedOutput(
        './output/<timestamp>_text/',
        await buildBatchExpectedFilesList(command, effectiveOpts, preflightTargets[0] as string)
      )
    }
    return
  }

  let singleEstimate: AggregatedPriceEstimate | undefined
  if (shouldRunPreflight) {
    if (preflightTargets.length === 1) {
      const { estimate, shouldExit } = await runPreflight(command, preflightTargets[0] as string, effectiveOpts, maxCents, undefined)
      singleEstimate = estimate
      if (shouldExit) return
    } else if (preflightTargets.length > 1) {
      const suiteTotalEstimatedCost = await reportSuitePriceEstimate(command, preflightTargets, effectiveOpts)
      if (maxCents !== undefined && suiteTotalEstimatedCost > maxCents) {
        if (!effectiveOpts.allowOverBudget) {
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
    await executeBatchPlan(command, effectiveOpts, batchPlan)
    return
  }

  await handleSingleTarget(resolvedTarget, command, effectiveOpts, singleEstimate)
}
