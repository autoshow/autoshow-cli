import { appendFile, rm } from 'node:fs/promises'
import type { ApiCheapPriceCommand } from '../test-utils/api-cheap-config'
import { dedupePriceCommands } from '../test-utils/api-cheap-config'
import type { PriceCommandResult, TestRunArtifacts, Tier } from '../../src/types/tests-dir-types'
import { parseRunnerArgs, type RunnerArgs } from './args'
import { createRunArtifacts, appendRunnerLog, appendCommandLog, writeJsonFile, writeReportJson } from './artifacts'
import {
  ALL_TIERS,
  TIER_RULES,
} from './constants'
import { readMetrics, parseJunit } from './parsers'
import {
  evaluatePriceObservationGroup,
  evaluatePriceObservations,
  groupCommandsByKey,
  toObservation,
  type PriceCommandObservation,
} from './price-evaluation'
import { buildTierPriceCommands } from './price-commands'
import { buildPriceReportData, buildTestReportData, type BudgetPreflightSummary } from './reports'
import { formatTimedOutputPrefix, normalizeRepoPath, parseCommandEstimatedTotal } from './utils'
import { applyModelConfigCalibrations } from './model-calibration'

const formatCents = (cents: number): string => `${cents.toFixed(4)}¢`

const PRICE_CONCURRENCY = 16

const runWithConcurrency = async <T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T, index: number) => Promise<R>
): Promise<R[]> => {
  const results = new Array<R>(items.length)
  let nextIndex = 0

  const worker = async (): Promise<void> => {
    while (nextIndex < items.length) {
      const index = nextIndex++
      results[index] = await fn(items[index] as T, index)
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, () => worker()))
  return results
}

type ExecutedPriceCommand = {
  commandText: string
  stdout: string
  stderr: string
  exitCode: number
  durationMs: number
  parsedCost: number | null
}

type BudgetPreflightResult = {
  summary: BudgetPreflightSummary
  skipKeys: string[]
}

type StreamLabel = 'STDOUT' | 'STDERR'

const originalConsole = {
  log: console.log.bind(console),
  warn: console.warn.bind(console),
  error: console.error.bind(console),
}

let timestampConsoleInstalled = false
let timestampConsoleStartedAtMs = 0

const installTimestampedConsole = (startedAtMs: number): void => {
  timestampConsoleStartedAtMs = startedAtMs
  if (timestampConsoleInstalled) {
    return
  }

  timestampConsoleInstalled = true

  for (const method of ['log', 'warn', 'error'] as const) {
    const original = originalConsole[method]
    console[method] = ((...args: unknown[]) => {
      const prefix = formatTimedOutputPrefix(Date.now(), timestampConsoleStartedAtMs)
      if (args.length === 0) {
        original(prefix)
        return
      }
      if (typeof args[0] === 'string') {
        original(`${prefix} ${args[0]}`, ...args.slice(1))
        return
      }
      original(prefix, ...args)
    }) as typeof console[typeof method]
  }
}

const writeCommandMetric = async (artifacts: TestRunArtifacts, record: Record<string, unknown>): Promise<void> => {
  try {
    await appendFile(artifacts.metricsLogPath, `${JSON.stringify(record)}\n`)
  } catch {
  }
}

const executePriceCommand = async (
  entry: ApiCheapPriceCommand,
  artifacts: TestRunArtifacts,
  logLabel: string
): Promise<ExecutedPriceCommand> => {
  const start = Date.now()
  const commandText = `bun --env-file=.env ${entry.args.join(' ')}`
  const proc = Bun.spawn(['bun', '--env-file=.env', ...entry.args], {
    env: { ...process.env, FORCE_COLOR: '1' },
    stdout: 'pipe',
    stderr: 'pipe',
  })

  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited
  ])

  const durationMs = Date.now() - start
  const parsedCost = parseCommandEstimatedTotal(`${stdout}\n${stderr}`)

  await appendCommandLog(
    artifacts,
    `\n=== ${logLabel} ${entry.name} ===\ncmd: ${commandText}\nexit: ${exitCode}\nstdout:\n${stdout}\nstderr:\n${stderr}\n`
  )

  await writeCommandMetric(artifacts, {
    kind: 'command_metric',
    at: new Date().toISOString(),
    source: 'runCommand',
    command: commandText,
    args: entry.args,
    exitCode,
    durationMs,
    outputDir: null,
    callerFile: null,
    callerLine: null,
    callerColumn: null,
  })

  return {
    commandText,
    stdout,
    stderr,
    exitCode,
    durationMs,
    parsedCost,
  }
}

const getTier = (file: string): Tier => {
  for (const [prefix, tier] of TIER_RULES) {
    if (file.startsWith(prefix)) return tier
  }
  return 'smoke'
}

const matchPathFilters = (file: string, pathFilters: string[]): boolean => {
  return pathFilters.some(pathFilter => {
    const prefix = pathFilter.endsWith('/') ? pathFilter : `${pathFilter}/`
    return file.startsWith(prefix) || file === pathFilter || file.startsWith(pathFilter)
  })
}

const PRICE_FILTER_STOPWORDS = new Set(['step', 'e2e', 'gen', 'test', 'cases', 'models', 'subcommand', 'services'])

const extractFilterKeywords = (pathFilter: string): string[] => {
  const segments = pathFilter.replace(/\/$/, '').split('/')
  const keywords = new Set<string>()
  for (const segment of segments) {
    const stem = segment.replace(/\.test\.ts$/, '')
    for (const part of stem.split('-')) {
      if (part.length > 0 && !PRICE_FILTER_STOPWORDS.has(part) && !/^\d+$/.test(part)) {
        keywords.add(part)
      }
    }
  }
  return [...keywords]
}

const filterCommandsByPaths = (
  commands: ApiCheapPriceCommand[],
  pathFilters: string[]
): ApiCheapPriceCommand[] => {
  const keywordSets = pathFilters.map(extractFilterKeywords).filter(ks => ks.length > 0)
  if (keywordSets.length === 0) return commands
  return commands.filter(cmd =>
    keywordSets.some(keywords => keywords.every(keyword => cmd.name.includes(keyword)))
  )
}

const resolvePriceTierSelection = (args: RunnerArgs, allFiles: string[]): Set<Tier> => {
  if (args.selectedTiers && args.selectedTiers.size > 0) {
    return new Set(args.selectedTiers)
  }

  if (args.pathFilters.length > 0) {
    const pathFilteredFiles = allFiles.filter(file => matchPathFilters(file, args.pathFilters))
    if (pathFilteredFiles.length === 0) {
      throw new Error(`No tests matched path filters: ${args.pathFilters.join(', ')}`)
    }
    return new Set(pathFilteredFiles.map(getTier))
  }

  return new Set(ALL_TIERS)
}

const resolveSuitePriceCommands = (
  args: RunnerArgs,
  allFiles: string[]
): { suiteName: string, commands: ApiCheapPriceCommand[] } => {
  const tiers = Array.from(resolvePriceTierSelection(args, allFiles))
  const orderedTiers = ALL_TIERS.filter(tier => tiers.includes(tier))
  let commands = dedupePriceCommands(orderedTiers.flatMap(tier => buildTierPriceCommands(tier)))
  let suiteName = orderedTiers.length === ALL_TIERS.length ? 'All tiers' : `Tier ${orderedTiers.join('+')}`

  if (args.pathFilters.length > 0) {
    commands = filterCommandsByPaths(commands, args.pathFilters)
    const filterLabels = args.pathFilters.map(f =>
      f.replace(/\/$/, '').split('/').pop()?.replace(/\.test\.ts$/, '') ?? f
    )
    suiteName = filterLabels.join(', ')
  }

  return { suiteName, commands }
}

const buildEmptyBudgetSummary = (suiteName: string, budgetCents: number): BudgetPreflightSummary => {
  return {
    suiteName,
    budgetCents,
    commandsChecked: 0,
    commandsRunnable: 0,
    commandsSkipped: 0,
    commandsFailed: 0,
    runnableEstimatedCostCents: 0,
    skipKeys: [],
    skippedEntries: [],
  }
}

const logPriceCommandFailure = (executed: ExecutedPriceCommand, message: string): void => {
  console.error(message)

  const stdoutTail = executed.stdout.split('\n').slice(-20).join('\n')
  const stderrTail = executed.stderr.split('\n').slice(-20).join('\n')
  if (stdoutTail.trim().length > 0) {
    console.error(`  stdout tail:\n${stdoutTail}`)
  }
  if (stderrTail.trim().length > 0) {
    console.error(`  stderr tail:\n${stderrTail}`)
  }
}

const forwardSpawnOutput = async (
  stream: ReadableStream,
  label: StreamLabel,
  artifacts: TestRunArtifacts
): Promise<void> => {
  const reader = stream.getReader()
  const decoder = new TextDecoder()
  const writer = label === 'STDOUT' ? process.stdout : process.stderr
  let buffered = ''

  const flushLine = async (line: string): Promise<void> => {
    if (line.length === 0) {
      return
    }

    const prefix = formatTimedOutputPrefix(Date.now(), artifacts.startedAtMs)
    writer.write(`${prefix} ${line}`)
    await appendRunnerLog(artifacts, `${prefix} [${label}] ${line}`)
  }

  const flushBuffered = async (force: boolean): Promise<void> => {
    while (true) {
      const newlineIndex = buffered.indexOf('\n')
      if (newlineIndex === -1) {
        break
      }

      const line = buffered.slice(0, newlineIndex + 1)
      buffered = buffered.slice(newlineIndex + 1)
      await flushLine(line)
    }

    if (force && buffered.length > 0) {
      await flushLine(buffered)
      buffered = ''
    }
  }

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buffered += decoder.decode(value, { stream: true })
      await flushBuffered(false)
    }

    const tail = decoder.decode()
    if (tail.length > 0) {
      buffered += tail
    }

    await flushBuffered(true)
  } finally {
    reader.releaseLock()
  }
}

const buildExcludedPaths = (args: RunnerArgs, allFiles: string[]): Set<string> => {
  const excludedPaths = new Set<string>()

  if (args.selectedTiers) {
    for (const file of allFiles) {
      if (!args.selectedTiers.has(getTier(file))) {
        excludedPaths.add(file)
      }
    }
  }

  return excludedPaths
}

const runBunTest = async (
  files: string[],
  artifacts: TestRunArtifacts,
  passthroughArgs: string[],
  cleanupAfterRun: boolean,
  extraArgs: string[] = [],
  envOverrides: Record<string, string> = {}
): Promise<number> => {
  const args = [
    'test',
    '--timeout',
    '900000',
    ...passthroughArgs,
    '--reporter',
    'junit',
    '--reporter-outfile',
    artifacts.junitPath,
    ...extraArgs,
    ...files,
  ]

  await appendRunnerLog(artifacts, `\n=== START bun ${args.join(' ')} ===\n`)

  const childEnv: Record<string, string> = {}
  for (const [key, value] of Object.entries(process.env)) {
    if (typeof value === 'string') {
      childEnv[key] = value
    }
  }
  childEnv['FORCE_COLOR'] = '1'
  childEnv['AUTOSHOW_TEST_ARTIFACTS_DIR'] = artifacts.runDir
  childEnv['AUTOSHOW_TEST_COMMAND_LOG'] = artifacts.commandLogPath
  childEnv['AUTOSHOW_TEST_METRICS_LOG'] = artifacts.metricsLogPath
  for (const [key, value] of Object.entries(envOverrides)) {
    childEnv[key] = value
  }
  if (cleanupAfterRun) {
    childEnv['AUTOSHOW_TEST_PRESERVE_ARTIFACTS'] = '0'
  }

  const proc = Bun.spawn(['bun', ...args], {
    env: childEnv,
    stdout: 'pipe',
    stderr: 'pipe',
  })

  const [exitCode] = await Promise.all([
    proc.exited,
    forwardSpawnOutput(proc.stdout, 'STDOUT', artifacts),
    forwardSpawnOutput(proc.stderr, 'STDERR', artifacts),
  ])

  await appendRunnerLog(artifacts, `\n=== END bun ${args.join(' ')} (exit=${exitCode}) ===\n`)
  return exitCode
}

const runPriceSuite = async (
  suiteName: string,
  commands: ApiCheapPriceCommand[],
  artifacts: TestRunArtifacts,
  budgetCents?: number
): Promise<{ exitCode: number, results: PriceCommandResult[], budgetSummary: BudgetPreflightSummary | undefined }> => {
  if (commands.length === 0) {
    console.error(`No ${suiteName} pricing commands resolved`)
    return {
      exitCode: 1,
      results: [],
      budgetSummary: budgetCents !== undefined ? buildEmptyBudgetSummary(suiteName, budgetCents) : undefined,
    }
  }

  console.log(`Running ${suiteName} pricing preflight across ${commands.length} command(s)`)
  if (budgetCents !== undefined) {
    console.log(`Budget filter (per test key): ${formatCents(budgetCents)}`)
  }

  const executedResults = await runWithConcurrency(commands, PRICE_CONCURRENCY, async (entry, _index) => {
    const executed = await executePriceCommand(entry, artifacts, 'PRICE COMMAND')
    const observation = toObservation(entry, executed)
    return { entry, executed, observation }
  })

  const observations: PriceCommandObservation[] = []
  for (const [index, { entry, executed, observation }] of executedResults.entries()) {
    observations.push(observation)
    console.log(`[${index + 1}/${commands.length}] ${entry.name}`)
    if (observation.failureMessage !== null) {
      logPriceCommandFailure(executed, `  FAIL exit=${executed.exitCode}`)
    } else {
      console.log(`  cost: ${formatCents(observation.costCents as number)}`)
    }
  }

  const evaluation = evaluatePriceObservations(suiteName, observations, budgetCents)
  const skippedCommands = evaluation.commandResults.filter(result => result.status === 'skipped').length

  console.log('')
  console.log(`${suiteName} Pricing Summary`)
  console.log('------------------------------------------------------------')
  console.log(`Commands checked: ${commands.length}`)
  console.log(`Commands failed: ${evaluation.failedCommands}`)
  if (evaluation.budgetSummary) {
    console.log(`Test keys checked: ${evaluation.budgetSummary.commandsChecked}`)
    console.log(`Test keys runnable: ${evaluation.budgetSummary.commandsRunnable}`)
    console.log(`Test keys skipped: ${evaluation.budgetSummary.commandsSkipped}`)
    console.log(`Commands skipped (over-budget keys): ${skippedCommands}`)
    console.log(`Price report included estimated cost: ${formatCents(evaluation.totalEstimatedCostCents)}`)
    console.log(`Budget runnable estimate (max variant per key): ${formatCents(evaluation.budgetSummary.runnableEstimatedCostCents)}`)
    if (evaluation.budgetSummary.skipKeys.length > 0) {
      console.log('')
      console.log(`Skipped test key list (${evaluation.budgetSummary.skipKeys.length}):`)
      for (const entry of evaluation.budgetSummary.skippedEntries) {
        console.log(`- ${entry.key} (${formatCents(entry.selectedCostCents)})`)
      }
    }
  } else {
    console.log(`Suite total estimated cost: ${formatCents(evaluation.totalEstimatedCostCents)}`)
  }

  return {
    exitCode: evaluation.failedCommands > 0 ? 1 : 0,
    results: evaluation.commandResults,
    budgetSummary: evaluation.budgetSummary,
  }
}

const runBudgetPreflight = async (
  suiteName: string,
  commands: ApiCheapPriceCommand[],
  budgetCents: number,
  artifacts: TestRunArtifacts
): Promise<BudgetPreflightResult> => {
  const groupedCommands = groupCommandsByKey(commands)

  if (groupedCommands.length === 0) {
    return {
      summary: buildEmptyBudgetSummary(suiteName, budgetCents),
      skipKeys: [],
    }
  }

  console.log(`Running ${suiteName} budget preflight across ${groupedCommands.length} test key(s) (${commands.length} command variant(s))`)
  console.log(`Budget: ${formatCents(budgetCents)}`)

  // Execute all commands concurrently, preserving group/variant structure
  const allVariants = groupedCommands.flatMap((group, groupIndex) =>
    group.variants.map((entry, variantIndex) => ({ entry, groupIndex, variantIndex }))
  )

  const executedVariants = await runWithConcurrency(allVariants, PRICE_CONCURRENCY, async (item) => {
    const executed = await executePriceCommand(item.entry, artifacts, 'BUDGET PREFLIGHT COMMAND')
    const observation = toObservation(item.entry, executed)
    return { ...item, executed, observation }
  })

  // Rebuild per-group results and log in original order
  const groupResults = new Map<number, { executed: ExecutedPriceCommand, observation: PriceCommandObservation, variantIndex: number }[]>()
  for (const result of executedVariants) {
    let list = groupResults.get(result.groupIndex)
    if (!list) {
      list = []
      groupResults.set(result.groupIndex, list)
    }
    list.push(result)
  }

  const observations: PriceCommandObservation[] = []

  for (const [index, group] of groupedCommands.entries()) {
    console.log(`[${index + 1}/${groupedCommands.length}] ${group.key}`)

    const variants = groupResults.get(index) ?? []
    variants.sort((a, b) => a.variantIndex - b.variantIndex)

    const groupObservations: PriceCommandObservation[] = []
    for (const { executed, observation, variantIndex } of variants) {
      observations.push(observation)
      groupObservations.push(observation)

      if (observation.failureMessage !== null) {
        logPriceCommandFailure(
          executed,
          `  variant ${variantIndex + 1}/${group.variants.length}: FAIL exit=${executed.exitCode} (could not resolve numeric estimate)`
        )
        continue
      }

      const variantCost = observation.costCents as number
      if (group.variants.length > 1) {
        console.log(`  variant ${variantIndex + 1}/${group.variants.length}: ${formatCents(variantCost)}`)
      }
    }

    const groupEvaluation = evaluatePriceObservationGroup(group.key, groupObservations, budgetCents)
    if (groupEvaluation.variantCostsCents.length === 0 || groupEvaluation.selectedCostCents === null) {
      continue
    }

    if (groupEvaluation.variantCount > 1) {
      console.log(`  selected cost (max variant): ${formatCents(groupEvaluation.selectedCostCents)}`)
    }
    console.log(`  decision: ${groupEvaluation.overBudget ? 'SKIP (over budget)' : 'RUN'}`)
  }

  const evaluation = evaluatePriceObservations(suiteName, observations, budgetCents)
  const budgetSummary = evaluation.budgetSummary ?? buildEmptyBudgetSummary(suiteName, budgetCents)

  console.log('')
  console.log(`${suiteName} Budget Preflight Summary`)
  console.log('------------------------------------------------------------')
  console.log(`Test keys checked: ${budgetSummary.commandsChecked}`)
  console.log(`Command variants checked: ${commands.length}`)
  console.log(`Commands runnable: ${budgetSummary.commandsRunnable}`)
  console.log(`Commands skipped: ${budgetSummary.commandsSkipped}`)
  console.log(`Commands failed: ${budgetSummary.commandsFailed}`)
  console.log(`Runnable estimated cost: ${formatCents(budgetSummary.runnableEstimatedCostCents)}`)

  if (budgetSummary.skipKeys.length > 0) {
    console.log('')
    console.log(`Skipped command list (${budgetSummary.skipKeys.length}):`)
    for (const entry of budgetSummary.skippedEntries) {
      console.log(`- ${entry.key} (${formatCents(entry.selectedCostCents)})`)
    }
  }

  if (budgetSummary.commandsFailed > 0) {
    throw new Error(`Budget preflight failed for ${budgetSummary.commandsFailed} command(s); cannot continue with --budget`)
  }

  return {
    summary: budgetSummary,
    skipKeys: budgetSummary.skipKeys,
  }
}

const runStandardTestMode = async (
  args: RunnerArgs,
  allFiles: string[],
  excludedPaths: Set<string>,
  artifacts: TestRunArtifacts,
  argv: string[]
): Promise<number> => {
  let filesToRun: string[]

  if (args.pathFilters.length > 0) {
    filesToRun = allFiles.filter(file => matchPathFilters(file, args.pathFilters))
    if (filesToRun.length === 0) {
      throw new Error(`No tests matched path filters: ${args.pathFilters.join(', ')}`)
    }
  } else {
    filesToRun = allFiles.filter(file => !excludedPaths.has(file))
    if (args.selectedTiers) {
      const tierCounts: Record<string, number> = {}
      for (const file of filesToRun) {
        const tier = getTier(file)
        tierCounts[tier] = (tierCounts[tier] || 0) + 1
      }
      const summary = Object.entries(tierCounts).map(([tier, count]) => `${tier}:${count}`).join(', ')
      console.log(`Running ${filesToRun.length} tests (${summary})`)
    }
  }

  let budgetSummary: BudgetPreflightSummary | undefined
  let budgetSkipKeys: string[] = []
  if (args.budgetCents !== undefined) {
    const resolved = resolveSuitePriceCommands(args, allFiles)
    if (resolved.commands.length === 0) {
      console.log('No pricing commands resolved for --budget preflight; proceeding without budget-based skips')
      budgetSummary = buildEmptyBudgetSummary(resolved.suiteName, args.budgetCents)
    } else {
      const preflight = await runBudgetPreflight(resolved.suiteName, resolved.commands, args.budgetCents, artifacts)
      budgetSummary = preflight.summary
      budgetSkipKeys = preflight.skipKeys
    }
  }

  const budgetEnvOverrides: Record<string, string> = {}
  if (args.budgetCents !== undefined) {
    budgetEnvOverrides['AUTOSHOW_TEST_BUDGET_CENTS'] = String(args.budgetCents)
    budgetEnvOverrides['AUTOSHOW_TEST_BUDGET_SKIP_KEYS'] = JSON.stringify(budgetSkipKeys)
  }

  const exitCode = await runBunTest(
    filesToRun,
    artifacts,
    args.passthroughArgs,
    args.cleanupAfterRun,
    [],
    budgetEnvOverrides
  )

  const junitCases = await parseJunit(artifacts.junitPath)
  const metrics = await readMetrics(artifacts.metricsLogPath)

  const endedAtIso = new Date().toISOString()
  const endedAtMs = Date.now()
  const reportData = await buildTestReportData(junitCases, metrics, artifacts, endedAtIso, endedAtMs, argv.slice(2), budgetSummary)
  await writeReportJson(artifacts, reportData)
  if (typeof reportData['e2e'] === 'object' && reportData['e2e'] !== null) {
    await writeJsonFile(artifacts.e2eReportJsonPath, reportData['e2e'] as Record<string, unknown>)
  }
  const calibrationReport = await applyModelConfigCalibrations(artifacts.rootDir)
  await writeJsonFile(artifacts.calibrationReportJsonPath, calibrationReport as unknown as Record<string, unknown>)
  console.log(`Model calibration report: ${normalizeRepoPath(artifacts.calibrationReportJsonPath)}`)
  if (calibrationReport.updatedModels > 0) {
    console.log(`Auto-calibration updated ${calibrationReport.updatedModels} model entr${calibrationReport.updatedModels === 1 ? 'y' : 'ies'}`)
  }

  return exitCode
}

const runPriceMode = async (
  args: RunnerArgs,
  allFiles: string[],
  artifacts: TestRunArtifacts,
  argv: string[]
): Promise<number> => {
  let suiteName = 'All tiers'
  let results: PriceCommandResult[] = []
  let budgetSummary: BudgetPreflightSummary | undefined
  let exitCode = 0

  const resolved = resolveSuitePriceCommands(args, allFiles)
  suiteName = resolved.suiteName

  if (resolved.commands.length === 0) {
    console.error('No pricing commands resolved for the selected suite(s)')
    exitCode = 1
    results = []
    budgetSummary = args.budgetCents !== undefined ? buildEmptyBudgetSummary(suiteName, args.budgetCents) : undefined
  } else {
    const suiteResult = await runPriceSuite(suiteName, resolved.commands, artifacts, args.budgetCents)
    results = suiteResult.results
    budgetSummary = suiteResult.budgetSummary
    exitCode = suiteResult.exitCode
  }

  const endedAtIso = new Date().toISOString()
  const endedAtMs = Date.now()
  const reportData = buildPriceReportData(results, suiteName, artifacts, endedAtIso, endedAtMs, argv.slice(2), budgetSummary)
  await writeReportJson(artifacts, reportData)

  return exitCode
}

const runPreflight = async (): Promise<void> => {
  const envFile = process.env['ENV_FILE'] || '.env'
  const cliEntry = 'src/cli/create-cli.ts'

  // Step 1: run setup --step sample (tool verification)
  const setupProc = Bun.spawn(
    ['bun', `--env-file=${envFile}`, cliEntry, 'setup', '--step', 'sample'],
    { stdout: 'inherit', stderr: 'inherit' }
  )
  const setupExit = await setupProc.exited
  if (setupExit !== 0) {
    // Tools missing — run full setup to install them, then retry
    console.log('Preflight: setup --step sample failed; running full setup to install dependencies...')
    const fullSetupProc = Bun.spawn(
      ['bun', `--env-file=${envFile}`, cliEntry, 'setup'],
      { stdout: 'inherit', stderr: 'inherit' }
    )
    const fullSetupExit = await fullSetupProc.exited
    if (fullSetupExit !== 0) {
      throw new Error(`Preflight: full setup failed with exit code ${fullSetupExit}`)
    }
    const retryProc = Bun.spawn(
      ['bun', `--env-file=${envFile}`, cliEntry, 'setup', '--step', 'sample'],
      { stdout: 'inherit', stderr: 'inherit' }
    )
    const retryExit = await retryProc.exited
    if (retryExit !== 0) {
      throw new Error(`Preflight: setup --step sample failed with exit code ${retryExit} after full setup`)
    }
  }

  // Step 2: run sample --out input/samples
  const sampleVerifyProc = Bun.spawn(
    ['bun', `--env-file=${envFile}`, cliEntry, 'sample', '--out', 'input/samples', '--verify-only'],
    { stdout: 'inherit', stderr: 'inherit' }
  )
  const sampleVerifyExit = await sampleVerifyProc.exited
  if (sampleVerifyExit === 0) {
    console.log('Preflight: existing sample fixtures verified, skipping regeneration')
    return
  }

  // Step 3: generate sample fixtures when verify-only cannot reuse the existing manifest
  const sampleProc = Bun.spawn(
    ['bun', `--env-file=${envFile}`, cliEntry, 'sample', '--out', 'input/samples'],
    { stdout: 'inherit', stderr: 'inherit' }
  )
  const sampleExit = await sampleProc.exited
  if (sampleExit !== 0) {
    throw new Error(`Preflight: sample generation failed with exit code ${sampleExit}`)
  }
}

export const runTestRunner = async (argv: string[]): Promise<number> => {
  const args = parseRunnerArgs(argv)
  const glob = new Bun.Glob('test/test-cases/**/*.test.ts')
  const allFiles = (await Array.fromAsync(glob.scan({ dot: false }))).sort()
  const excludedPaths = buildExcludedPaths(args, allFiles)

  const artifacts = await createRunArtifacts()
  installTimestampedConsole(artifacts.startedAtMs)
  console.log(`Test run artifacts: ${normalizeRepoPath(artifacts.runDir)}`)

  await appendRunnerLog(
    artifacts,
    `Run ID: ${artifacts.runId}\nStarted: ${artifacts.startedAtIso}\nArgs: ${argv.slice(2).join(' ')}\n`
  )

  // Preflight: generate sample fixtures before running tests
  await runPreflight()

  let exitCode = 0
  try {
    exitCode = args.priceMode
      ? await runPriceMode(args, allFiles, artifacts, argv)
      : await runStandardTestMode(args, allFiles, excludedPaths, artifacts, argv)
  } catch (error) {
    exitCode = 1
    const endedAtIso = new Date().toISOString()
    const endedAtMs = Date.now()
    const fallbackReport = {
      run: {
        id: artifacts.runId,
        mode: args.priceMode ? 'price' : 'test',
        startedAt: artifacts.startedAtIso,
        endedAt: endedAtIso,
        durationMs: Math.max(0, endedAtMs - artifacts.startedAtMs),
        argv: argv.slice(2),
        artifactDir: normalizeRepoPath(artifacts.runDir),
        ...(args.budgetCents !== undefined
          ? {
              budgetCents: args.budgetCents,
              budgetPreflightSuite: 'unknown',
              budgetPreflightChecked: 0,
              budgetPreflightRunnable: 0,
              budgetPreflightSkipped: 0,
              budgetPreflightFailed: 0,
              budgetRunnableEstimatedCostCents: 0,
              budgetSkipKeys: [] as string[],
              budgetSkippedEntries: [] as { key: string, selectedCostCents: number }[],
            }
          : {}),
      },
      summary: {
        total: 0,
        passed: 0,
        failed: 1,
        skipped: 0,
      },
      error: error instanceof Error ? error.message : String(error)
    }
    await writeReportJson(artifacts, fallbackReport)

    console.error(error)
  }

  if (args.cleanupAfterRun && exitCode === 0) {
    await rm(artifacts.runDir, { recursive: true, force: true })
    console.log('Run artifacts cleaned up because --cleanup was provided')
  } else {
    console.log(`Report JSON: ${normalizeRepoPath(artifacts.reportJsonPath)}`)
    if (!args.priceMode) {
      console.log(`E2E Report JSON: ${normalizeRepoPath(artifacts.e2eReportJsonPath)}`)
      console.log(`Model Calibration JSON: ${normalizeRepoPath(artifacts.calibrationReportJsonPath)}`)
    }
  }

  return exitCode
}
