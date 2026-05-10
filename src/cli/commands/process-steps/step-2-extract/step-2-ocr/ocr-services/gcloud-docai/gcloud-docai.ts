import { exec } from '~/utils/cli-utils'
import { readEnv } from '~/utils/validate/env-utils'
import { loadConfig, resolveConfigPath } from '~/cli/commands/setup-and-utilities/config/config-loader'

export const GCLOUD_DOCAI_SYNC_BYTES = 20 * 1024 * 1024
export const GCLOUD_DOCAI_BATCH_BYTES = 1 * 1024 * 1024 * 1024

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

const resolveProcessorId = (): string | undefined =>
  normalizeString(readEnv('AUTOSHOW_GCLOUD_DOCAI_OCR_PROCESSOR_ID'))

type SavedDocaiDefaults = {
  location?: string | undefined
  ocrProcessorId?: string | undefined
  bucket?: string | undefined
}

const readSavedDocaiDefaults = async (): Promise<SavedDocaiDefaults> => {
  const config = await loadConfig(await resolveConfigPath())
  const ocr = config.defaults?.extract?.ocr
  return {
    location: normalizeString(ocr?.gcloudDocaiLocation),
    ocrProcessorId: normalizeString(ocr?.gcloudDocaiOcrProcessorId),
    bucket: normalizeString(ocr?.gcloudDocaiBucket)
  }
}

export const ensureGcloudDocaiSetup = async (): Promise<GcloudDocaiRuntimeConfig> => {
  if (!hasGcloudCli()) {
    throw new Error('gcloud CLI is required for Google Cloud Document AI OCR. Install the gcloud CLI and rerun `bun as setup --gcloud`.')
  }

  const envProjectId = normalizeString(readEnv('AUTOSHOW_GCLOUD_PROJECT'))
  const envLocation = normalizeString(readEnv('AUTOSHOW_GCLOUD_DOCAI_LOCATION'))
  const envProcessorId = resolveProcessorId()
  const envBucket = normalizeString(readEnv('AUTOSHOW_GCLOUD_BUCKET'))
  const shouldReadSavedDefaults = !envLocation || !envProcessorId || !envBucket
  const savedDefaults = shouldReadSavedDefaults ? await readSavedDocaiDefaults() : {}
  const projectId = envProjectId ?? await readActiveProjectId()
  if (!projectId) {
    throw new Error('Google Cloud project is required for Google Cloud Document AI OCR. Set AUTOSHOW_GCLOUD_PROJECT, run `gcloud config set project PROJECT_ID`, or rerun `bun as setup --gcloud --gcloud-project PROJECT_ID`.')
  }

  const location = envLocation ?? savedDefaults.location ?? 'us'

  const processorId = envProcessorId ?? savedDefaults.ocrProcessorId
  if (!processorId) {
    throw new Error(
      'AUTOSHOW_GCLOUD_DOCAI_OCR_PROCESSOR_ID or saved AutoShow config is required for Google Cloud Document AI --gcloud-docai ocr. ' +
      'Run `bun as setup --gcloud --gcloud-project PROJECT_ID` to create or discover the processor, then set the printed environment values or save the processor ID explicitly.'
    )
  }

  const accessToken = await getAccessToken()

  return {
    projectId,
    location,
    processorId,
    accessToken,
    bucket: envBucket ?? savedDefaults.bucket
  }
}
