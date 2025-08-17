import { l, err } from '@/logging'

export function isValidCloudflareAccountId(accountId: string): boolean {
  const hexPattern = /^[a-f0-9]{32}$/i
  return hexPattern.test(accountId)
}

export async function getCloudflareAccountId(): Promise<string> {
  const p = '[save/cloudflare/utils]'
  
  const cloudflareAccountId = process.env['CLOUDFLARE_ACCOUNT_ID']
  if (cloudflareAccountId && isValidCloudflareAccountId(cloudflareAccountId)) {
    l.dim(`${p} Using Cloudflare account ID: ${cloudflareAccountId}`)
    return cloudflareAccountId
  } else if (cloudflareAccountId) {
    err(`${p} Invalid CLOUDFLARE_ACCOUNT_ID format: ${cloudflareAccountId}`)
    err(`${p} Expected a 32-character hex string (e.g., c6494d4164a5eb0cd3848193bd552d68)`)
    return 'invalid-account-id'
  }
  
  err(`${p} CLOUDFLARE_ACCOUNT_ID is required for R2 operations`)
  return 'unknown'
}

export function getCloudflareRegion(): string {
  return 'auto'
}

export function getCloudflareEndpoint(): string {
  const p = '[save/cloudflare/utils]'
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

export function getCloudflarePublicUrl(bucketName: string, s3Key: string): string {
  const p = '[save/cloudflare/utils]'
  l.dim(`${p} Generating R2 public URL`)
  
  const accountId = process.env['CLOUDFLARE_ACCOUNT_ID'] || 'unknown'
  return `https://${accountId}.r2.cloudflarestorage.com/${bucketName}/${s3Key}`
}