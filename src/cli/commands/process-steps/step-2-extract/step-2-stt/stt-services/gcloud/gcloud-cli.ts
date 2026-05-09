import { exec } from '~/utils/cli-utils'
import { readEnv } from '~/utils/validate/env-utils'
import type {
  GcloudProjectBillingState,
  GcloudProjectLookup
} from '~/types'
import { GCLOUD_COMMAND_ENV } from './gcloud-constants'
import type { GcloudRequiredApi } from './gcloud-constants'

export const normalizeString = (value: string | undefined): string | undefined => {
  const trimmed = value?.trim()
  if (!trimmed || trimmed === '(unset)') {
    return undefined
  }
  return trimmed
}

export const normalizeBillingAccountId = (value: string | undefined): string | undefined => {
  const normalized = normalizeString(value)
  if (!normalized) {
    return undefined
  }
  return normalized.replace(/^billingAccounts\//, '')
}

export const readCommandText = (stdout: string, stderr: string): string => {
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

export const resolveGcloudCliBinary = (): string | undefined =>
  normalizeString(readEnv('AUTOSHOW_GCLOUD_BIN'))
  ?? (Bun.which('gcloud') ?? undefined)

export const hasGcloudCli = (): boolean =>
  resolveGcloudCliBinary() !== undefined

export const runGcloud = async (
  args: string[]
): Promise<{ stdout: string, stderr: string, exitCode: number }> => {
  const gcloudCliBinary = resolveGcloudCliBinary() ?? 'gcloud'
  return await exec(gcloudCliBinary, args, { env: GCLOUD_COMMAND_ENV })
}

export const setProjectId = async (projectId: string): Promise<void> => {
  const result = await runGcloud(['config', 'set', 'project', projectId, '--quiet'])
  if (result.exitCode !== 0) {
    throw new Error(`Failed to set gcloud project "${projectId}": ${readCommandText(result.stdout, result.stderr)}`)
  }
}

export const readProjectMetadata = async (projectId: string): Promise<GcloudProjectLookup> => {
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

export const createProject = async (
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

export const readAccessToken = async (): Promise<{ ok: boolean, detail: string, accessToken?: string | undefined }> => {
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

export const readProjectId = async (): Promise<{ ok: boolean, detail: string, projectId?: string | undefined }> => {
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

export const readProjectBilling = async (
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

export const listOpenBillingAccounts = async (): Promise<{
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

export const linkBillingAccount = async (
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

export const verifyServiceApiEnabled = async (
  projectId: string,
  serviceName: GcloudRequiredApi
): Promise<{ ok: boolean, detail: string }> => {
  const result = await runGcloud([
    'services',
    'list',
    '--enabled',
    '--project',
    projectId,
    `--filter=config.name=${serviceName}`,
    '--format=value(config.name)',
    '--quiet'
  ])
  if (result.exitCode !== 0) {
    return {
      ok: false,
      detail: readCommandText(result.stdout, result.stderr)
    }
  }

  const enabled = normalizeString(result.stdout) === serviceName
  return {
    ok: enabled,
    detail: enabled ? 'enabled' : 'not enabled'
  }
}

export const enableServiceApi = async (
  projectId: string,
  serviceName: GcloudRequiredApi
): Promise<void> => {
  const result = await runGcloud([
    'services',
    'enable',
    serviceName,
    '--project',
    projectId,
    '--quiet'
  ])
  if (result.exitCode !== 0) {
    throw new Error(`Failed to enable ${serviceName} for project "${projectId}": ${readCommandText(result.stdout, result.stderr)}`)
  }
}

export const verifySpeechApiEnabled = async (
  projectId: string
): Promise<{ ok: boolean, detail: string }> =>
  await verifyServiceApiEnabled(projectId, 'speech.googleapis.com')
