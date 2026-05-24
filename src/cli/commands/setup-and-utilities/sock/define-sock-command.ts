import { constants } from 'node:fs'
import { access, mkdir, stat } from 'node:fs/promises'
import { basename, dirname, isAbsolute, join, relative, resolve } from 'node:path'
import { defineCliCommand } from '~/cli/native'
import type { CliFlagsDefinition } from '~/cli/native'
import { loadEnvFile } from '~/utils/cli-utils'
import { CLIUsageError } from '~/utils/error-handler'
import * as l from '~/utils/logger'

const DEPENDENCY_SECTIONS = ['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies'] as const
const DEFAULT_SOCKET_BIN = 'socket'
const DEFAULT_MAX_DEEP = 10

type DependencySection = typeof DEPENDENCY_SECTIONS[number]
type SocketStepStatus = 'completed' | 'failed' | 'skipped'

type DirectDependency = {
  name: string
  spec: string
  section: DependencySection
  packageSpecifier: string
}

type DependencyInventory = {
  packageName: string | null
  packageVersion: string | null
  packageJsonPath: string
  dependencies: DirectDependency[]
}

type TargetResolution = {
  rawTarget: string
  targetPath: string
  projectRoot: string
  packageJsonPath: string
}

type TokenResolution = {
  present: boolean
  source: 'none' | 'SOCKET_SECURITY_API_TOKEN' | 'SOCKET_CLI_API_TOKEN' | 'both'
  env: Record<string, string>
}

type RawSocketCommandResult = {
  id: string
  label: string
  args: string[]
  cwd: string
  status: Exclude<SocketStepStatus, 'skipped'>
  exitCode: number | null
  stdoutFile: string
  stderrFile: string
  jsonFile?: string
  parseError?: string
  error?: string
}

type SocketStepResult = {
  id: string
  label: string
  status: SocketStepStatus
  reason?: string
  commands?: RawSocketCommandResult[]
}

type SockRunOptions = {
  socketBin: string
  out: string
  explicitOut: boolean
  skipScan: boolean
  skipFix: boolean
  skipPackageScores: boolean
  maxDeep: number
  minimumReleaseAge: string | null
  noMajorUpdates: boolean
}

type SockReport = {
  generatedAt: string
  target: TargetResolution
  reportDir: string
  socketBin: string
  token: Omit<TokenResolution, 'env'>
  options: {
    skipScan: boolean
    skipFix: boolean
    skipPackageScores: boolean
    maxDeep: number
    minimumReleaseAge: string | null
    noMajorUpdates: boolean
  }
  inventory: DependencyInventory
  steps: SocketStepResult[]
  files: {
    summaryMarkdown: string
    summaryJson: string
    dependencyInventory: string
    rawDir: string
  }
}

const sockParameters = [
  { key: '[target]', description: 'Project directory or package.json to analyze (default: current directory)' }
] as const

const sockFlags = {
  'socket-bin': {
    description: 'Socket CLI binary to execute (default: socket)',
    type: String,
    default: DEFAULT_SOCKET_BIN
  },
  out: {
    description: 'Report output directory (default: project/reports/socket/<timestamp>_sock)',
    type: String,
    default: 'project/reports/socket/<timestamp>_sock'
  },
  'skip-scan': {
    description: 'Skip Socket full project scan creation',
    type: Boolean,
    default: false,
    negatable: false
  },
  'skip-fix': {
    description: 'Skip recommendation-only Socket Fix analysis',
    type: Boolean,
    default: false,
    negatable: false
  },
  'skip-package-scores': {
    description: 'Skip Socket package shallow and deep score lookups',
    type: Boolean,
    default: false,
    negatable: false
  },
  'max-deep': {
    description: 'Maximum number of direct dependencies to score with socket package deep (default: 10)',
    type: String,
    default: String(DEFAULT_MAX_DEEP)
  },
  'minimum-release-age': {
    description: 'Pass a minimum release age duration to Socket Fix recommendations',
    type: String
  },
  'no-major-updates': {
    description: 'Ask Socket Fix to avoid major-version upgrade recommendations',
    type: Boolean,
    default: false,
    negatable: false
  },
  'token-help': {
    description: 'Print minimal Socket API token scope guidance and exit',
    type: Boolean,
    default: false,
    negatable: false
  }
} as const satisfies CliFlagsDefinition

export const SOCKET_TOKEN_HELP = `Socket API token guidance for bun as sock

Do not select all scopes.

For this read-only report, create a Socket API token with only these scopes:
- packages:list - package score and Socket Fix metadata
- full-scans:create - project scan creation and Socket Fix analysis
- full-scans:list - scan report retrieval
- security-policy:read - policy report evaluation

Optional future scope:
- license-policy:read - only if a future --license report mode is added

Not needed for v1:
- API token management scopes
- audit log scopes
- repository create, update, or delete scopes
- policy update scopes
- webhook scopes
- integration scopes
- triage update scopes
- threat-feed scopes
- telemetry scopes
- wrapper scopes
- historical trend scopes

Set either SOCKET_SECURITY_API_TOKEN or SOCKET_CLI_API_TOKEN. If only one is set, bun as sock passes it to Socket under both names for compatibility with Socket docs and examples.
`

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const formatUnknownError = (error: unknown): string =>
  error instanceof Error ? error.message : String(error)

const formatTimestamp = (date = new Date()): string =>
  date.toISOString().replace(/\.\d{3}Z$/, 'Z').replace(/[:.]/g, '-')

const defaultReportDir = (): string =>
  join('project', 'reports', 'socket', `${formatTimestamp()}_sock`)

const sanitizeFilePart = (value: string): string =>
  value
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 100) || 'socket'

const readStreamText = async (stream: ReadableStream<Uint8Array> | null): Promise<string> =>
  stream ? await new Response(stream).text() : ''

const fileExists = async (path: string): Promise<boolean> => {
  try {
    await stat(path)
    return true
  } catch {
    return false
  }
}

const hasExecutableAccess = async (path: string): Promise<boolean> => {
  try {
    await access(path, constants.X_OK)
    return true
  } catch {
    return false
  }
}

const isPathLikeCommand = (command: string): boolean =>
  isAbsolute(command) || command.includes('/') || command.includes('\\')

const resolveSocketBinary = async (socketBin: string): Promise<string | null> => {
  const trimmed = socketBin.trim()
  if (trimmed.length === 0) {
    return null
  }

  if (isPathLikeCommand(trimmed)) {
    const path = isAbsolute(trimmed) ? trimmed : resolve(process.cwd(), trimmed)
    return await hasExecutableAccess(path) ? path : null
  }

  return Bun.which(trimmed)
}

const parseMaxDeep = (value: unknown): number => {
  const raw = typeof value === 'string' ? value.trim() : String(value ?? '')
  const parsed = Number.parseInt(raw, 10)
  if (!Number.isFinite(parsed) || parsed < 0 || String(parsed) !== raw) {
    throw CLIUsageError(`Invalid --max-deep value "${raw}". Expected an integer >= 0.`)
  }
  return parsed
}

const getStringFlag = (value: unknown): string | null => {
  if (typeof value !== 'string') {
    return null
  }
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

const resolveRunOptions = (flags: Record<string, unknown>, explicitFlags: Set<string>): SockRunOptions => ({
  socketBin: getStringFlag(flags['socket-bin']) ?? DEFAULT_SOCKET_BIN,
  out: getStringFlag(flags['out']) ?? defaultReportDir(),
  explicitOut: explicitFlags.has('out'),
  skipScan: flags['skip-scan'] === true,
  skipFix: flags['skip-fix'] === true,
  skipPackageScores: flags['skip-package-scores'] === true,
  maxDeep: parseMaxDeep(flags['max-deep']),
  minimumReleaseAge: getStringFlag(flags['minimum-release-age']),
  noMajorUpdates: flags['no-major-updates'] === true
})

const resolveReportDir = (opts: SockRunOptions): string =>
  resolve(process.cwd(), opts.explicitOut ? opts.out : defaultReportDir())

const resolveTarget = async (target: string | undefined): Promise<TargetResolution> => {
  const rawTarget = target?.trim() || '.'
  const targetPath = resolve(process.cwd(), rawTarget)

  let targetStat: Awaited<ReturnType<typeof stat>>
  try {
    targetStat = await stat(targetPath)
  } catch {
    throw CLIUsageError(`sock target not found: ${rawTarget}`)
  }

  if (targetStat.isDirectory()) {
    const packageJsonPath = join(targetPath, 'package.json')
    if (!await fileExists(packageJsonPath)) {
      throw CLIUsageError(`package.json not found for sock target: ${rawTarget}`)
    }
    return {
      rawTarget,
      targetPath,
      projectRoot: targetPath,
      packageJsonPath
    }
  }

  if (targetStat.isFile() && basename(targetPath) === 'package.json') {
    return {
      rawTarget,
      targetPath,
      projectRoot: dirname(targetPath),
      packageJsonPath: targetPath
    }
  }

  throw CLIUsageError(`sock target must be a directory containing package.json or a package.json file: ${rawTarget}`)
}

const readDependencyInventory = async (packageJsonPath: string): Promise<DependencyInventory> => {
  let parsed: unknown
  try {
    parsed = JSON.parse(await Bun.file(packageJsonPath).text())
  } catch (error) {
    throw CLIUsageError(`Failed to read package.json for sock target: ${formatUnknownError(error)}`)
  }

  if (!isRecord(parsed)) {
    throw CLIUsageError('package.json must contain a JSON object')
  }

  const dependencies: DirectDependency[] = []
  for (const section of DEPENDENCY_SECTIONS) {
    const rawSection = parsed[section]
    if (rawSection === undefined) {
      continue
    }
    if (!isRecord(rawSection)) {
      throw CLIUsageError(`package.json ${section} must be an object`)
    }

    for (const [name, spec] of Object.entries(rawSection).sort(([a], [b]) => a.localeCompare(b))) {
      if (typeof spec !== 'string') {
        throw CLIUsageError(`package.json ${section}.${name} must be a string version spec`)
      }
      dependencies.push({
        name,
        spec,
        section,
        packageSpecifier: `${name}@${spec}`
      })
    }
  }

  return {
    packageName: typeof parsed['name'] === 'string' ? parsed['name'] : null,
    packageVersion: typeof parsed['version'] === 'string' ? parsed['version'] : null,
    packageJsonPath,
    dependencies
  }
}

const resolveTokenEnv = async (): Promise<TokenResolution> => {
  await loadEnvFile()

  const securityToken = process.env['SOCKET_SECURITY_API_TOKEN']?.trim() ?? ''
  const cliToken = process.env['SOCKET_CLI_API_TOKEN']?.trim() ?? ''

  if (securityToken && cliToken) {
    return {
      present: true,
      source: 'both',
      env: {
        SOCKET_SECURITY_API_TOKEN: securityToken,
        SOCKET_CLI_API_TOKEN: cliToken
      }
    }
  }

  if (securityToken) {
    return {
      present: true,
      source: 'SOCKET_SECURITY_API_TOKEN',
      env: {
        SOCKET_SECURITY_API_TOKEN: securityToken,
        SOCKET_CLI_API_TOKEN: securityToken
      }
    }
  }

  if (cliToken) {
    return {
      present: true,
      source: 'SOCKET_CLI_API_TOKEN',
      env: {
        SOCKET_SECURITY_API_TOKEN: cliToken,
        SOCKET_CLI_API_TOKEN: cliToken
      }
    }
  }

  return {
    present: false,
    source: 'none',
    env: {}
  }
}

const relativeReportPath = (reportDir: string, path: string): string =>
  relative(reportDir, path).replace(/\\/g, '/')

const parseJsonOutput = (text: string): { ok: true, value: unknown } | { ok: false, error: string } | null => {
  const trimmed = text.trim()
  if (trimmed.length === 0) {
    return null
  }

  try {
    return { ok: true, value: JSON.parse(trimmed) }
  } catch (error) {
    return { ok: false, error: formatUnknownError(error) }
  }
}

const runSocketCommand = async (
  commandIndex: number,
  id: string,
  label: string,
  socketBin: string,
  args: string[],
  cwd: string,
  rawDir: string,
  reportDir: string,
  env: Record<string, string>
): Promise<RawSocketCommandResult> => {
  const fileBase = `${String(commandIndex).padStart(3, '0')}_${sanitizeFilePart(label)}`
  const stdoutPath = join(rawDir, `${fileBase}.stdout.txt`)
  const stderrPath = join(rawDir, `${fileBase}.stderr.txt`)
  const jsonPath = join(rawDir, `${fileBase}.json`)
  let stdout = ''
  let stderr = ''
  let exitCode: number | null = null
  let spawnError: string | null = null

  try {
    const proc = Bun.spawn([socketBin, ...args], {
      cwd,
      env: {
        ...(process.env as Record<string, string | undefined>),
        ...env
      },
      stdout: 'pipe',
      stderr: 'pipe'
    })
    const [capturedStdout, capturedStderr, capturedExitCode] = await Promise.all([
      readStreamText(proc.stdout),
      readStreamText(proc.stderr),
      proc.exited
    ])
    stdout = capturedStdout
    stderr = capturedStderr
    exitCode = capturedExitCode
  } catch (error) {
    spawnError = formatUnknownError(error)
    stderr = spawnError
  }

  await Bun.write(stdoutPath, stdout)
  await Bun.write(stderrPath, stderr)

  const result: RawSocketCommandResult = {
    id,
    label,
    args,
    cwd,
    status: exitCode === 0 ? 'completed' : 'failed',
    exitCode,
    stdoutFile: relativeReportPath(reportDir, stdoutPath),
    stderrFile: relativeReportPath(reportDir, stderrPath)
  }

  const parsed = parseJsonOutput(stdout)
  if (parsed?.ok === true) {
    await Bun.write(jsonPath, `${JSON.stringify(parsed.value, null, 2)}\n`)
    result.jsonFile = relativeReportPath(reportDir, jsonPath)
  } else if (parsed?.ok === false) {
    result.parseError = parsed.error
  }

  if (spawnError) {
    result.error = spawnError
  }

  return result
}

const skippedStep = (id: string, label: string, reason: string): SocketStepResult => ({
  id,
  label,
  status: 'skipped',
  reason
})

const completedOrFailedStep = (
  id: string,
  label: string,
  commands: RawSocketCommandResult[]
): SocketStepResult => ({
  id,
  label,
  status: commands.every((command) => command.status === 'completed') ? 'completed' : 'failed',
  commands
})

const tokenRequiredSkipReason = 'Socket API token not found. Set SOCKET_SECURITY_API_TOKEN or SOCKET_CLI_API_TOKEN, or run bun as sock --token-help for scope guidance.'

const runPackageScoreSteps = async (
  inventory: DependencyInventory,
  socketBin: string,
  target: TargetResolution,
  opts: SockRunOptions,
  token: TokenResolution,
  rawDir: string,
  reportDir: string,
  commandCounter: { value: number }
): Promise<SocketStepResult> => {
  if (opts.skipPackageScores) {
    return skippedStep('package-scores', 'Socket package scores', '--skip-package-scores was set')
  }
  if (!token.present) {
    return skippedStep('package-scores', 'Socket package scores', tokenRequiredSkipReason)
  }
  if (inventory.dependencies.length === 0) {
    return skippedStep('package-scores', 'Socket package scores', 'No direct dependencies found in package.json')
  }

  const commands: RawSocketCommandResult[] = []
  for (const dependency of inventory.dependencies) {
    commands.push(await runSocketCommand(
      commandCounter.value++,
      'package-shallow',
      `package-shallow-${dependency.name}`,
      socketBin,
      ['package', 'shallow', dependency.packageSpecifier, '--json'],
      target.projectRoot,
      rawDir,
      reportDir,
      token.env
    ))
  }

  for (const dependency of inventory.dependencies.slice(0, opts.maxDeep)) {
    commands.push(await runSocketCommand(
      commandCounter.value++,
      'package-deep',
      `package-deep-${dependency.name}`,
      socketBin,
      ['package', 'deep', dependency.packageSpecifier, '--json'],
      target.projectRoot,
      rawDir,
      reportDir,
      token.env
    ))
  }

  return completedOrFailedStep('package-scores', 'Socket package scores', commands)
}

const runScanStep = async (
  socketBin: string,
  target: TargetResolution,
  opts: SockRunOptions,
  token: TokenResolution,
  rawDir: string,
  reportDir: string,
  commandCounter: { value: number }
): Promise<SocketStepResult> => {
  if (opts.skipScan) {
    return skippedStep('project-scan', 'Socket project scan', '--skip-scan was set')
  }
  if (!token.present) {
    return skippedStep('project-scan', 'Socket project scan', tokenRequiredSkipReason)
  }

  const command = await runSocketCommand(
    commandCounter.value++,
    'project-scan',
    'project-scan',
    socketBin,
    ['scan', 'create', '--report', '--tmp', '--no-interactive', '--json', target.targetPath],
    target.projectRoot,
    rawDir,
    reportDir,
    token.env
  )
  return completedOrFailedStep('project-scan', 'Socket project scan', [command])
}

const buildFixArgs = (opts: SockRunOptions): string[] => {
  const args = [
    'fix',
    '--no-apply-fixes',
    '--show-affected-direct-dependencies',
    '--json'
  ]

  if (opts.minimumReleaseAge) {
    args.push('--minimum-release-age', opts.minimumReleaseAge)
  }
  if (opts.noMajorUpdates) {
    args.push('--no-major-updates')
  }

  return args
}

const runFixStep = async (
  socketBin: string,
  target: TargetResolution,
  opts: SockRunOptions,
  token: TokenResolution,
  rawDir: string,
  reportDir: string,
  commandCounter: { value: number }
): Promise<SocketStepResult> => {
  if (opts.skipFix) {
    return skippedStep('socket-fix', 'Socket Fix recommendations', '--skip-fix was set')
  }
  if (!token.present) {
    return skippedStep('socket-fix', 'Socket Fix recommendations', tokenRequiredSkipReason)
  }

  const command = await runSocketCommand(
    commandCounter.value++,
    'socket-fix',
    'socket-fix',
    socketBin,
    buildFixArgs(opts),
    target.projectRoot,
    rawDir,
    reportDir,
    token.env
  )
  return completedOrFailedStep('socket-fix', 'Socket Fix recommendations', [command])
}

const formatDependencyCounts = (inventory: DependencyInventory): string[] =>
  DEPENDENCY_SECTIONS.map((section) => {
    const count = inventory.dependencies.filter((dependency) => dependency.section === section).length
    return `- ${section}: ${count}`
  })

const formatDependencyTable = (inventory: DependencyInventory): string[] => {
  if (inventory.dependencies.length === 0) {
    return ['No direct dependencies found.']
  }

  return [
    '| Section | Package | Version spec |',
    '| --- | --- | --- |',
    ...inventory.dependencies.map((dependency) =>
      `| ${dependency.section} | \`${dependency.name}\` | \`${dependency.spec}\` |`
    )
  ]
}

const formatStepDetail = (step: SocketStepResult): string => {
  if (step.reason) {
    return step.reason
  }

  const failed = step.commands?.filter((command) => command.status === 'failed') ?? []
  if (failed.length > 0) {
    return `${failed.length} Socket command(s) failed; inspect raw output files.`
  }

  return `${step.commands?.length ?? 0} Socket command(s) completed.`
}

const formatStepTable = (steps: SocketStepResult[]): string[] => [
  '| Step | Status | Detail |',
  '| --- | --- | --- |',
  ...steps.map((step) => `| ${step.label} | ${step.status} | ${formatStepDetail(step)} |`)
]

const formatCommandDetails = (steps: SocketStepResult[]): string[] => {
  const commands = steps.flatMap((step) => step.commands ?? [])
  if (commands.length === 0) {
    return []
  }

  return [
    '## Raw Socket Outputs',
    '',
    ...commands.flatMap((command) => [
      `- ${command.label}: ${command.status}${command.exitCode === null ? '' : ` (exit ${command.exitCode})`}`,
      `  - stdout: \`${command.stdoutFile}\``,
      `  - stderr: \`${command.stderrFile}\``,
      ...(command.jsonFile ? [`  - parsed JSON: \`${command.jsonFile}\``] : []),
      ...(command.parseError ? [`  - JSON parse error: ${command.parseError}`] : []),
      ...(command.error ? [`  - execution error: ${command.error}`] : [])
    ]),
    ''
  ]
}

const buildSummaryMarkdown = (report: SockReport): string => {
  const packageLabel = report.inventory.packageName
    ? `${report.inventory.packageName}${report.inventory.packageVersion ? `@${report.inventory.packageVersion}` : ''}`
    : '(unnamed package)'
  const failedSteps = report.steps.filter((step) => step.status === 'failed')
  const skippedSteps = report.steps.filter((step) => step.status === 'skipped')

  return `${[
    '# Socket Dependency Report',
    '',
    `Generated: ${report.generatedAt}`,
    `Target: \`${report.target.rawTarget}\``,
    `Package: \`${packageLabel}\``,
    `Package manifest: \`${report.target.packageJsonPath}\``,
    `Socket binary: \`${report.socketBin}\``,
    'Mode: read-only. Socket Fix is always invoked with `--no-apply-fixes`.',
    '',
    '## Dependency Inventory',
    '',
    ...formatDependencyCounts(report.inventory),
    '',
    ...formatDependencyTable(report.inventory),
    '',
    '## Socket Steps',
    '',
    ...formatStepTable(report.steps),
    '',
    ...formatCommandDetails(report.steps),
    '## Guidance',
    '',
    '- This command did not edit package.json, bun.lock, or any other manifest or lockfile.',
    '- Treat Socket vulnerability, health, and upgrade results as findings to review manually before changing dependencies.',
    '- Apply any upgrades manually after reviewing Socket Fix output.',
    ...(failedSteps.length > 0 ? ['- One or more Socket commands failed. Check token scopes, authentication, and raw stderr files.'] : []),
    ...(skippedSteps.some((step) => step.reason?.includes('Socket API token not found')) ? ['- Socket analysis was skipped because no token was available. Run `bun as sock --token-help` for the minimal scope list.'] : []),
    '- For token setup: do not select all scopes. Use only packages:list, full-scans:create, full-scans:list, and security-policy:read for this read-only report.'
  ].join('\n')}\n`
}

const writeReportFiles = async (
  reportDir: string,
  inventory: DependencyInventory,
  reportWithoutFiles: Omit<SockReport, 'files'>
): Promise<SockReport> => {
  const summaryMarkdownPath = join(reportDir, 'summary.md')
  const summaryJsonPath = join(reportDir, 'summary.json')
  const dependencyInventoryPath = join(reportDir, 'dependency-inventory.json')
  const rawDir = join(reportDir, 'raw')
  const files = {
    summaryMarkdown: relativeReportPath(reportDir, summaryMarkdownPath),
    summaryJson: relativeReportPath(reportDir, summaryJsonPath),
    dependencyInventory: relativeReportPath(reportDir, dependencyInventoryPath),
    rawDir: relativeReportPath(reportDir, rawDir)
  }
  const report: SockReport = {
    ...reportWithoutFiles,
    files
  }

  await Bun.write(dependencyInventoryPath, `${JSON.stringify(inventory, null, 2)}\n`)
  await Bun.write(summaryMarkdownPath, buildSummaryMarkdown(report))
  await Bun.write(summaryJsonPath, `${JSON.stringify(report, null, 2)}\n`)
  return report
}

const runSockReport = async (targetArg: string | undefined, opts: SockRunOptions): Promise<SockReport> => {
  const target = await resolveTarget(targetArg)
  const inventory = await readDependencyInventory(target.packageJsonPath)
  const reportDir = resolveReportDir(opts)
  const rawDir = join(reportDir, 'raw')
  await mkdir(rawDir, { recursive: true })

  const resolvedSocketBin = await resolveSocketBinary(opts.socketBin)
  if (!resolvedSocketBin) {
    throw CLIUsageError([
      `Socket CLI binary not found: ${opts.socketBin}`,
      'Install the Socket CLI from Socket Security documentation, ensure the `socket` executable is on PATH, or pass --socket-bin <path>.',
      'bun as sock uses an existing system Socket CLI and does not install it.'
    ].join('\n'))
  }

  const token = await resolveTokenEnv()
  const commandCounter = { value: 1 }
  const steps = [
    await runPackageScoreSteps(inventory, resolvedSocketBin, target, opts, token, rawDir, reportDir, commandCounter),
    await runScanStep(resolvedSocketBin, target, opts, token, rawDir, reportDir, commandCounter),
    await runFixStep(resolvedSocketBin, target, opts, token, rawDir, reportDir, commandCounter)
  ]
  const generatedAt = new Date().toISOString()
  const tokenSummary = {
    present: token.present,
    source: token.source
  }

  return await writeReportFiles(reportDir, inventory, {
    generatedAt,
    target,
    reportDir,
    socketBin: resolvedSocketBin,
    token: tokenSummary,
    options: {
      skipScan: opts.skipScan,
      skipFix: opts.skipFix,
      skipPackageScores: opts.skipPackageScores,
      maxDeep: opts.maxDeep,
      minimumReleaseAge: opts.minimumReleaseAge,
      noMajorUpdates: opts.noMajorUpdates
    },
    inventory,
    steps
  })
}

export const sockCommand = defineCliCommand({
  name: 'sock',
  description: 'Write a read-only Socket dependency insight report',
  parameters: sockParameters,
  flags: sockFlags,
  allowExcessParameters: false,
  help: {
    examples: [
      ['bun as sock', 'Analyze the current project and write project/reports/socket/<timestamp>_sock'],
      ['bun as sock packages/app --socket-bin /usr/local/bin/socket', 'Analyze another package with an explicit Socket CLI binary'],
      ['bun as sock --skip-scan --skip-fix', 'Write inventory and package score outputs only'],
      ['bun as sock --token-help', 'Print minimal Socket API token scope guidance']
    ],
    notes: [
      'Read-only: this command never applies Socket Fix changes and always passes --no-apply-fixes.',
      'If Socket authentication or scopes are missing, affected Socket steps are recorded as skipped or failed while local inventory still writes.'
    ]
  }
}, async (ctx) => {
  if (ctx.flags['token-help'] === true) {
    console.log(SOCKET_TOKEN_HELP)
    return
  }

  const opts = resolveRunOptions(ctx.flags, ctx.rawParsed.explicitFlags)
  const report = await runSockReport(ctx.parameters['target'], opts)
  const failedSteps = report.steps.filter((step) => step.status === 'failed').length
  const skippedSteps = report.steps.filter((step) => step.status === 'skipped').length

  l.write('success', `Socket dependency report written: ${report.reportDir}`)
  l.write('info', `summary: ${join(report.reportDir, report.files.summaryMarkdown)}`)
  if (failedSteps > 0 || skippedSteps > 0) {
    l.write('warn', `Socket report completed with ${failedSteps} failed step(s) and ${skippedSteps} skipped step(s)`)
  }
})
