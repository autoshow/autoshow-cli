import * as l from '~/utils/logger'
import { exec } from '~/utils/cli-utils'
import { readEnv } from '~/utils/validate/env-utils'

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

const hasGcloudCli = (): boolean =>
  resolveGcloudBinary() !== undefined

export const runGcloud = async (
  args: string[]
): Promise<{ stdout: string, stderr: string, exitCode: number }> => {
  const binary = resolveGcloudBinary() ?? 'gcloud'
  return await exec(binary, args, { env: GCLOUD_COMMAND_ENV })
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
    return readEnv('AUTOSHOW_GCLOUD_DOCAI_LAYOUT_PROCESSOR_ID')?.trim() || undefined
  }
  return readEnv('AUTOSHOW_GCLOUD_DOCAI_OCR_PROCESSOR_ID')?.trim() || undefined
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

  const projectId = readEnv('AUTOSHOW_GCLOUD_PROJECT')?.trim()
  if (!projectId) {
    l.warn('AUTOSHOW_GCLOUD_PROJECT not set — Google Cloud Document AI OCR requires a project ID')
    return
  }

  l.write('success', `gcloud CLI found, project ${projectId} — Google Cloud Document AI OCR ready`)
}

export const ensureGcloudDocaiSetup = async (model: string): Promise<GcloudDocaiRuntimeConfig> => {
  if (!hasGcloudCli()) {
    throw new Error('gcloud CLI is required for Google Cloud Document AI OCR. Install the gcloud CLI and rerun `bun as setup --gcloud`.')
  }

  const projectId = readEnv('AUTOSHOW_GCLOUD_PROJECT')?.trim()
  if (!projectId) {
    throw new Error('AUTOSHOW_GCLOUD_PROJECT environment variable is required for Google Cloud Document AI OCR.')
  }

  const location = readEnv('AUTOSHOW_GCLOUD_DOCAI_LOCATION')?.trim() || 'us'

  const processorId = resolveProcessorId(model)
  if (!processorId) {
    const envVar = model === 'layout-parser'
      ? 'AUTOSHOW_GCLOUD_DOCAI_LAYOUT_PROCESSOR_ID'
      : 'AUTOSHOW_GCLOUD_DOCAI_OCR_PROCESSOR_ID'
    throw new Error(
      `${envVar} environment variable is required for Google Cloud Document AI --gcloud-docai ${model}. ` +
      'Create a processor in the Google Cloud Console and set the processor ID.'
    )
  }

  const accessToken = await getAccessToken()

  return {
    projectId,
    location,
    processorId,
    accessToken,
    bucket: readEnv('AUTOSHOW_GCLOUD_BUCKET')?.trim() || undefined
  }
}
