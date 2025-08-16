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
  
  if (options.save === 'b2') {
    const b2KeyId = process.env['B2_APPLICATION_KEY_ID']
    if (b2KeyId) {
      l.dim(`${p} Using B2 key ID for account identification: ${b2KeyId}`)
      return b2KeyId.slice(0, 12)
    }
  }
  
  try {
    const command = options.save === 'b2' 
      ? buildCommandWithEnv('aws sts get-caller-identity --query Account --output text', options)
      : 'aws sts get-caller-identity --query Account --output text'
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
  if (options.save === 'b2') {
    return process.env['B2_REGION'] || 'us-west-004'
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
  if (options.save === 'b2') {
    const region = getRegionForService(options)
    return ` --endpoint-url "https://s3.${region}.backblazeb2.com"`
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
  if (options.save === 'b2') {
    const region = getRegionForService(options)
    return `https://s3.${region}.backblazeb2.com/${bucketName}/${s3Key}`
  }
  return `https://${bucketName}.s3.amazonaws.com/${s3Key}`
}

function isValidCloudflareAccountId(accountId: string): boolean {
  const hexPattern = /^[a-f0-9]{32}$/i
  return hexPattern.test(accountId)
}

function buildCommandWithEnv(baseCommand: string, options: ProcessingOptions): string {
  const p = '[save/services/s3]'
  if (options.save === 'b2') {
    const b2KeyId = process.env['B2_APPLICATION_KEY_ID']
    const b2Key = process.env['B2_APPLICATION_KEY']
    
    if (b2KeyId && b2Key) {
      const envVars = `AWS_ACCESS_KEY_ID="${b2KeyId}" AWS_SECRET_ACCESS_KEY="${b2Key}"`
      l.dim(`${p} Adding B2 credentials to command`)
      return `${envVars} ${baseCommand}`
    }
  }
  return baseCommand
}