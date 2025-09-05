import { err } from '@/logging'
import { execPromise } from '@/node-utils'

export async function getAwsAccountId(): Promise<string> {
  const p = '[save/aws/utils]'
  
  try {
    const command = 'aws sts get-caller-identity --query Account --output text'
    const { stdout } = await execPromise(command)
    const accountId = stdout.trim()
    return accountId
  } catch (error) {
    err(`${p} Failed to get AWS account ID: ${(error as Error).message}`)
    return 'unknown'
  }
}

export function getAwsRegion(): string {
  return process.env['AWS_REGION'] || 'us-east-1'
}

export function getAwsEndpoint(): string {
  return ''
}

export function getAwsPublicUrl(bucketName: string, s3Key: string): string {
  return `https://${bucketName}.s3.amazonaws.com/${s3Key}`
}