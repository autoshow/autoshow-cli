import * as l from '~/utils/logger'
import { exec } from '~/utils/cli-utils'
import { readEnv } from '~/utils/validate/env-utils'
import { loadConfig, resolveConfigPath } from '~/cli/commands/setup-and-utilities/config/config-loader'

export const GCLOUD_DOCAI_LIMIT_SOURCE = 'project/links/gcloud-ocr-links.md'
export const GCLOUD_DOCAI_SYNC_BYTES = 20 * 1024 * 1024
export const GCLOUD_DOCAI_SYNC_PAGE_LIMIT = 15
export const GCLOUD_DOCAI_BATCH_BYTES = 1 * 1024 * 1024 * 1024
export const GCLOUD_DOCAI_BATCH_PAGE_LIMIT = 500

export type GcloudDocaiRuntimeConfig = {
  projectId: string
  location: string
  processorId: string
  accessToken: string
  bucket?: string | undefined
}

const GCLOUD_COMMAND_ENV = {
  CLOUDSDK_CORE_DISABLE_PROMPTS: '1'
} as const

const resolveGcloudBinary = (): string | undefined =>
  (readEnv('AUTOSHOW_GCLOUD_BIN')?.trim() || undefined)
  ?? (Bun.which('gcloud') ?? undefined)

const normalizeString = (value: string | undefined): string | undefined => {
  const trimmed = value?.trim()
  return trimmed && trimmed !== '(unset)' ? trimmed : undefined
}

const hasGcloudCli = (): boolean =>
  resolveGcloudBinary() !== undefined

export const runGcloud = async (
  args: string[]
): Promise<{ stdout: string, stderr: string, exitCode: number }> => {
  const binary = resolveGcloudBinary() ?? 'gcloud'
  return await exec(binary, args, { env: GCLOUD_COMMAND_ENV })
}

const readActiveProjectId = async (): Promise<string | undefined> => {
  const result = await runGcloud(['config', 'get-value', 'project', '--quiet'])
  if (result.exitCode !== 0) {
    return undefined
  }
  return normalizeString(result.stdout)
}

const getAccessToken = async (): Promise<string> => {
  const result = await runGcloud(['auth', 'print-access-token'])
  if (result.exitCode !== 0) {
    const detail = result.stderr.trim() || result.stdout.trim() || 'command failed'
    throw new Error(`gcloud auth failed: ${detail}. Run \`gcloud auth application-default login\` to authenticate.`)
  }
  return result.stdout.trim()
}

const resolveProcessorId = (model: string): string | undefined => {
  if (model === 'layout-parser') {
    return normalizeString(readEnv('AUTOSHOW_GCLOUD_DOCAI_LAYOUT_PROCESSOR_ID'))
  }
  return normalizeString(readEnv('AUTOSHOW_GCLOUD_DOCAI_OCR_PROCESSOR_ID'))
}

const readSavedDocaiDefaults = async (): Promise<{
  location?: string | undefined
  ocrProcessorId?: string | undefined
  layoutProcessorId?: string | undefined
  bucket?: string | undefined
}> => {
  const config = await loadConfig(await resolveConfigPath())
  const ocr = config.defaults?.extract?.ocr
  return {
    location: normalizeString(ocr?.gcloudDocaiLocation),
    ocrProcessorId: normalizeString(ocr?.gcloudDocaiOcrProcessorId),
    layoutProcessorId: normalizeString(ocr?.gcloudDocaiLayoutProcessorId),
    bucket: normalizeString(ocr?.gcloudDocaiBucket)
  }
}

export const setupGcloudDocai = async (): Promise<void> => {
  if (!hasGcloudCli()) {
    l.warn('gcloud CLI not found — Google Cloud Document AI OCR will not work until installed')
    l.write('info', 'Install the gcloud CLI: https://cloud.google.com/sdk/docs/install')
    return
  }

  const result = await runGcloud(['auth', 'print-access-token'])
  if (result.exitCode !== 0) {
    l.warn('gcloud auth not configured — Google Cloud Document AI OCR will not work until authenticated')
    l.write('info', 'Run `gcloud auth application-default login` to authenticate')
    return
  }

  const projectId = normalizeString(readEnv('AUTOSHOW_GCLOUD_PROJECT')) ?? await readActiveProjectId()
  if (!projectId) {
    l.warn('Google Cloud project not configured — Google Cloud Document AI OCR requires AUTOSHOW_GCLOUD_PROJECT or an active gcloud project')
    return
  }

  l.write('success', `gcloud CLI found, project ${projectId} — Google Cloud Document AI OCR ready`)
}

export const ensureGcloudDocaiSetup = async (model: string): Promise<GcloudDocaiRuntimeConfig> => {
  if (!hasGcloudCli()) {
    throw new Error('gcloud CLI is required for Google Cloud Document AI OCR. Install the gcloud CLI and rerun `bun as setup --gcloud`.')
  }

  const savedDefaults = await readSavedDocaiDefaults()
  const projectId = normalizeString(readEnv('AUTOSHOW_GCLOUD_PROJECT')) ?? await readActiveProjectId()
  if (!projectId) {
    throw new Error('Google Cloud project is required for Google Cloud Document AI OCR. Set AUTOSHOW_GCLOUD_PROJECT, run `gcloud config set project PROJECT_ID`, or rerun `bun as setup --gcloud --gcloud-project PROJECT_ID`.')
  }

  const location = normalizeString(readEnv('AUTOSHOW_GCLOUD_DOCAI_LOCATION')) ?? savedDefaults.location ?? 'us'

  const processorId = resolveProcessorId(model)
    ?? (model === 'layout-parser' ? savedDefaults.layoutProcessorId : savedDefaults.ocrProcessorId)
  if (!processorId) {
    const envVar = model === 'layout-parser'
      ? 'AUTOSHOW_GCLOUD_DOCAI_LAYOUT_PROCESSOR_ID'
      : 'AUTOSHOW_GCLOUD_DOCAI_OCR_PROCESSOR_ID'
    throw new Error(
      `${envVar} or saved AutoShow config is required for Google Cloud Document AI --gcloud-docai ${model}. ` +
      'Run `bun as setup --gcloud --gcloud-project PROJECT_ID` to create/save the OCR processor, or create a processor manually and save the processor ID.'
    )
  }

  const accessToken = await getAccessToken()

  return {
    projectId,
    location,
    processorId,
    accessToken,
    bucket: normalizeString(readEnv('AUTOSHOW_GCLOUD_BUCKET')) ?? savedDefaults.bucket
  }
}
