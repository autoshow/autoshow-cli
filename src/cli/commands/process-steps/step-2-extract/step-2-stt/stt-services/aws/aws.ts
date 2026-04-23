import * as v from 'valibot'
import * as l from '~/utils/logger'
import { createHumanTable } from '~/utils/logger/human-table'
import { exec } from '~/utils/cli-utils'
import { loadConfig, resolveConfigPath } from '~/cli/commands/setup-and-utilities/config/config-loader'
import { deepMergeConfig } from '~/cli/commands/setup-and-utilities/config/config-merge'
import { writeConfig } from '~/cli/commands/setup-and-utilities/config/config-writer'
import { readEnv } from '~/utils/validate/env-utils'
import { validateData } from '~/utils/validate/validation'
import type {
  AwsCallerIdentity,
  AwsSttConfigDefaults,
  AwsSttReadiness,
  AwsSttRuntimeConfig
} from '~/types'

const AWS_STT_COMMAND_ENV = {
  AWS_PAGER: '',
  PAGER: ''
} as const

export const AwsCallerIdentitySchema = v.object({
  Account: v.string(),
  Arn: v.string(),
  UserId: v.string()
})

export const AWS_STT_DEFAULT_MODEL = 'standard'
export const AWS_STT_DEFAULT_MAX_SPEAKERS = 30
const AWS_STT_BUCKET_PREFIX = 'autoshow-transcribe'

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

const runAws = async (
  args: string[]
): Promise<{ stdout: string, stderr: string, exitCode: number }> => {
  const awsCliBinary = resolveAwsCliBinary() ?? 'aws'
  return await exec(awsCliBinary, args, { env: AWS_STT_COMMAND_ENV })
}

const buildSuggestedAwsBucketName = (
  accountId: string | undefined,
  region: string
): string => {
  const normalizedAccountId = (accountId ?? '')
    .replace(/[^0-9]/g, '')
    .slice(0, 12)
  const suffix = crypto.randomUUID().replace(/-/g, '').slice(0, 10)
  const parts = [
    AWS_STT_BUCKET_PREFIX,
    ...(normalizedAccountId ? [normalizedAccountId] : []),
    region.toLowerCase(),
    suffix
  ]

  return parts.join('-').slice(0, 63).replace(/-+$/g, '')
}

const buildAwsSetupCreateBucketCommand = (
  options: {
    region?: string | undefined
    bucket?: string | undefined
  } = {}
): string => {
  const args = ['bun as setup', '--aws', '--aws-create-bucket']
  if (options.region) {
    args.push('--aws-region', options.region)
  }
  if (options.bucket) {
    args.push('--aws-bucket', options.bucket)
  }
  return args.join(' ')
}

const saveAwsSttDefaults = async (
  options: {
    region: string
    bucket: string
    configPathOverride?: string | undefined
  }
): Promise<string> => {
  const configPath = await resolveConfigPath(options.configPathOverride)
  const current = await loadConfig(configPath)
  const updated = deepMergeConfig(current as Record<string, unknown>, {
    version: 2,
    defaults: {
      extract: {
        stt: {
          awsRegion: options.region,
          awsBucket: options.bucket,
          awsStt: [AWS_STT_DEFAULT_MODEL]
        }
      }
    }
  })
  await writeConfig(configPath, updated)
  return configPath
}

const createAwsStagingBucket = async (
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
    if (!detail.includes('BucketAlreadyOwnedByYou')) {
      if (detail.includes('BucketAlreadyExists')) {
        throw new Error(`AWS S3 bucket "${bucket}" is unavailable. Choose a different name or rerun \`bun as setup --aws --aws-create-bucket\` without \`--aws-bucket\` to auto-generate one.`)
      }
      throw new Error(`AWS S3 bucket creation failed for "${bucket}" in region "${region}": ${detail}`)
    }
  }

  const waitResult = await runAws(['s3api', 'wait', 'bucket-exists', '--bucket', bucket, '--region', region])
  if (waitResult.exitCode !== 0) {
    throw new Error(`AWS S3 bucket "${bucket}" was created but did not become ready: ${readAwsCommandText(waitResult.stdout, waitResult.stderr)}`)
  }
}

const readAwsCallerIdentity = async (): Promise<{ ok: boolean, detail: string, callerIdentity?: AwsCallerIdentity | undefined }> => {
  const result = await runAws(['sts', 'get-caller-identity', '--output', 'json'])
  if (result.exitCode !== 0) {
    return {
      ok: false,
      detail: readAwsCommandText(result.stdout, result.stderr)
    }
  }

  try {
    return {
      ok: true,
      detail: 'configured',
      callerIdentity: validateData(AwsCallerIdentitySchema, JSON.parse(result.stdout), 'AWS sts get-caller-identity response')
    }
  } catch (error) {
    return {
      ok: false,
      detail: error instanceof Error ? error.message : String(error)
    }
  }
}

export const resolveAwsCliRegion = async (
  preferredRegion?: string | undefined
): Promise<string | undefined> => {
  const explicitRegion = normalizeString(preferredRegion)
    ?? normalizeString(readEnv('AWS_REGION'))
    ?? normalizeString(readEnv('AWS_DEFAULT_REGION'))
  if (explicitRegion) {
    return explicitRegion
  }

  if (!hasAwsCli()) {
    return undefined
  }

  const configuredRegion = await runAws(['configure', 'get', 'region'])
  if (configuredRegion.exitCode !== 0) {
    return undefined
  }

  return normalizeString(configuredRegion.stdout)
}

export const readAwsSttConfigDefaults = async (): Promise<AwsSttConfigDefaults> => {
  try {
    const configPath = await resolveConfigPath()
    if (!await Bun.file(configPath).exists()) {
      return {}
    }

    const config = await loadConfig(configPath)
    return {
      ...(normalizeString(config.defaults?.extract?.stt?.awsRegion) ? { preferredRegion: normalizeString(config.defaults?.extract?.stt?.awsRegion) } : {}),
      ...(normalizeString(config.defaults?.extract?.stt?.awsBucket) ? { preferredBucket: normalizeString(config.defaults?.extract?.stt?.awsBucket) } : {})
    }
  } catch {
    return {}
  }
}

const resolveAwsSttRuntimePreferences = async (
  options: AwsSttConfigDefaults
): Promise<Required<AwsSttConfigDefaults>> => {
  const savedDefaults = await readAwsSttConfigDefaults()

  return {
    preferredRegion: normalizeString(options.preferredRegion) ?? savedDefaults.preferredRegion,
    preferredBucket: normalizeString(options.preferredBucket) ?? savedDefaults.preferredBucket
  }
}

const verifyBucketAccess = async (
  bucket: string,
  region: string
): Promise<{ ok: boolean, detail: string }> => {
  const result = await runAws(['s3api', 'head-bucket', '--bucket', bucket, '--region', region])
  return {
    ok: result.exitCode === 0,
    detail: result.exitCode === 0 ? 'accessible' : readAwsCommandText(result.stdout, result.stderr)
  }
}

const verifyTranscribeAccess = async (
  region: string
): Promise<{ ok: boolean, detail: string }> => {
  const result = await runAws(['transcribe', 'list-transcription-jobs', '--region', region, '--max-results', '1', '--output', 'json'])
  return {
    ok: result.exitCode === 0,
    detail: result.exitCode === 0 ? 'accessible' : readAwsCommandText(result.stdout, result.stderr)
  }
}

export const resolveAwsMaxSpeakerLabels = (
  speakerCount?: number | undefined
): number => {
  if (typeof speakerCount === 'number' && Number.isFinite(speakerCount) && speakerCount >= 1) {
    return Math.floor(speakerCount)
  }

  return AWS_STT_DEFAULT_MAX_SPEAKERS
}

export const readAwsSttReadiness = async (
  options: {
    preferredRegion?: string | undefined
    preferredBucket?: string | undefined
    verifyTranscribe?: boolean | undefined
  } = {}
): Promise<AwsSttReadiness> => {
  const bucket = normalizeString(options.preferredBucket)

  if (!hasAwsCli()) {
    return {
      hasCli: false,
      authConfigured: false,
      ...(bucket ? { bucket } : {}),
      details: {
        cli: 'not found',
        auth: 'skipped',
        region: 'skipped',
        bucket: bucket ? 'skipped' : 'not configured',
        transcribe: 'skipped'
      }
    }
  }

  const cliPath = resolveAwsCliBinary() ?? 'aws'
  const callerIdentity = await readAwsCallerIdentity()
  const region = await resolveAwsCliRegion(options.preferredRegion)
  const bucketAccess = bucket && region && callerIdentity.ok
    ? await verifyBucketAccess(bucket, region)
    : undefined
  const transcribeAccess = region && callerIdentity.ok && options.verifyTranscribe !== false
    ? await verifyTranscribeAccess(region)
    : undefined

  return {
    hasCli: true,
    authConfigured: callerIdentity.ok,
    ...(region ? { region } : {}),
    ...(bucket ? { bucket } : {}),
    ...(bucketAccess ? { bucketAccessible: bucketAccess.ok } : {}),
    ...(transcribeAccess ? { transcribeAccessible: transcribeAccess.ok } : {}),
    ...(callerIdentity.callerIdentity ? { callerIdentity: callerIdentity.callerIdentity } : {}),
    details: {
      cli: cliPath,
      auth: callerIdentity.detail,
      region: region ?? 'not configured',
      bucket: bucket
        ? bucketAccess?.detail ?? (callerIdentity.ok && region ? 'not verified' : 'skipped')
        : 'not configured',
      transcribe: transcribeAccess?.detail ?? (callerIdentity.ok && region ? 'not verified' : 'skipped')
    }
  }
}

const buildAwsSetupCommands = (
  state: AwsSttReadiness,
  options: {
    explicitBucket?: string | undefined
  } = {}
): string[] => {
  const region = state.region ?? 'us-east-1'
  const commands: string[] = []

  if (!state.authConfigured) {
    commands.push('aws configure')
  }
  if (!state.region) {
    commands.push(`aws configure set region ${region}`)
  }
  if (state.bucket && state.region && state.bucketAccessible === false) {
    commands.push(`aws s3api head-bucket --bucket ${state.bucket} --region ${state.region}`)
  }
  if (state.bucket && state.bucketAccessible === false) {
    commands.push(buildAwsSetupCreateBucketCommand({
      ...(region ? { region } : {}),
      ...(options.explicitBucket ? { bucket: options.explicitBucket } : {})
    }))
  }
  if (state.region && state.authConfigured && state.transcribeAccessible === false) {
    commands.push(`aws transcribe list-transcription-jobs --region ${state.region} --max-results 1 --output json`)
  }

  return commands
}

const resolveAwsSttReadinessState = async (
  options: {
    preferredRegion?: string | undefined
    preferredBucket?: string | undefined
    verifyTranscribe?: boolean | undefined
    autoCreateBucket?: boolean | undefined
    autoCreateMissingBucket?: boolean | undefined
    configPathOverride?: string | undefined
  } = {}
): Promise<{ state: AwsSttReadiness, configPath?: string | undefined }> => {
  const explicitBucket = normalizeString(options.preferredBucket)
  let configPath: string | undefined
  let state = await readAwsSttReadiness({
    preferredRegion: options.preferredRegion,
    preferredBucket: options.preferredBucket,
    verifyTranscribe: options.verifyTranscribe
  })

  const shouldAutoCreateMissingBucket = options.autoCreateMissingBucket === true && !state.bucket
  const shouldAutoCreateRequestedBucket = options.autoCreateBucket === true && !!state.bucket && state.bucketAccessible !== true
  if ((shouldAutoCreateMissingBucket || shouldAutoCreateRequestedBucket) && state.hasCli && state.authConfigured && state.region) {
    const bucketToCreate = explicitBucket
      ?? state.bucket
      ?? buildSuggestedAwsBucketName(state.callerIdentity?.Account, state.region)
    await createAwsStagingBucket(bucketToCreate, state.region)
    configPath = await saveAwsSttDefaults({
      region: state.region,
      bucket: bucketToCreate,
      configPathOverride: options.configPathOverride
    })
    state = await readAwsSttReadiness({
      preferredRegion: state.region,
      preferredBucket: bucketToCreate,
      verifyTranscribe: options.verifyTranscribe
    })
  }

  return { state, ...(configPath ? { configPath } : {}) }
}

export const setupAwsStt = async (
  options: {
    preferredRegion?: string | undefined
    preferredBucket?: string | undefined
    focused?: boolean | undefined
    verifyTranscribe?: boolean | undefined
    autoCreateBucket?: boolean | undefined
    autoCreateMissingBucket?: boolean | undefined
    configPathOverride?: string | undefined
  } = {}
): Promise<void> => {
  const explicitBucket = normalizeString(options.preferredBucket)
  const { state, configPath } = await resolveAwsSttReadinessState(options)

  if (options.focused) {
    l.write('info', 'AWS STT setup')
  }

  const checkRows = [
    { status: state.hasCli ? 'OK' : 'MISSING', check: 'aws', detail: state.details.cli },
    { status: state.authConfigured ? 'OK' : 'MISSING', check: 'aws auth', detail: state.details.auth },
    { status: state.region ? 'OK' : 'MISSING', check: 'aws region', detail: state.region ?? state.details.region },
    state.bucket
      ? { status: state.bucketAccessible === true ? 'OK' : 'MISSING', check: 'aws bucket', detail: `${state.bucket} (${state.details.bucket})` }
      : { status: 'INFO', check: 'aws bucket', detail: 'not configured' },
    ...(state.region && state.authConfigured
      ? [{ status: state.transcribeAccessible === true ? 'OK' : 'MISSING', check: 'aws transcribe', detail: state.details.transcribe }]
      : []),
    ...(configPath ? [{ status: 'OK', check: 'aws config', detail: `saved ${configPath}` }] : [])
  ]

  l.write(checkRows.some((row) => row.status === 'MISSING') ? 'warn' : 'success', 'AWS STT checks', {
    category: 'command',
    humanTable: createHumanTable(checkRows, ['status', 'check', 'detail'])
  })

  if (options.focused) {
    const commands = buildAwsSetupCommands(state, {
      explicitBucket
    })
    if (commands.length > 0) {
      l.write('info', 'AWS STT Next Steps', {
        category: 'command',
        humanTable: createHumanTable(
          commands.map((command, index) => ({ step: index + 1, command })),
          ['step', 'command']
        )
      })
    }
  }
}

export const ensureAwsSttSetup = async (
  options: {
    preferredRegion?: string | undefined
    preferredBucket?: string | undefined
  } = {}
): Promise<AwsSttRuntimeConfig> => {
  const runtimePreferences = await resolveAwsSttRuntimePreferences({
    preferredRegion: options.preferredRegion,
    preferredBucket: options.preferredBucket
  })
  const { state } = await resolveAwsSttReadinessState({
    preferredRegion: runtimePreferences.preferredRegion,
    preferredBucket: runtimePreferences.preferredBucket,
    verifyTranscribe: false,
    autoCreateMissingBucket: true
  })

  if (!state.hasCli) {
    throw new Error('AWS CLI is required for AWS transcription. Install the AWS CLI and rerun `bun as setup --aws`.')
  }

  if (!state.authConfigured) {
    throw new Error('AWS CLI credentials are required for AWS transcription. Run `aws configure` or set AWS_PROFILE before retrying.')
  }

  if (!state.region) {
    throw new Error('AWS region is required for AWS transcription. Set --aws-region, save `bun as config --aws-region ...`, or configure AWS_REGION/AWS_DEFAULT_REGION with `aws configure`.')
  }

  if (!state.bucket) {
    throw new Error('AWS S3 bucket is required for AWS transcription. Run `bun as setup --aws` to create and save one automatically when none is configured, or set --aws-bucket / save `bun as config --aws-region us-east-1 --aws-bucket <bucket-name> --aws-stt standard`.')
  }

  if (state.bucketAccessible !== true) {
    throw new Error(`AWS S3 bucket "${state.bucket}" is not accessible in region "${state.region}" for AWS transcription. Verify permissions with \`aws s3api head-bucket --bucket ${state.bucket} --region ${state.region}\`.`)
  }

  return {
    region: state.region,
    bucket: state.bucket
  }
}
