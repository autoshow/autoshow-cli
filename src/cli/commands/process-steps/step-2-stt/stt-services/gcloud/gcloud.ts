import * as l from '~/logger'
import { loadConfig, resolveConfigPath } from '~/cli/commands/setup-and-utilities/config/config-loader'
import { deepMergeConfig } from '~/cli/commands/setup-and-utilities/config/config-merge'
import { writeConfig } from '~/cli/commands/setup-and-utilities/config/config-writer'
import { exec } from '~/utils/cli-utils'
import { readEnv } from '~/utils/validate/env-utils'

const GCLOUD_COMMAND_ENV = {
  CLOUDSDK_CORE_DISABLE_PROMPTS: '1'
} as const

export const GCLOUD_STT_DEFAULT_MODEL = 'chirp_3'
export const GCLOUD_STT_DEFAULT_LOCATION = 'us'

export type GcloudSttRuntimeConfig = {
  accessToken: string
  projectId: string
  location: typeof GCLOUD_STT_DEFAULT_LOCATION
}

export type GcloudSttReadiness = {
  hasCli: boolean
  authConfigured: boolean
  projectId?: string | undefined
  billingAccountId?: string | undefined
  billingEnabled?: boolean | undefined
  speechApiEnabled?: boolean | undefined
  details: {
    cli: string
    auth: string
    project: string
    billing: string
    speechApi: string
  }
}

type GcloudProjectLookup = {
  exists: boolean
  detail: string
  projectId?: string | undefined
  missing?: boolean | undefined
  permissionDenied?: boolean | undefined
}

type GcloudProjectBillingState = {
  detail: string
  billingEnabled?: boolean | undefined
  billingAccountId?: string | undefined
}

const normalizeString = (value: string | undefined): string | undefined => {
  const trimmed = value?.trim()
  if (!trimmed || trimmed === '(unset)') {
    return undefined
  }
  return trimmed
}

const normalizeBillingAccountId = (value: string | undefined): string | undefined => {
  const normalized = normalizeString(value)
  if (!normalized) {
    return undefined
  }
  return normalized.replace(/^billingAccounts\//, '')
}

const readCommandText = (stdout: string, stderr: string): string => {
  const stdoutText = stdout.trim()
  if (stdoutText.length > 0) {
    return stdoutText
  }

  const stderrText = stderr.trim()
  return stderrText.length > 0 ? stderrText : 'command failed'
}

const isPermissionDeniedError = (detail: string): boolean => {
  const normalized = detail.toLowerCase()
  return normalized.includes('permission denied')
    || normalized.includes('permission')
    || normalized.includes('forbidden')
    || normalized.includes('not have permission')
    || normalized.includes('unauthorized')
}

const isMissingProjectError = (detail: string): boolean => {
  const normalized = detail.toLowerCase()
  return normalized.includes('does not exist')
    || normalized.includes('not found')
    || normalized.includes('unknown project')
    || normalized.includes('failed to fetch')
}

const runGcloud = async (
  args: string[]
): Promise<{ stdout: string, stderr: string, exitCode: number }> => {
  const gcloudCliBinary = resolveGcloudCliBinary() ?? 'gcloud'
  return await exec(gcloudCliBinary, args, { env: GCLOUD_COMMAND_ENV })
}

const resolveGcloudCliBinary = (): string | undefined =>
  normalizeString(readEnv('AUTOSHOW_GCLOUD_BIN'))
  ?? (Bun.which('gcloud') ?? undefined)

const hasGcloudCli = (): boolean =>
  resolveGcloudCliBinary() !== undefined

const setProjectId = async (projectId: string): Promise<void> => {
  const result = await runGcloud(['config', 'set', 'project', projectId, '--quiet'])
  if (result.exitCode !== 0) {
    throw new Error(`Failed to set gcloud project "${projectId}": ${readCommandText(result.stdout, result.stderr)}`)
  }
}

const readProjectMetadata = async (projectId: string): Promise<GcloudProjectLookup> => {
  const result = await runGcloud(['projects', 'describe', projectId, '--format=value(projectId)', '--quiet'])
  if (result.exitCode !== 0) {
    const detail = readCommandText(result.stdout, result.stderr)
    return {
      exists: false,
      detail,
      ...(isMissingProjectError(detail) ? { missing: true } : {}),
      ...(isPermissionDeniedError(detail) ? { permissionDenied: true } : {})
    }
  }

  const describedProjectId = normalizeString(result.stdout) ?? projectId
  return {
    exists: true,
    detail: describedProjectId,
    projectId: describedProjectId
  }
}

const createProject = async (
  options: {
    projectId: string
    projectName?: string | undefined
    organizationId?: string | undefined
    folderId?: string | undefined
  }
): Promise<void> => {
  const result = await runGcloud([
    'projects',
    'create',
    options.projectId,
    '--name',
    options.projectName ?? options.projectId,
    ...(options.organizationId ? ['--organization', options.organizationId] : []),
    ...(options.folderId ? ['--folder', options.folderId] : []),
    '--set-as-default',
    '--quiet'
  ])
  if (result.exitCode !== 0) {
    throw new Error(`Failed to create gcloud project "${options.projectId}": ${readCommandText(result.stdout, result.stderr)}`)
  }
}

const readAccessToken = async (): Promise<{ ok: boolean, detail: string, accessToken?: string | undefined }> => {
  const result = await runGcloud(['auth', 'print-access-token', '--quiet'])
  if (result.exitCode !== 0) {
    return {
      ok: false,
      detail: readCommandText(result.stdout, result.stderr)
    }
  }

  const accessToken = normalizeString(result.stdout)
  if (!accessToken) {
    return {
      ok: false,
      detail: 'empty access token'
    }
  }

  return {
    ok: true,
    detail: 'configured',
    accessToken
  }
}

const readProjectId = async (): Promise<{ ok: boolean, detail: string, projectId?: string | undefined }> => {
  const result = await runGcloud(['config', 'get-value', 'project', '--quiet'])
  if (result.exitCode !== 0) {
    return {
      ok: false,
      detail: readCommandText(result.stdout, result.stderr)
    }
  }

  const projectId = normalizeString(result.stdout)
  if (!projectId) {
    return {
      ok: false,
      detail: 'not configured'
    }
  }

  return {
    ok: true,
    detail: projectId,
    projectId
  }
}

const readProjectBilling = async (
  projectId: string
): Promise<GcloudProjectBillingState> => {
  const result = await runGcloud(['billing', 'projects', 'describe', projectId, '--format=json', '--quiet'])
  if (result.exitCode !== 0) {
    return {
      detail: readCommandText(result.stdout, result.stderr)
    }
  }

  try {
    const payload = JSON.parse(result.stdout) as {
      billingAccountName?: string
      billingEnabled?: boolean
    }
    const billingAccountId = normalizeBillingAccountId(payload.billingAccountName)
    const billingEnabled = payload.billingEnabled === true
    return {
      detail: billingEnabled
        ? (billingAccountId ? billingAccountId : 'linked')
        : 'not linked',
      ...(billingAccountId ? { billingAccountId } : {}),
      billingEnabled
    }
  } catch {
    return {
      detail: 'invalid billing response'
    }
  }
}

const listOpenBillingAccounts = async (): Promise<{
  ok: boolean
  detail: string
  accountIds: string[]
}> => {
  const result = await runGcloud(['billing', 'accounts', 'list', '--filter=open=true', '--format=value(name)', '--quiet'])
  if (result.exitCode !== 0) {
    return {
      ok: false,
      detail: readCommandText(result.stdout, result.stderr),
      accountIds: []
    }
  }

  const accountIds = result.stdout
    .split(/\r?\n/)
    .map(line => normalizeBillingAccountId(line))
    .filter((accountId): accountId is string => accountId !== undefined)

  return {
    ok: true,
    detail: accountIds.length === 1 ? (accountIds[0] ?? '1 open billing account') : `${accountIds.length} open billing accounts`,
    accountIds
  }
}

const linkBillingAccount = async (
  projectId: string,
  billingAccountId: string
): Promise<void> => {
  const normalizedBillingAccountId = normalizeBillingAccountId(billingAccountId)
  if (!normalizedBillingAccountId) {
    throw new Error(`Invalid gcloud billing account "${billingAccountId}"`)
  }

  const result = await runGcloud([
    'billing',
    'projects',
    'link',
    projectId,
    '--billing-account',
    normalizedBillingAccountId,
    '--quiet'
  ])
  if (result.exitCode !== 0) {
    throw new Error(`Failed to link billing account "${normalizedBillingAccountId}" to gcloud project "${projectId}": ${readCommandText(result.stdout, result.stderr)}`)
  }
}

const verifySpeechApiEnabled = async (
  projectId: string
): Promise<{ ok: boolean, detail: string }> => {
  const result = await runGcloud([
    'services',
    'list',
    '--enabled',
    '--project',
    projectId,
    '--filter=config.name:speech.googleapis.com',
    '--format=value(config.name)',
    '--quiet'
  ])
  if (result.exitCode !== 0) {
    return {
      ok: false,
      detail: readCommandText(result.stdout, result.stderr)
    }
  }

  const enabled = normalizeString(result.stdout) === 'speech.googleapis.com'
  return {
    ok: enabled,
    detail: enabled ? 'enabled' : 'not enabled'
  }
}

const enableSpeechApi = async (projectId: string): Promise<void> => {
  const result = await runGcloud([
    'services',
    'enable',
    'speech.googleapis.com',
    '--project',
    projectId,
    '--quiet'
  ])
  if (result.exitCode !== 0) {
    throw new Error(`Failed to enable speech.googleapis.com for project "${projectId}": ${readCommandText(result.stdout, result.stderr)}`)
  }
}

const hasSavedGcloudSttDefault = (
  config: Awaited<ReturnType<typeof loadConfig>>
): boolean => Array.isArray(config.defaults?.stt?.gcloudStt) && config.defaults.stt.gcloudStt.length > 0

const ensureGcloudSttDefaultSaved = async (
  configPathOverride?: string
): Promise<{ configPath: string, saved: boolean }> => {
  const configPath = await resolveConfigPath(configPathOverride)
  const current = await loadConfig(configPath)
  if (hasSavedGcloudSttDefault(current)) {
    return {
      configPath,
      saved: false
    }
  }

  const updated = deepMergeConfig(current as Record<string, unknown>, {
    version: 2,
    defaults: {
      stt: {
        gcloudStt: [GCLOUD_STT_DEFAULT_MODEL]
      }
    }
  })
  await writeConfig(configPath, updated)
  return {
    configPath,
    saved: true
  }
}

const buildSaveGcloudDefaultCommand = (configPathOverride?: string): string => {
  const args = ['bun as config', '--gcloud-stt', GCLOUD_STT_DEFAULT_MODEL]
  if (configPathOverride) {
    args.push('--config-path', configPathOverride)
  }
  return args.join(' ')
}

const buildSetupGcloudCommand = (
  options: {
    projectId?: string | undefined
    billingAccountId?: string | undefined
    configPathOverride?: string | undefined
  } = {}
): string => {
  const args = ['bun as setup', '--gcloud']
  if (options.projectId) {
    args.push('--gcloud-project', options.projectId)
  }
  if (options.billingAccountId) {
    args.push('--gcloud-billing-account', options.billingAccountId)
  }
  if (options.configPathOverride) {
    args.push('--config-path', options.configPathOverride)
  }
  return args.join(' ')
}

export const readGcloudSttReadiness = async (): Promise<GcloudSttReadiness> => {
  if (!hasGcloudCli()) {
    return {
      hasCli: false,
      authConfigured: false,
      details: {
        cli: 'not found',
        auth: 'skipped',
        project: 'skipped',
        billing: 'skipped',
        speechApi: 'skipped'
      }
    }
  }

  const cliPath = resolveGcloudCliBinary() ?? 'gcloud'
  const authState = await readAccessToken()
  const projectState = await readProjectId()
  const billingState = authState.ok && projectState.ok && projectState.projectId
    ? await readProjectBilling(projectState.projectId)
    : { detail: 'skipped' }
  const apiState = authState.ok && projectState.ok && projectState.projectId
    ? await verifySpeechApiEnabled(projectState.projectId)
    : { ok: false, detail: 'skipped' }

  return {
    hasCli: true,
    authConfigured: authState.ok,
    ...(projectState.projectId ? { projectId: projectState.projectId } : {}),
    ...(billingState.billingAccountId ? { billingAccountId: billingState.billingAccountId } : {}),
    ...(authState.ok && projectState.ok ? { billingEnabled: billingState.billingEnabled === true } : {}),
    ...(authState.ok && projectState.ok ? { speechApiEnabled: apiState.ok } : {}),
    details: {
      cli: cliPath,
      auth: authState.detail,
      project: projectState.projectId ?? projectState.detail,
      billing: authState.ok && projectState.ok ? billingState.detail : 'skipped',
      speechApi: authState.ok && projectState.ok ? apiState.detail : 'skipped'
    }
  }
}

const logCheck = (label: string, ok: boolean, detail: string): void => {
  const prefix = ok ? 'OK' : 'MISSING'
  const log = ok ? l.success : l.warn
  log(`${prefix}: ${label} — ${detail}`)
}

const buildSetupCommands = (
  state: GcloudSttReadiness,
  options: {
    explicitProject?: string | undefined
    explicitBillingAccount?: string | undefined
    configPathOverride?: string | undefined
    defaultModelConfigured?: boolean | undefined
  } = {}
): string[] => {
  const commands: string[] = []
  let suggestedBootstrapCommand = false

  if (!state.hasCli) {
    commands.push('Install the Google Cloud CLI: https://cloud.google.com/sdk/docs/install')
    return commands
  }

  if (!state.authConfigured) {
    commands.push('gcloud init')
    commands.push('gcloud auth login')
  }
  if (!state.projectId) {
    if (options.explicitProject) {
      commands.push(buildSetupGcloudCommand({
        projectId: options.explicitProject,
        ...(options.configPathOverride ? { configPathOverride: options.configPathOverride } : {})
      }))
    } else {
      commands.push('gcloud projects list')
      commands.push('gcloud projects create PROJECT_ID --set-as-default')
      commands.push(buildSetupGcloudCommand({
        projectId: 'PROJECT_ID',
        ...(options.configPathOverride ? { configPathOverride: options.configPathOverride } : {})
      }))
    }
    suggestedBootstrapCommand = true
  }
  if (state.authConfigured && state.projectId && state.billingEnabled !== true) {
    commands.push('gcloud billing accounts list --filter=open=true')
    commands.push(options.explicitProject
      ? buildSetupGcloudCommand({
          projectId: state.projectId,
          billingAccountId: options.explicitBillingAccount ?? 'ACCOUNT_ID',
          ...(options.configPathOverride ? { configPathOverride: options.configPathOverride } : {})
        })
      : `gcloud billing projects link ${state.projectId} --billing-account ACCOUNT_ID`)
    suggestedBootstrapCommand ||= options.explicitProject !== undefined
  }
  if (state.authConfigured && state.projectId && state.billingEnabled === true && state.speechApiEnabled !== true) {
    commands.push(`gcloud services enable speech.googleapis.com --project ${state.projectId}`)
  }
  if (options.defaultModelConfigured !== true && !suggestedBootstrapCommand) {
    commands.push(buildSaveGcloudDefaultCommand(options.configPathOverride))
  }

  return commands
}

const resolvePreferredBillingAccount = async (
  state: GcloudSttReadiness,
  explicitBillingAccount: string | undefined
): Promise<string | undefined> => {
  if (explicitBillingAccount) {
    return explicitBillingAccount
  }
  if (state.billingAccountId) {
    return state.billingAccountId
  }

  const billingAccounts = await listOpenBillingAccounts()
  if (!billingAccounts.ok || billingAccounts.accountIds.length !== 1) {
    return undefined
  }
  return billingAccounts.accountIds[0]
}

export const setupGcloudStt = async (
  options: {
    focused?: boolean | undefined
    preferredProject?: string | undefined
    preferredBillingAccount?: string | undefined
    projectName?: string | undefined
    organizationId?: string | undefined
    folderId?: string | undefined
    configPathOverride?: string | undefined
  } = {}
): Promise<void> => {
  const explicitProject = normalizeString(options.preferredProject)
  const explicitBillingAccount = normalizeBillingAccountId(options.preferredBillingAccount)
  const projectName = normalizeString(options.projectName)
  const organizationId = normalizeString(options.organizationId)
  const folderId = normalizeString(options.folderId)
  let savedConfigPath: string | undefined
  let defaultModelConfigured = false
  let state = await readGcloudSttReadiness()

  if (explicitProject && state.hasCli) {
    if (state.authConfigured) {
      const projectLookup = await readProjectMetadata(explicitProject)
      if (!projectLookup.exists) {
        if (projectLookup.permissionDenied) {
          throw new Error(`Failed to access gcloud project "${explicitProject}": ${projectLookup.detail}`)
        }
        if (!projectLookup.missing) {
          throw new Error(`Failed to inspect gcloud project "${explicitProject}": ${projectLookup.detail}`)
        }
        await createProject({
          projectId: explicitProject,
          projectName: projectName ?? explicitProject,
          organizationId,
          folderId
        })
      }
    }

    if (state.projectId !== explicitProject) {
      await setProjectId(explicitProject)
    }
    state = await readGcloudSttReadiness()

    if (state.authConfigured && state.projectId) {
      const preferredBillingAccount = await resolvePreferredBillingAccount(state, explicitBillingAccount)
      if (preferredBillingAccount && (state.billingEnabled !== true || state.billingAccountId !== preferredBillingAccount)) {
        await linkBillingAccount(state.projectId, preferredBillingAccount)
        state = await readGcloudSttReadiness()
      }
      const readyProjectId = state.projectId
      if (readyProjectId && state.billingEnabled === true && state.speechApiEnabled !== true) {
        await enableSpeechApi(readyProjectId)
        state = await readGcloudSttReadiness()
      }
    }

    const defaultSave = await ensureGcloudSttDefaultSaved(options.configPathOverride)
    savedConfigPath = defaultSave.saved ? defaultSave.configPath : undefined
    defaultModelConfigured = true
  }

  if (options.focused) {
    l.info('Google Cloud STT setup')
  }

  logCheck('gcloud', state.hasCli, state.details.cli)
  logCheck('gcloud auth', state.authConfigured, state.details.auth)
  logCheck('gcloud project', state.projectId !== undefined, state.details.project)
  if (state.authConfigured && state.projectId) {
    logCheck('gcloud billing', state.billingEnabled === true, state.details.billing)
    logCheck('speech.googleapis.com', state.speechApiEnabled === true, state.details.speechApi)
  }
  if (savedConfigPath) {
    l.success(`OK: gcloud config — saved ${savedConfigPath}`)
  }

  if (options.focused) {
    l.info('INFO: gcloud STT location — us')
    l.info('INFO: gcloud STT transport — direct REST Recognize requests via us-speech.googleapis.com, no AutoShow-managed bucket required')

    const commands = buildSetupCommands(state, {
      explicitProject,
      explicitBillingAccount,
      configPathOverride: explicitProject ? options.configPathOverride : undefined,
      defaultModelConfigured
    })
    if (commands.length > 0) {
      l.info('')
      l.info('Next steps')
      for (const command of commands) {
        l.info(command)
      }
    }
  }
}

export const ensureGcloudSttSetup = async (): Promise<GcloudSttRuntimeConfig> => {
  const state = await readGcloudSttReadiness()
  if (!state.hasCli) {
    throw new Error('Google Cloud CLI is required for Google transcription. Install gcloud and rerun `bun as setup --gcloud`.')
  }

  if (!state.authConfigured) {
    throw new Error('Google Cloud CLI auth is required for Google transcription. Run `gcloud auth login` or rerun `bun as setup --gcloud`.')
  }

  if (!state.projectId) {
    throw new Error('Google Cloud project is required for Google transcription. Run `bun as setup --gcloud --gcloud-project PROJECT_ID` to create or select the project, or run `gcloud config set project PROJECT_ID` if it already exists.')
  }

  if (state.billingEnabled !== true) {
    throw new Error(`Google Cloud billing must be linked for project ${state.projectId}. Run \`gcloud billing projects link ${state.projectId} --billing-account ACCOUNT_ID\` or rerun \`bun as setup --gcloud --gcloud-project ${state.projectId}\`.`)
  }

  if (state.speechApiEnabled !== true) {
    throw new Error(`Google Cloud Speech-to-Text API must be enabled for project ${state.projectId}. Run \`gcloud services enable speech.googleapis.com --project ${state.projectId}\` or rerun \`bun as setup --gcloud\`.`)
  }

  const tokenState = await readAccessToken()
  const accessToken = tokenState.accessToken
  if (!tokenState.ok || !accessToken) {
    throw new Error('Google Cloud CLI auth is required for Google transcription. Run `gcloud auth login` or rerun `bun as setup --gcloud`.')
  }

  return {
    accessToken,
    projectId: state.projectId,
    location: GCLOUD_STT_DEFAULT_LOCATION
  }
}

export const resolveGcloudSpeechContext = async (): Promise<GcloudSttRuntimeConfig> =>
  await ensureGcloudSttSetup()
