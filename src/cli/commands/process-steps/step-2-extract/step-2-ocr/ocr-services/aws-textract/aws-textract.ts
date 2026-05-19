import { exec } from '~/utils/cli-utils'
import { readEnv } from '~/utils/validate/env-utils'
import { loadConfig, resolveConfigPath } from '~/cli/commands/setup-and-utilities/config/config-loader'
import { writeConfig } from '~/cli/commands/setup-and-utilities/config/config-writer'
import type { AutoshowConfig } from '~/types'

export const AWS_TEXTRACT_SYNC_BYTES = 10 * 1024 * 1024
export const AWS_TEXTRACT_ASYNC_FILE_SIZE_BYTES = 500 * 1024 * 1024

export type AwsTextractRuntimeConfig = {
  region: string
  bucket?: string | undefined
  configPath: string
}

const AWS_TEXTRACT_COMMAND_ENV = {
  AWS_PAGER: '',
  PAGER: ''
} as const

const AWS_TEXTRACT_BUCKET_PREFIX = 'autoshow-aws'

type AwsTextractSetupOptions = {
  preferredRegion?: string | undefined
  preferredBucket?: string | undefined
  configPath?: string | undefined
  requireBucket?: boolean | undefined
}

type AwsBucketAccess =
  | { ok: true, detail: 'accessible' }
  | { ok: false, detail: string, reason: 'not-found' | 'access-denied' | 'unknown' }

const normalizeString = (value: string | undefined): string | undefined => {
  const trimmed = value?.trim()
  return trimmed && trimmed.length > 0 ? trimmed : undefined
}

const readAwsCommandText = (stdout: string, stderr: string): string => {
  const stdoutText = stdout.trim()
  if (stdoutText.length > 0) {
    return stdoutText
  }

  const stderrText = stderr.trim()
  return stderrText.length > 0 ? stderrText : 'command failed'
}

const resolveAwsCliBinary = (): string | undefined =>
  normalizeString(readEnv('AUTOSHOW_AWS_BIN'))
  ?? (Bun.which('aws') ?? undefined)

const hasAwsCli = (): boolean =>
  resolveAwsCliBinary() !== undefined

export const runAws = async (
  args: string[]
): Promise<{ stdout: string, stderr: string, exitCode: number }> => {
  const awsCliBinary = resolveAwsCliBinary() ?? 'aws'
  return await exec(awsCliBinary, args, { env: AWS_TEXTRACT_COMMAND_ENV })
}

const readSavedAwsDefaults = async (
  configPath: string
): Promise<{ preferredRegion?: string | undefined, preferredBucket?: string | undefined }> => {
  const config = await loadConfig(configPath)
  return {
    ...(normalizeString(config.defaults?.extract?.stt?.awsRegion) ? { preferredRegion: normalizeString(config.defaults?.extract?.stt?.awsRegion) } : {}),
    ...(normalizeString(config.defaults?.extract?.stt?.awsBucket) ? { preferredBucket: normalizeString(config.defaults?.extract?.stt?.awsBucket) } : {})
  }
}

const resolveAwsTextractRegion = async (
  preferredRegion: string | undefined,
  savedRegion: string | undefined
): Promise<string> => {
  const directRegion = normalizeString(preferredRegion)
    ?? normalizeString(savedRegion)
    ?? normalizeString(readEnv('AWS_REGION'))
    ?? normalizeString(readEnv('AWS_DEFAULT_REGION'))
  if (directRegion) {
    return directRegion
  }

  const configuredRegion = await runAws(['configure', 'get', 'region'])
  return normalizeString(configuredRegion.stdout) ?? 'us-east-1'
}

const readAwsCallerAccount = async (): Promise<string | undefined> => {
  const stsResult = await runAws(['sts', 'get-caller-identity', '--output', 'json'])
  if (stsResult.exitCode !== 0) {
    throw new Error('AWS CLI credentials are required for AWS Textract OCR. Run `aws configure` or set AWS_PROFILE before retrying.')
  }

  try {
    const parsed = JSON.parse(stsResult.stdout) as { Account?: unknown }
    return typeof parsed.Account === 'string' ? parsed.Account : undefined
  } catch {
    return undefined
  }
}

const lower = (value: string): string => value.toLowerCase()

const isBucketNotFound = (detail: string): boolean => {
  const text = lower(detail)
  return text.includes('nosuchbucket')
    || text.includes('not found')
    || text.includes('notfound')
    || text.includes('(404)')
    || text.includes('status code: 404')
}

const isBucketAccessDenied = (detail: string): boolean => {
  const text = lower(detail)
  return text.includes('accessdenied')
    || text.includes('access denied')
    || text.includes('forbidden')
    || text.includes('(403)')
    || text.includes('status code: 403')
}

const isBucketAlreadyExists = (detail: string): boolean =>
  lower(detail).includes('bucketalreadyexists')

const isBucketAlreadyOwnedByYou = (detail: string): boolean =>
  lower(detail).includes('bucketalreadyownedbyyou')

const verifyBucketAccess = async (
  bucket: string,
  region: string
): Promise<AwsBucketAccess> => {
  const result = await runAws(['s3api', 'head-bucket', '--bucket', bucket, '--region', region])
  if (result.exitCode === 0) {
    return { ok: true, detail: 'accessible' }
  }

  const detail = readAwsCommandText(result.stdout, result.stderr)
  if (isBucketNotFound(detail)) {
    return { ok: false, detail, reason: 'not-found' }
  }
  if (isBucketAccessDenied(detail)) {
    return { ok: false, detail, reason: 'access-denied' }
  }
  return { ok: false, detail, reason: 'unknown' }
}

const buildSuggestedAwsTextractBucketName = (
  accountId: string | undefined,
  region: string
): string => {
  const normalizedAccountId = (accountId ?? '')
    .replace(/[^0-9]/g, '')
    .slice(0, 12)
  const suffix = crypto.randomUUID().replace(/-/g, '').slice(0, 10)
  const parts = [
    AWS_TEXTRACT_BUCKET_PREFIX,
    ...(normalizedAccountId ? [normalizedAccountId] : []),
    region.toLowerCase(),
    suffix
  ]

  return parts.join('-').slice(0, 63).replace(/-+$/g, '')
}

const createAwsTextractStagingBucket = async (
  bucket: string,
  region: string
): Promise<void> => {
  const createArgs = [
    's3api',
    'create-bucket',
    '--bucket',
    bucket,
    '--region',
    region,
    ...(region === 'us-east-1' ? [] : ['--create-bucket-configuration', `LocationConstraint=${region}`])
  ]
  const createResult = await runAws(createArgs)
  if (createResult.exitCode !== 0) {
    const detail = readAwsCommandText(createResult.stdout, createResult.stderr)
    if (!isBucketAlreadyOwnedByYou(detail)) {
      if (isBucketAlreadyExists(detail)) {
        throw new Error(`AWS S3 bucket "${bucket}" is unavailable globally. Choose a different --aws-bucket name or omit --aws-bucket to let AutoShow generate one.`)
      }
      throw new Error(`AWS S3 bucket creation failed for "${bucket}" in region "${region}" for AWS Textract staging: ${detail}`)
    }
  }

  const waitResult = await runAws(['s3api', 'wait', 'bucket-exists', '--bucket', bucket, '--region', region])
  if (waitResult.exitCode !== 0) {
    throw new Error(`AWS S3 bucket "${bucket}" was created for AWS Textract staging but did not become ready: ${readAwsCommandText(waitResult.stdout, waitResult.stderr)}`)
  }
}

const persistAwsTextractDefaults = async (
  configPath: string,
  region: string,
  bucket: string
): Promise<void> => {
  const current = await loadConfig(configPath)
  const next: AutoshowConfig = {
    ...current,
    defaults: {
      ...current.defaults,
      extract: {
        ...current.defaults?.extract,
        stt: {
          ...current.defaults?.extract?.stt,
          awsRegion: region,
          awsBucket: bucket
        }
      }
    }
  }
  await writeConfig(configPath, next as unknown as Record<string, unknown>)
}

const ensureAwsTextractStagingBucket = async (
  options: {
    configuredBucket?: string | undefined
    region: string
    callerAccount?: string | undefined
    configPath: string
  }
): Promise<string> => {
  const configuredBucket = normalizeString(options.configuredBucket)
  const bucket = configuredBucket ?? buildSuggestedAwsTextractBucketName(options.callerAccount, options.region)
  const access = configuredBucket
    ? await verifyBucketAccess(bucket, options.region)
    : undefined

  if (access?.ok === true) {
    return bucket
  }

  if (access?.ok === false && access.reason === 'access-denied') {
    throw new Error(`AWS S3 bucket "${bucket}" is not accessible in region "${options.region}" for AWS Textract staging: ${access.detail}. Choose a bucket this AWS identity can access, or omit --aws-bucket to let AutoShow create one.`)
  }

  if (access?.ok === false && access.reason === 'unknown') {
    throw new Error(`AWS S3 bucket "${bucket}" could not be verified in region "${options.region}" for AWS Textract staging: ${access.detail}`)
  }

  await createAwsTextractStagingBucket(bucket, options.region)
  const createdAccess = await verifyBucketAccess(bucket, options.region)
  if (createdAccess.ok !== true) {
    throw new Error(`AWS S3 bucket "${bucket}" was created but is not accessible in region "${options.region}" for AWS Textract staging: ${createdAccess.detail}`)
  }

  await persistAwsTextractDefaults(options.configPath, options.region, bucket)
  return bucket
}

export const ensureAwsTextractSetup = async (
  options: AwsTextractSetupOptions = {}
): Promise<AwsTextractRuntimeConfig> => {
  if (!hasAwsCli()) {
    throw new Error('AWS CLI is required for AWS Textract OCR. Install the AWS CLI and rerun `bun as setup --aws`.')
  }

  const configPath = await resolveConfigPath(options.configPath)
  const savedDefaults = await readSavedAwsDefaults(configPath)
  const region = await resolveAwsTextractRegion(options.preferredRegion, savedDefaults.preferredRegion)
  const callerAccount = await readAwsCallerAccount()
  const configuredBucket = normalizeString(options.preferredBucket) ?? savedDefaults.preferredBucket
  const bucket = options.requireBucket === true
    ? await ensureAwsTextractStagingBucket({
        configuredBucket,
        region,
        callerAccount,
        configPath
      })
    : configuredBucket

  return {
    region,
    ...(bucket ? { bucket } : {}),
    configPath
  }
}
