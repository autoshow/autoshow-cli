import { l, err } from '@/logging'
import { checkR2Configuration } from '@/save/cloudflare/config'
import { listBuckets } from '@/save/cloudflare/client'
import type { ConfigStatus } from '@/config/config-types'

function maskCredential(credential: string | undefined, showLength: number = 4): string {
  if (!credential) return 'Not set'
  if (credential.length <= showLength) return '*'.repeat(credential.length)
  return credential.slice(0, showLength) + '*'.repeat(credential.length - showLength)
}

async function testVectorizeAPI(accountId: string, apiToken: string): Promise<{ working: boolean; indexCount: number }> {
  const p = '[config/cloudflare/check-cloudflare-config]'
  
  try {
    const response = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${accountId}/vectorize/v2/indexes`,
      {
        headers: {
          'Authorization': `Bearer ${apiToken}`,
          'Content-Type': 'application/json'
        }
      }
    )
    
    if (response.ok) {
      const data = await response.json()
      const indexCount = data.result?.length || 0
      return { working: true, indexCount }
    } else {
      l.warn(`${p} Vectorize API test failed with status: ${response.status}`)
      return { working: false, indexCount: 0 }
    }
  } catch (error) {
    l.warn(`${p} Vectorize API test error: ${(error as Error).message}`)
    return { working: false, indexCount: 0 }
  }
}

export async function checkCloudflareConfig(): Promise<ConfigStatus> {
  const p = '[config/cloudflare/check-cloudflare-config]'
  
  const status: ConfigStatus = {
    service: 'Cloudflare R2 & Vectorize',
    configured: false,
    tested: false,
    issues: [],
    details: {}
  }
  
  const cloudflareAccountId = process.env['CLOUDFLARE_ACCOUNT_ID']
  const email = process.env['CLOUDFLARE_EMAIL']
  const globalApiKey = process.env['CLOUDFLARE_GLOBAL_API_KEY']
  const apiToken = process.env['CLOUDFLARE_API_TOKEN']
  
  status.details['Account ID'] = maskCredential(cloudflareAccountId, 8)
  status.details['Email'] = email ? email.replace(/^(.{3}).*(@.*)$/, '$1***$2') : 'Not set'
  status.details['Global API Key'] = globalApiKey ? '***' : 'Not set'
  status.details['Unified API Token'] = apiToken ? '***' : 'Not set'
  
  try {
    const r2Check = checkR2Configuration()
    status.configured = r2Check.isValid
    if (!r2Check.isValid && r2Check.error) {
      status.issues.push(r2Check.error)
    }
    
    if (status.configured && cloudflareAccountId) {
      try {
        const buckets = await listBuckets(cloudflareAccountId)
        status.details['R2 Buckets'] = buckets.length.toString()
        
        if (apiToken) {
          const vectorizeTest = await testVectorizeAPI(cloudflareAccountId, apiToken)
          status.details['Vectorize Working'] = vectorizeTest.working ? 'Yes' : 'No'
          status.details['Vectorize Indexes'] = vectorizeTest.indexCount.toString()
          
          if (vectorizeTest.working) {
            status.tested = true
          } else {
            status.issues.push('Vectorize API not accessible - check token permissions')
          }
        } else {
          status.issues.push('No unified API token found - Vectorize functionality unavailable')
        }
        
        if (!status.tested && buckets.length >= 0) {
          status.tested = true
        }
        
      } catch (error) {
        const errorMessage = (error as Error).message
        l.warn(`${p} R2/Vectorize test failed: ${errorMessage}`)
        
        if (errorMessage.includes('Failed to get R2 token')) {
          status.issues.push('Failed to create or use R2 API token - check your credentials')
        } else if (errorMessage.includes('Invalid credentials')) {
          status.issues.push('R2 API credentials are invalid - check your email and Global API Key')
        } else if (errorMessage.includes('Account not found')) {
          status.issues.push('R2 account not found - check your Cloudflare Account ID')
        } else {
          status.issues.push(`Credential test failed: ${errorMessage}`)
        }
      }
    }
  } catch (error) {
    err(`${p} Error during Cloudflare configuration check: ${(error as Error).message}`)
    status.issues.push(`Configuration check failed: ${(error as Error).message}`)
  }
  
  return status
}