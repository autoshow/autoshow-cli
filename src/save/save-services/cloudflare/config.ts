export function checkR2Configuration(): { isValid: boolean; error?: string } {
  const cloudflareAccountId = process.env['CLOUDFLARE_ACCOUNT_ID']
  const email = process.env['CLOUDFLARE_EMAIL']
  const globalApiKey = process.env['CLOUDFLARE_GLOBAL_API_KEY']
  const r2ApiToken = process.env['CLOUDFLARE_R2_API_TOKEN']
  
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
    return { isValid: true }
  }
  
  if (!email || !globalApiKey) {
    return {
      isValid: false,
      error: 'Either CLOUDFLARE_R2_API_TOKEN or both CLOUDFLARE_EMAIL and CLOUDFLARE_GLOBAL_API_KEY are required for R2 operations'
    }
  }
  
  return { isValid: true }
}

function isValidCloudflareAccountId(accountId: string): boolean {
  const hexPattern = /^[a-f0-9]{32}$/i
  return hexPattern.test(accountId)
}