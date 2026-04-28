import { exec } from '~/utils/cli-utils'
import { readEnv } from '~/utils/validate/env-utils'
import { resolveAwsCliRegion, readAwsSttConfigDefaults } from '~/cli/commands/process-steps/step-2-extract/step-2-stt/stt-services/aws/aws'

export const AWS_TEXTRACT_SYNC_BYTES = 10 * 1024 * 1024
export const AWS_TEXTRACT_ASYNC_FILE_SIZE_BYTES = 500 * 1024 * 1024

export type AwsTextractRuntimeConfig = {
  region: string
  bucket?: string | undefined
}

const AWS_TEXTRACT_COMMAND_ENV = {
  AWS_PAGER: '',
  PAGER: ''
} as const

const resolveAwsCliBinary = (): string | undefined =>
  (readEnv('AUTOSHOW_AWS_BIN')?.trim() || undefined)
  ?? (Bun.which('aws') ?? undefined)

const hasAwsCli = (): boolean =>
  resolveAwsCliBinary() !== undefined

export const runAws = async (
  args: string[]
): Promise<{ stdout: string, stderr: string, exitCode: number }> => {
  const awsCliBinary = resolveAwsCliBinary() ?? 'aws'
  return await exec(awsCliBinary, args, { env: AWS_TEXTRACT_COMMAND_ENV })
}

export const ensureAwsTextractSetup = async (): Promise<AwsTextractRuntimeConfig> => {
  if (!hasAwsCli()) {
    throw new Error('AWS CLI is required for AWS Textract OCR. Install the AWS CLI and rerun `bun as setup --aws`.')
  }

  const savedDefaults = await readAwsSttConfigDefaults()
  const region = await resolveAwsCliRegion(savedDefaults.preferredRegion)
  if (!region) {
    throw new Error('AWS region is required for AWS Textract OCR. Set --aws-region, save `bun as config --aws-region ...`, or configure AWS_REGION/AWS_DEFAULT_REGION with `aws configure`.')
  }

  const stsResult = await runAws(['sts', 'get-caller-identity', '--output', 'json'])
  if (stsResult.exitCode !== 0) {
    throw new Error('AWS CLI credentials are required for AWS Textract OCR. Run `aws configure` or set AWS_PROFILE before retrying.')
  }

  return {
    region,
    bucket: savedDefaults.preferredBucket
  }
}
