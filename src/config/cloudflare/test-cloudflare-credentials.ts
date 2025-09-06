import { l } from '@/logging'
import { listBuckets, createBucket, healthCheck } from '../../save/save-services/cloudflare/client'
import type { CredentialValidationResult } from '@/config/config-types'
import { testWorkersAICapabilities } from "./test-workers-ai"
import { testVectorizeCapabilities } from "./test-vectorize"

export async function testCloudflareCredentials(accountId: string, email: string, globalApiKey: string): Promise<CredentialValidationResult> {
  const p = '[config/cloudflare/test-cloudflare-credentials]'
  
  if (!/^[a-f0-9]{32}$/i.test(accountId)) {
    return { 
      valid: false, 
      error: 'Account ID must be a 32-character hexadecimal string' 
    }
  }
  
  if (!email.includes('@')) {
    return { 
      valid: false, 
      error: 'Invalid email format' 
    }
  }
  
  if (globalApiKey.length !== 37) {
    return { 
      valid: false, 
      error: 'Global API Key must be 37 characters' 
    }
  }
  
  const originalEnvValues = {
    accountId: process.env['CLOUDFLARE_ACCOUNT_ID'],
    email: process.env['CLOUDFLARE_EMAIL'], 
    globalApiKey: process.env['CLOUDFLARE_GLOBAL_API_KEY'],
    r2ApiToken: process.env['CLOUDFLARE_R2_API_TOKEN']
  }
  
  try {
    process.env['CLOUDFLARE_ACCOUNT_ID'] = accountId
    process.env['CLOUDFLARE_EMAIL'] = email
    process.env['CLOUDFLARE_GLOBAL_API_KEY'] = globalApiKey
    
    const permResponse = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${accountId}/tokens/permission_groups`,
      {
        headers: {
          'X-Auth-Email': email,
          'X-Auth-Key': globalApiKey,
          'Content-Type': 'application/json'
        }
      }
    )
    
    if (!permResponse.ok) {
      const errorText = await permResponse.text()
      l.warn(`${p} Failed to fetch permission groups: ${errorText}`)
      return { 
        valid: false, 
        error: 'Invalid email or Global API Key' 
      }
    }
    
    const permData = await permResponse.json()
    const allPermissions = permData.result.filter((perm: any) => 
      perm.name === 'Workers R2 Storage:Read' ||
      perm.name === 'Workers R2 Storage:Write' ||
      perm.name === 'Vectorize Read' ||
      perm.name === 'Vectorize Write' ||
      perm.name === 'Workers AI Read' ||
      perm.name === 'Workers AI Write' ||
      perm.name.includes('R2') ||
      perm.name.includes('Vectorize') ||
      perm.name.includes('Workers AI') ||
      perm.name.includes('Workers Scripts') ||
      perm.name.includes('Analytics')
    )
    
    if (allPermissions.length === 0) {
      return { 
        valid: false, 
        error: 'R2, Vectorize, and Workers AI permissions not available for this account' 
      }
    }
    
    const tokenBody = {
      name: `autoshow-unified-test-${Date.now()}`,
      policies: [
        {
          effect: 'allow',
          permission_groups: allPermissions.map((perm: any) => ({
            id: perm.id,
            meta: {}
          })),
          resources: {
            [`com.cloudflare.api.account.${accountId}`]: '*'
          }
        }
      ]
    }
    
    const createResponse = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${accountId}/tokens`,
      {
        method: 'POST',
        headers: {
          'X-Auth-Email': email,
          'X-Auth-Key': globalApiKey,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(tokenBody)
      }
    )
    
    if (!createResponse.ok) {
      const errorText = await createResponse.text()
      l.warn(`${p} Failed to create test token: ${errorText}`)
      return { 
        valid: false, 
        error: 'Failed to create unified R2/Vectorize/Workers AI API token' 
      }
    }
    
    const tokenData = await createResponse.json()
    
    if (tokenData.result?.value) {
      process.env['CLOUDFLARE_R2_API_TOKEN'] = tokenData.result.value
      process.env['CLOUDFLARE_API_TOKEN'] = tokenData.result.value
      
      const buckets = await listBuckets(accountId)
      
      const testBucketName = `autoshow-test-${Date.now()}`
      const bucketCreated = await createBucket(accountId, testBucketName)
      
      if (bucketCreated) {
        const healthCheckPassed = await healthCheck(accountId, testBucketName)
        
        if (healthCheckPassed) {
          const vectorizeTest = await testVectorizeCapabilities(accountId, tokenData.result.value)
          const workersAITest = await testWorkersAICapabilities(accountId, tokenData.result.value)
          
          const { updateEnvVariable } = await import('../env-writer')
          await updateEnvVariable('CLOUDFLARE_API_TOKEN', tokenData.result.value)
          
          return { 
            valid: true, 
            details: { 
              accountId, 
              email,
              apiToken: 'Created and tested for R2/Vectorize/Workers AI',
              testBucket: testBucketName,
              bucketCount: buckets.length.toString(),
              vectorizeWorking: vectorizeTest.working.toString(),
              workersAIWorking: workersAITest.working.toString(),
              ...vectorizeTest.details,
              ...workersAITest.details
            } 
          }
        } else {
          return { 
            valid: false, 
            error: 'R2 health check failed - unable to perform read/write operations' 
          }
        }
      } else {
        return { 
          valid: false, 
          error: 'Failed to create test bucket' 
        }
      }
    }
    
    return { 
      valid: false, 
      error: 'Failed to create API token' 
    }
  } catch (error) {
    const errorMessage = (error as Error).message
    l.warn(`${p} Cloudflare credential test failed: ${errorMessage}`)
    
    return { 
      valid: false, 
      error: `Cloudflare credential test failed: ${errorMessage}` 
    }
  } finally {
    if (originalEnvValues.accountId) {
      process.env['CLOUDFLARE_ACCOUNT_ID'] = originalEnvValues.accountId
    } else {
      delete process.env['CLOUDFLARE_ACCOUNT_ID']
    }
    
    if (originalEnvValues.email) {
      process.env['CLOUDFLARE_EMAIL'] = originalEnvValues.email  
    } else {
      delete process.env['CLOUDFLARE_EMAIL']
    }
    
    if (originalEnvValues.globalApiKey) {
      process.env['CLOUDFLARE_GLOBAL_API_KEY'] = originalEnvValues.globalApiKey
    } else {
      delete process.env['CLOUDFLARE_GLOBAL_API_KEY']
    }
    
    if (originalEnvValues.r2ApiToken) {
      process.env['CLOUDFLARE_R2_API_TOKEN'] = originalEnvValues.r2ApiToken
    } else {
      delete process.env['CLOUDFLARE_R2_API_TOKEN']
    }
  }
}