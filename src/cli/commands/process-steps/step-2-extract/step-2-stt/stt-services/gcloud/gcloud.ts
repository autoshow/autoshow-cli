import * as l from '~/utils/logger'
import { createHumanTable } from '~/utils/logger/human-table'
import { loadConfig, resolveConfigPath } from '~/cli/commands/setup-and-utilities/config/config-loader'
import { deepMergeConfig } from '~/cli/commands/setup-and-utilities/config/config-merge'
import { writeConfig } from '~/cli/commands/setup-and-utilities/config/config-writer'
import { exec } from '~/utils/cli-utils'
import { readEnv } from '~/utils/validate/env-utils'
import type {
  GcloudProjectBillingState,
  GcloudProjectLookup,
  GcloudSttReadiness,
  GcloudSttRuntimeConfig
} from '~/types'

const GCLOUD_COMMAND_ENV = {
  CLOUDSDK_CORE_DISABLE_PROMPTS: '1'
} as const

export const GCLOUD_STT_DEFAULT_MODEL = 'chirp_3'
export const GCLOUD_STT_DEFAULT_LOCATION = 'us'
const GCLOUD_DOCAI_DEFAULT_MODEL = 'ocr'
const GCLOUD_DOCAI_DEFAULT_LOCATION = 'us'
const GCLOUD_DOCAI_DEFAULT_PROCESSOR_DISPLAY_NAME = 'autoshow-ocr'
const GCLOUD_DOCAI_LAYOUT_PROCESSOR_DISPLAY_NAME = 'autoshow-layout-parser'
const GCLOUD_DOCAI_OCR_PROCESSOR_TYPE = 'OCR_PROCESSOR'
const GCLOUD_DOCAI_LAYOUT_PROCESSOR_TYPE = 'LAYOUT_PARSER_PROCESSOR'
const GCLOUD_REQUIRED_APIS = [
  'speech.googleapis.com',
  'documentai.googleapis.com',
  'storage.googleapis.com'
] as const

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

const verifyServiceApiEnabled = async (
  projectId: string,
  serviceName: typeof GCLOUD_REQUIRED_APIS[number]
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

const enableServiceApi = async (
  projectId: string,
  serviceName: typeof GCLOUD_REQUIRED_APIS[number]
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

const verifySpeechApiEnabled = async (
  projectId: string
): Promise<{ ok: boolean, detail: string }> =>
  await verifyServiceApiEnabled(projectId, 'speech.googleapis.com')

const hasSavedGcloudDocaiDefault = (
  config: Awaited<ReturnType<typeof loadConfig>>
): boolean => Array.isArray(config.defaults?.extract?.ocr?.gcloudDocai) && config.defaults.extract.ocr.gcloudDocai.length > 0

const readSavedGcloudDocaiDefaults = async (
  configPathOverride?: string
): Promise<{
  configPath: string
  hasModelDefault: boolean
  location?: string | undefined
  ocrProcessorId?: string | undefined
  layoutProcessorId?: string | undefined
  bucket?: string | undefined
}> => {
  const configPath = await resolveConfigPath(configPathOverride)
  const current = await loadConfig(configPath)
  const ocr = current.defaults?.extract?.ocr
  return {
    configPath,
    hasModelDefault: hasSavedGcloudDocaiDefault(current),
    location: normalizeString(ocr?.gcloudDocaiLocation),
    ocrProcessorId: normalizeString(ocr?.gcloudDocaiOcrProcessorId),
    layoutProcessorId: normalizeString(ocr?.gcloudDocaiLayoutProcessorId),
    bucket: normalizeString(ocr?.gcloudDocaiBucket)
  }
}

const readGcloudDocaiProcessorId = (processorName: string): string | undefined =>
  processorName.split('/').pop()

const documentAiBaseUrl = (projectId: string, location: string): string =>
  `https://${location}-documentai.googleapis.com/v1/projects/${projectId}/locations/${location}/processors`

const listDocumentAiProcessors = async (
  projectId: string,
  location: string,
  accessToken: string
): Promise<Array<{ name?: string, displayName?: string, type?: string }>> => {
  const response = await fetch(documentAiBaseUrl(projectId, location), {
    headers: { 'Authorization': `Bearer ${accessToken}` }
  })
  if (!response.ok) {
    throw new Error(`Failed to list Document AI processors (${response.status}): ${await response.text()}`)
  }
  const payload = await response.json() as { processors?: Array<{ name?: string, displayName?: string, type?: string }> }
  return Array.isArray(payload.processors) ? payload.processors : []
}

const createDocumentAiOcrProcessor = async (
  projectId: string,
  location: string,
  accessToken: string
): Promise<string> => {
  const response = await fetch(documentAiBaseUrl(projectId, location), {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      displayName: GCLOUD_DOCAI_DEFAULT_PROCESSOR_DISPLAY_NAME,
      type: GCLOUD_DOCAI_OCR_PROCESSOR_TYPE
    })
  })
  if (!response.ok) {
    throw new Error(
      `Failed to create Document AI OCR processor (${response.status}): ${await response.text()}. ` +
      `Create one manually in project ${projectId}, location ${location}, type ${GCLOUD_DOCAI_OCR_PROCESSOR_TYPE}.`
    )
  }
  const payload = await response.json() as { name?: string }
  const processorId = payload.name ? readGcloudDocaiProcessorId(payload.name) : undefined
  if (!processorId) {
    throw new Error('Document AI OCR processor creation response did not include a processor ID.')
  }
  return processorId
}

const ensureDocumentAiOcrProcessor = async (
  projectId: string,
  location: string,
  accessToken: string,
  savedProcessorId?: string | undefined
): Promise<{ processorId?: string | undefined, created: boolean, detail: string }> => {
  if (savedProcessorId) {
    return { processorId: savedProcessorId, created: false, detail: `saved ${savedProcessorId}` }
  }

  const processors = await listDocumentAiProcessors(projectId, location, accessToken)
  const reusable = processors.find((processor) =>
    processor.type === GCLOUD_DOCAI_OCR_PROCESSOR_TYPE
    && processor.displayName === GCLOUD_DOCAI_DEFAULT_PROCESSOR_DISPLAY_NAME
    && processor.name
  )
  const reusableId = reusable?.name ? readGcloudDocaiProcessorId(reusable.name) : undefined
  if (reusableId) {
    return { processorId: reusableId, created: false, detail: `found ${reusableId}` }
  }

  const processorId = await createDocumentAiOcrProcessor(projectId, location, accessToken)
  return { processorId, created: true, detail: `created ${processorId}` }
}

const createDocumentAiLayoutProcessor = async (
  projectId: string,
  location: string,
  accessToken: string
): Promise<string> => {
  const response = await fetch(documentAiBaseUrl(projectId, location), {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      displayName: GCLOUD_DOCAI_LAYOUT_PROCESSOR_DISPLAY_NAME,
      type: GCLOUD_DOCAI_LAYOUT_PROCESSOR_TYPE
    })
  })
  if (!response.ok) {
    throw new Error(
      `Failed to create Document AI Layout Parser processor (${response.status}): ${await response.text()}. ` +
      `Create one manually in project ${projectId}, location ${location}, type ${GCLOUD_DOCAI_LAYOUT_PROCESSOR_TYPE}.`
    )
  }
  const payload = await response.json() as { name?: string }
  const processorId = payload.name ? readGcloudDocaiProcessorId(payload.name) : undefined
  if (!processorId) {
    throw new Error('Document AI Layout Parser processor creation response did not include a processor ID.')
  }
  return processorId
}

const ensureDocumentAiLayoutProcessor = async (
  projectId: string,
  location: string,
  accessToken: string,
  savedProcessorId?: string | undefined
): Promise<{ processorId?: string | undefined, created: boolean, detail: string }> => {
  if (savedProcessorId) {
    return { processorId: savedProcessorId, created: false, detail: `saved ${savedProcessorId}` }
  }

  const processors = await listDocumentAiProcessors(projectId, location, accessToken)
  const reusable = processors.find((processor) =>
    processor.type === GCLOUD_DOCAI_LAYOUT_PROCESSOR_TYPE
    && processor.displayName === GCLOUD_DOCAI_LAYOUT_PROCESSOR_DISPLAY_NAME
    && processor.name
  )
  const reusableId = reusable?.name ? readGcloudDocaiProcessorId(reusable.name) : undefined
  if (reusableId) {
    return { processorId: reusableId, created: false, detail: `found ${reusableId}` }
  }

  const processorId = await createDocumentAiLayoutProcessor(projectId, location, accessToken)
  return { processorId, created: true, detail: `created ${processorId}` }
}

const sanitizeBucketPart = (value: string): string =>
  value.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'project'

const generateGcloudDocaiBucketName = (projectId: string): string =>
  `autoshow-docai-${sanitizeBucketPart(projectId)}-${crypto.randomUUID().replace(/-/g, '').slice(0, 8)}`

const verifyGcsBucketAccess = async (bucket: string): Promise<{ ok: boolean, detail: string }> => {
  const result = await runGcloud(['storage', 'ls', `gs://${bucket}`, '--quiet'])
  if (result.exitCode !== 0) {
    return {
      ok: false,
      detail: readCommandText(result.stdout, result.stderr)
    }
  }
  return { ok: true, detail: 'accessible' }
}

const createGcsBucket = async (
  projectId: string,
  bucket: string,
  location: string
): Promise<void> => {
  const result = await runGcloud([
    'storage',
    'buckets',
    'create',
    `gs://${bucket}`,
    '--project',
    projectId,
    '--location',
    location,
    '--uniform-bucket-level-access',
    '--public-access-prevention',
    '--quiet'
  ])
  if (result.exitCode !== 0) {
    throw new Error(
      `Failed to create GCS bucket "${bucket}": ${readCommandText(result.stdout, result.stderr)}. ` +
      `Run: gcloud storage buckets create gs://${bucket} --project ${projectId} --location ${location} --uniform-bucket-level-access --public-access-prevention`
    )
  }
}

const ensureGcloudDocaiBucket = async (
  projectId: string,
  location: string,
  savedBucket?: string | undefined
): Promise<{ bucket?: string | undefined, created: boolean, ok: boolean, detail: string }> => {
  if (savedBucket) {
    const access = await verifyGcsBucketAccess(savedBucket)
    if (!access.ok) {
      return { bucket: savedBucket, created: false, ok: false, detail: access.detail }
    }
    return { bucket: savedBucket, created: false, ok: true, detail: 'saved and accessible' }
  }

  const bucket = generateGcloudDocaiBucketName(projectId)
  await createGcsBucket(projectId, bucket, location)
  const access = await verifyGcsBucketAccess(bucket)
  if (!access.ok) {
    throw new Error(`Created GCS bucket "${bucket}" but could not verify access: ${access.detail}`)
  }
  return { bucket, created: true, ok: true, detail: 'created and accessible' }
}

const hasSavedGcloudSttDefault = (
  config: Awaited<ReturnType<typeof loadConfig>>
): boolean => Array.isArray(config.defaults?.extract?.stt?.gcloudStt) && config.defaults.extract.stt.gcloudStt.length > 0

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
      extract: {
        stt: {
          gcloudStt: [GCLOUD_STT_DEFAULT_MODEL]
        }
      }
    }
  })
  await writeConfig(configPath, updated)
  return {
    configPath,
    saved: true
  }
}

const ensureGcloudRuntimeDefaultsSaved = async (
  options: {
    configPathOverride?: string | undefined
    ocrProcessorId?: string | undefined
    layoutProcessorId?: string | undefined
    bucket?: string | undefined
    location?: string | undefined
  } = {}
): Promise<{ configPath: string, saved: boolean }> => {
  const configPath = await resolveConfigPath(options.configPathOverride)
  const current = await loadConfig(configPath)
  const ocr = current.defaults?.extract?.ocr
  const patchOcr: Record<string, unknown> = {}

  if (!hasSavedGcloudDocaiDefault(current)) {
    patchOcr['gcloudDocai'] = [GCLOUD_DOCAI_DEFAULT_MODEL]
  }
  if (!normalizeString(ocr?.gcloudDocaiLocation)) {
    patchOcr['gcloudDocaiLocation'] = options.location ?? GCLOUD_DOCAI_DEFAULT_LOCATION
  }
  if (!normalizeString(ocr?.gcloudDocaiOcrProcessorId) && options.ocrProcessorId) {
    patchOcr['gcloudDocaiOcrProcessorId'] = options.ocrProcessorId
  }
  if (!normalizeString(ocr?.gcloudDocaiLayoutProcessorId) && options.layoutProcessorId) {
    patchOcr['gcloudDocaiLayoutProcessorId'] = options.layoutProcessorId
  }
  if (!normalizeString(ocr?.gcloudDocaiBucket) && options.bucket) {
    patchOcr['gcloudDocaiBucket'] = options.bucket
  }

  const patch = {
    version: 2,
    defaults: {
      extract: {
        stt: {
          ...(hasSavedGcloudSttDefault(current) ? {} : { gcloudStt: [GCLOUD_STT_DEFAULT_MODEL] })
        },
        ocr: patchOcr
      }
    }
  }

  const hasSttPatch = !hasSavedGcloudSttDefault(current)
  const hasOcrPatch = Object.keys(patchOcr).length > 0
  if (!hasSttPatch && !hasOcrPatch) {
    return { configPath, saved: false }
  }

  const updated = deepMergeConfig(current as Record<string, unknown>, patch)
  await writeConfig(configPath, updated)
  return { configPath, saved: true }
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
        speechApi: 'skipped',
        documentAiApi: 'skipped',
        storageApi: 'skipped'
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
  const documentAiApiState = authState.ok && projectState.ok && projectState.projectId
    ? await verifyServiceApiEnabled(projectState.projectId, 'documentai.googleapis.com')
    : { ok: false, detail: 'skipped' }
  const storageApiState = authState.ok && projectState.ok && projectState.projectId
    ? await verifyServiceApiEnabled(projectState.projectId, 'storage.googleapis.com')
    : { ok: false, detail: 'skipped' }

  return {
    hasCli: true,
    authConfigured: authState.ok,
    ...(projectState.projectId ? { projectId: projectState.projectId } : {}),
    ...(billingState.billingAccountId ? { billingAccountId: billingState.billingAccountId } : {}),
    ...(authState.ok && projectState.ok ? { billingEnabled: billingState.billingEnabled === true } : {}),
    ...(authState.ok && projectState.ok ? { speechApiEnabled: apiState.ok } : {}),
    ...(authState.ok && projectState.ok ? { documentAiApiEnabled: documentAiApiState.ok } : {}),
    ...(authState.ok && projectState.ok ? { storageApiEnabled: storageApiState.ok } : {}),
    details: {
      cli: cliPath,
      auth: authState.detail,
      project: projectState.projectId ?? projectState.detail,
      billing: authState.ok && projectState.ok ? billingState.detail : 'skipped',
      speechApi: authState.ok && projectState.ok ? apiState.detail : 'skipped',
      documentAiApi: authState.ok && projectState.ok ? documentAiApiState.detail : 'skipped',
      storageApi: authState.ok && projectState.ok ? storageApiState.detail : 'skipped'
    }
  }
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
  if (state.authConfigured && state.projectId && state.billingEnabled === true && state.documentAiApiEnabled !== true) {
    commands.push(`gcloud services enable documentai.googleapis.com --project ${state.projectId}`)
  }
  if (state.authConfigured && state.projectId && state.billingEnabled === true && state.storageApiEnabled !== true) {
    commands.push(`gcloud services enable storage.googleapis.com --project ${state.projectId}`)
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
  let docaiProcessorDetail: string | undefined
  let docaiLayoutProcessorDetail: string | undefined
  let gcsBucketDetail: string | undefined
  let gcsBucketOk = false
  let docaiLocation = GCLOUD_DOCAI_DEFAULT_LOCATION
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
      if (readyProjectId && state.billingEnabled === true) {
        for (const serviceName of GCLOUD_REQUIRED_APIS) {
          const enabled = serviceName === 'speech.googleapis.com'
            ? state.speechApiEnabled
            : serviceName === 'documentai.googleapis.com'
              ? state.documentAiApiEnabled
              : state.storageApiEnabled
          if (enabled !== true) {
            await enableServiceApi(readyProjectId, serviceName)
            // GCP has eventual consistency — poll until the API appears in the enabled list
            for (let attempt = 0; attempt < 5; attempt++) {
              await Bun.sleep(3000)
              const check = await verifyServiceApiEnabled(readyProjectId, serviceName)
              if (check.ok) break
              if (attempt < 4) {
                l.write('info', `Waiting for ${serviceName} to propagate...`)
              }
            }
            state = await readGcloudSttReadiness()
          }
        }
      }
    }
    defaultModelConfigured = true
  }

  if (
    state.authConfigured
    && state.projectId
    && state.billingEnabled === true
    && state.documentAiApiEnabled === true
    && state.storageApiEnabled === true
  ) {
    const savedDocai = await readSavedGcloudDocaiDefaults(options.configPathOverride)
    docaiLocation = savedDocai.location ?? GCLOUD_DOCAI_DEFAULT_LOCATION
    const tokenState = await readAccessToken()
    if (!tokenState.ok || !tokenState.accessToken) {
      throw new Error(`gcloud auth failed while configuring Document AI: ${tokenState.detail}`)
    }
    const processor = await ensureDocumentAiOcrProcessor(
      state.projectId,
      docaiLocation,
      tokenState.accessToken,
      savedDocai.ocrProcessorId
    )
    docaiProcessorDetail = processor.detail
    const layoutProcessor = await ensureDocumentAiLayoutProcessor(
      state.projectId,
      docaiLocation,
      tokenState.accessToken,
      savedDocai.layoutProcessorId
    )
    docaiLayoutProcessorDetail = layoutProcessor.detail
    const bucket = await ensureGcloudDocaiBucket(
      state.projectId,
      docaiLocation,
      savedDocai.bucket
    )
    gcsBucketDetail = bucket.bucket ? `${bucket.bucket} (${bucket.detail})` : bucket.detail
    gcsBucketOk = bucket.ok

    const defaultSave = await ensureGcloudRuntimeDefaultsSaved({
      configPathOverride: options.configPathOverride,
      ocrProcessorId: processor.processorId,
      layoutProcessorId: layoutProcessor.processorId,
      bucket: bucket.bucket,
      location: docaiLocation
    })
    savedConfigPath = defaultSave.saved ? defaultSave.configPath : undefined
  } else if (!defaultModelConfigured) {
    const defaultSave = await ensureGcloudSttDefaultSaved(options.configPathOverride)
    savedConfigPath = defaultSave.saved ? defaultSave.configPath : undefined
  }

  if (options.focused) {
    l.write('info', 'Google Cloud STT + Document AI OCR setup')
  }

  const checkRows = [
    { status: state.hasCli ? 'OK' : 'MISSING', check: 'gcloud', detail: state.details.cli },
    { status: state.authConfigured ? 'OK' : 'MISSING', check: 'gcloud auth', detail: state.details.auth },
    { status: state.projectId !== undefined ? 'OK' : 'MISSING', check: 'gcloud project', detail: state.details.project },
    ...(state.authConfigured && state.projectId
      ? [
          { status: state.billingEnabled === true ? 'OK' : 'MISSING', check: 'gcloud billing', detail: state.details.billing },
          { status: state.speechApiEnabled === true ? 'OK' : 'MISSING', check: 'speech.googleapis.com', detail: state.details.speechApi },
          { status: state.documentAiApiEnabled === true ? 'OK' : 'MISSING', check: 'documentai.googleapis.com', detail: state.details.documentAiApi },
          { status: state.storageApiEnabled === true ? 'OK' : 'MISSING', check: 'storage.googleapis.com', detail: state.details.storageApi },
          ...(docaiProcessorDetail ? [{ status: 'OK', check: 'Document AI OCR processor', detail: docaiProcessorDetail }] : []),
          ...(docaiLayoutProcessorDetail ? [{ status: 'OK', check: 'Document AI Layout Parser processor', detail: docaiLayoutProcessorDetail }] : []),
          ...(gcsBucketDetail ? [{ status: gcsBucketOk ? 'OK' : 'MISSING', check: 'GCS Document AI bucket', detail: gcsBucketDetail }] : [])
        ]
      : []),
    ...(savedConfigPath ? [{ status: 'OK', check: 'gcloud config', detail: `saved ${savedConfigPath}` }] : [])
  ]

  l.write(checkRows.some((row) => row.status === 'MISSING') ? 'warn' : 'success', 'Google Cloud STT + Document AI OCR checks', {
    category: 'command',
    humanTable: createHumanTable(checkRows, ['status', 'check', 'detail'])
  })

  if (options.focused) {
    l.write('info', 'Google Cloud STT + Document AI OCR Config', {
      category: 'command',
      humanTable: createHumanTable([
        { setting: 'stt model', value: GCLOUD_STT_DEFAULT_MODEL },
        { setting: 'stt location', value: 'us' },
        { setting: 'ocr model', value: GCLOUD_DOCAI_DEFAULT_MODEL },
        { setting: 'ocr location', value: docaiLocation },
        { setting: 'layout parser', value: docaiLayoutProcessorDetail ?? 'not configured' },
        { setting: 'stt transport', value: 'direct REST Recognize requests via us-speech.googleapis.com' },
        { setting: 'ocr transport', value: 'Document AI sync and batch APIs with GCS staging for multi-page or large files' }
      ], ['setting', 'value'])
    })

    const commands = buildSetupCommands(state, {
      explicitProject,
      explicitBillingAccount,
      configPathOverride: explicitProject ? options.configPathOverride : undefined,
      defaultModelConfigured
    })
    if (commands.length > 0) {
      l.write('info', 'Google Cloud STT + Document AI OCR Next Steps', {
        category: 'command',
        humanTable: createHumanTable(
          commands.map((command, index) => ({ step: index + 1, command })),
          ['step', 'command']
        )
      })
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
