import { l } from '@/logging'
import { R2Client } from './r2-client'

export function checkR2Configuration(): { isValid: boolean; error?: string } {
  const p = '[save/services/r2]'
  const cloudflareAccountId = process.env['CLOUDFLARE_ACCOUNT_ID']
  const email = process.env['CLOUDFLARE_EMAIL']
  const globalApiKey = process.env['CLOUDFLARE_GLOBAL_API_KEY']
  const r2ApiToken = process.env['CLOUDFLARE_R2_API_TOKEN']
  
  l.dim(`${p} Checking R2 configuration`)
  l.dim(`${p} Account ID: ${cloudflareAccountId ? cloudflareAccountId.slice(0, 8) + '*'.repeat(24) : 'Not set'}`)
  l.dim(`${p} Email: ${email ? email.replace(/^(.{3}).*(@.*)$/, '$1***$2') : 'Not set'}`)
  l.dim(`${p} Global API Key: ${globalApiKey ? '***' : 'Not set'}`)
  l.dim(`${p} R2 API Token: ${r2ApiToken ? '***' : 'Not set'}`)
  
  if (!cloudflareAccountId) {
    return { 
      isValid: false, 
      error: 'CLOUDFLARE_ACCOUNT_ID environment variable is not set. Find your Account ID in the Cloudflare dashboard URL or R2 overview page.' 
    }
  }
  
  if (!isValidCloudflareAccountId(cloudflareAccountId)) {
    return {
      isValid: false,
      error: `Invalid CLOUDFLARE_ACCOUNT_ID format. Expected a 32-character hex string (like c6494d4164a5eb0cd3848193bd552d68), got: ${cloudflareAccountId.length} characters`
    }
  }
  
  if (r2ApiToken) {
    l.dim(`${p} Using existing R2 API token`)
    return { isValid: true }
  }
  
  if (!email || !globalApiKey) {
    return {
      isValid: false,
      error: 'Either CLOUDFLARE_R2_API_TOKEN or both CLOUDFLARE_EMAIL and CLOUDFLARE_GLOBAL_API_KEY are required for R2 operations'
    }
  }
  
  l.dim(`${p} R2 configuration is valid`)
  return { isValid: true }
}

function isValidCloudflareAccountId(accountId: string): boolean {
  const hexPattern = /^[a-f0-9]{32}$/i
  return hexPattern.test(accountId)
}

export function getR2Client(): R2Client | null {
  const p = '[save/services/r2]'
  const accountId = process.env['CLOUDFLARE_ACCOUNT_ID']
  
  if (!accountId) {
    l.dim(`${p} Cannot create R2 client without account ID`)
    return null
  }
  
  return new R2Client(accountId)
}