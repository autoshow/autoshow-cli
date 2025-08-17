import { l, err } from '@/logging'
import { execPromise } from '@/node-utils'
import type { ProcessingOptions } from '@/types'

export async function getAccountIdForService(options: ProcessingOptions): Promise<string> {
  const p = '[save/services/s3]'
  
  if (options.save === 'r2') {
    const cloudflareAccountId = process.env['CLOUDFLARE_ACCOUNT_ID']
    if (cloudflareAccountId && isValidCloudflareAccountId(cloudflareAccountId)) {
      l.dim(`${p} Using Cloudflare account ID: ${cloudflareAccountId}`)
      return cloudflareAccountId
    } else if (cloudflareAccountId) {
      err(`${p} Invalid CLOUDFLARE_ACCOUNT_ID format: ${cloudflareAccountId}`)
      err(`${p} Expected a 32-character hex string (e.g., c6494d4164a5eb0cd3848193bd552d68)`)
      return 'invalid-account-id'
    }
  }
  
  try {
    const command = 'aws sts get-caller-identity --query Account --output text'
    const { stdout } = await execPromise(command)
    const accountId = stdout.trim()
    l.dim(`${p} Retrieved AWS account ID: ${accountId}`)
    return accountId
  } catch (error) {
    err(`${p} Failed to get account ID: ${(error as Error).message}`)
    return 'unknown'
  }
}

export function getRegionForService(options: ProcessingOptions): string {
  if (options.save === 'r2') {
    return 'auto'
  }
  return process.env['AWS_REGION'] || 'us-east-1'
}

export function getEndpointFlag(options: ProcessingOptions): string {
  const p = '[save/services/s3]'
  if (options.save === 'r2') {
    const accountId = process.env['CLOUDFLARE_ACCOUNT_ID']
    if (!accountId) {
      err(`${p} CLOUDFLARE_ACCOUNT_ID is required for R2`)
      return ''
    }
    if (!isValidCloudflareAccountId(accountId)) {
      err(`${p} Invalid CLOUDFLARE_ACCOUNT_ID format: ${accountId}`)
      return ''
    }
    return ` --endpoint-url "https://${accountId}.r2.cloudflarestorage.com"`
  }
  return ''
}

export function getPublicUrl(options: ProcessingOptions, bucketName: string, s3Key: string): string {
  const p = '[save/services/s3]'
  l.dim(`${p} Generating public URL for ${options.save}`)
  
  if (options.save === 'r2') {
    const accountId = process.env['CLOUDFLARE_ACCOUNT_ID'] || 'unknown'
    return `https://${accountId}.r2.cloudflarestorage.com/${bucketName}/${s3Key}`
  }
  return `https://${bucketName}.s3.amazonaws.com/${s3Key}`
}

function isValidCloudflareAccountId(accountId: string): boolean {
  const hexPattern = /^[a-f0-9]{32}$/i
  return hexPattern.test(accountId)
}