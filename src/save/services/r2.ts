import { l } from '@/logging'

export function checkR2Configuration(): { isValid: boolean; error?: string } {
  const p = '[save/services/r2]'
  const cloudflareAccountId = process.env['CLOUDFLARE_ACCOUNT_ID']
  const awsProfile = process.env['AWS_PROFILE']
  
  l.dim(`${p} Checking R2 configuration`)
  l.dim(`${p} Account ID: ${cloudflareAccountId ? cloudflareAccountId.slice(0, 8) + '*'.repeat(24) : 'Not set'}`)
  l.dim(`${p} AWS Profile: ${awsProfile || 'Not set'}`)
  
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
  
  if (!awsProfile || awsProfile !== 'r2') {
    l.warn(`${p} AWS_PROFILE is not set to 'r2'. This may cause authentication issues.`)
  }
  
  l.dim(`${p} R2 configuration is valid`)
  return { isValid: true }
}

function isValidCloudflareAccountId(accountId: string): boolean {
  const hexPattern = /^[a-f0-9]{32}$/i
  return hexPattern.test(accountId)
}