import * as l from '~/utils/logger'
import { exec } from '~/utils/cli-utils'
import { readEnv } from '~/utils/validate/env-utils'
import { loadConfig, resolveConfigPath } from '~/cli/commands/setup-and-utilities/config/config-loader'
import { writeConfig } from '~/cli/commands/setup-and-utilities/config/config-writer'
import {
  ensureDocumentAiOcrProcessor,
  ensureGcloudDocaiBucket
} from '~/cli/commands/process-steps/step-2-extract/step-2-stt/stt-services/gcloud/gcloud-docai-setup'

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

const persistDocaiAutoSetupDefaults = async (
  location: string,
  ocrProcessorId: string,
  bucket: string
): Promise<void> => {
  const configPath = await resolveConfigPath()
  const current = await loadConfig(configPath)
  const currentOcr = current.defaults?.extract?.ocr
  const next = {
    ...current,
    defaults: {
      ...current.defaults,
      extract: {
        ...current.defaults?.extract,
        ocr: {
          ...currentOcr,
          gcloudDocaiLocation: location,
          gcloudDocaiOcrProcessorId: ocrProcessorId,
          gcloudDocaiBucket: bucket
        }
      }
    }
  }
  await writeConfig(configPath, next as unknown as Record<string, unknown>)
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

  let processorId = envProcessorId ?? savedDefaults.ocrProcessorId
  let bucket = envBucket ?? savedDefaults.bucket

  if (!processorId) {
    l.write('warn', `Document AI OCR processor not configured for project ${projectId}. Running automatic setup...`)

    try {
      const accessToken = await getAccessToken()

      const processorResult = await ensureDocumentAiOcrProcessor(
        projectId, location, accessToken, undefined
      )
      if (!processorResult.processorId) {
        throw new Error('Could not find or create a processor.')
      }
      processorId = processorResult.processorId
      l.write('info', `Document AI OCR processor ${processorResult.detail}`)

      if (!bucket) {
        const bucketResult = await ensureGcloudDocaiBucket(projectId, location, undefined)
        if (bucketResult.ok && bucketResult.bucket) {
          bucket = bucketResult.bucket
          l.write('info', `Document AI GCS bucket ${bucketResult.detail}`)
        } else {
          l.write('warn', `Document AI GCS bucket setup issue: ${bucketResult.detail}. Large-file batch OCR may not work.`)
        }
      }

      if (processorId && bucket) {
        await persistDocaiAutoSetupDefaults(location, processorId, bucket)
        l.write('info', 'Document AI OCR setup saved to config. Future runs will reuse these settings.')
      }

      return { projectId, location, processorId, accessToken, bucket }
    } catch (autoSetupError) {
      const detail = autoSetupError instanceof Error ? autoSetupError.message : String(autoSetupError)
      throw new Error(
        `Automatic Document AI OCR setup failed: ${detail}. ` +
        `Run \`bun as setup --gcloud --gcloud-project ${projectId}\` to set up manually.`
      )
    }
  }

  const accessToken = await getAccessToken()

  return {
    projectId,
    location,
    processorId,
    accessToken,
    bucket
  }
}
