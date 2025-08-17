import { l } from '@/logging'
import { execPromise } from '@/node-utils'
import { R2Client } from '@/save/services/r2-client'
import type { CredentialValidationResult } from '@/types'

async function testVectorizeCapabilities(accountId: string, apiToken: string): Promise<{ working: boolean; details: Record<string, string> }> {
  const p = '[config/utils/credential-tester]'
  const details: Record<string, string> = {}
  
  try {
    l.dim(`${p} Testing Vectorize API capabilities`)
    
    const indexListResponse = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${accountId}/vectorize/v2/indexes`,
      {
        headers: {
          'Authorization': `Bearer ${apiToken}`,
          'Content-Type': 'application/json'
        }
      }
    )
    
    if (indexListResponse.ok) {
      const indexData = await indexListResponse.json()
      const indexCount = indexData.result?.length || 0
      details['vectorizeIndexes'] = indexCount.toString()
      l.dim(`${p} Vectorize API accessible, found ${indexCount} indexes`)
      return { working: true, details }
    } else if (indexListResponse.status === 403) {
      details['vectorizeAccess'] = 'denied'
      l.dim(`${p} Vectorize API access denied - insufficient permissions`)
      return { working: false, details }
    } else {
      details['vectorizeError'] = `HTTP ${indexListResponse.status}`
      l.dim(`${p} Vectorize API test failed with status: ${indexListResponse.status}`)
      return { working: false, details }
    }
  } catch (error) {
    details['vectorizeError'] = (error as Error).message
    l.dim(`${p} Vectorize API test error: ${(error as Error).message}`)
    return { working: false, details }
  }
}

async function testWorkersAICapabilities(accountId: string, apiToken: string): Promise<{ working: boolean; details: Record<string, string> }> {
  const p = '[config/utils/credential-tester]'
  const details: Record<string, string> = {}
  
  try {
    l.dim(`${p} Testing Workers AI capabilities with bge-m3 model`)
    
    const aiResponse = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/@cf/baai/bge-m3`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          text: 'test embedding'
        })
      }
    )
    
    if (aiResponse.ok) {
      const aiData = await aiResponse.json()
      if (aiData.success && aiData.result?.data?.[0]) {
        details['workersAI'] = 'working'
        details['embeddingModel'] = '@cf/baai/bge-m3'
        l.dim(`${p} Workers AI test successful with bge-m3 model`)
        return { working: true, details }
      } else {
        details['workersAI'] = 'invalid_response'
        l.dim(`${p} Workers AI returned unsuccessful response`)
        return { working: false, details }
      }
    } else if (aiResponse.status === 403) {
      details['workersAI'] = 'access_denied'
      l.dim(`${p} Workers AI access denied - insufficient permissions`)
      return { working: false, details }
    } else {
      details['workersAIError'] = `HTTP ${aiResponse.status}`
      l.dim(`${p} Workers AI test failed with status: ${aiResponse.status}`)
      return { working: false, details }
    }
  } catch (error) {
    details['workersAIError'] = (error as Error).message
    l.dim(`${p} Workers AI test error: ${(error as Error).message}`)
    return { working: false, details }
  }
}

export async function testS3Credentials(accessKeyId: string, secretAccessKey: string, region = 'us-east-1'): Promise<CredentialValidationResult> {
  const p = '[config/utils/credential-tester]'
  l.dim(`${p} Testing S3 credentials for access key: ${accessKeyId.slice(0, 8)}***`)
  
  try {
    const command = `AWS_ACCESS_KEY_ID="${accessKeyId}" AWS_SECRET_ACCESS_KEY="${secretAccessKey}" AWS_REGION="${region}" aws sts get-caller-identity --query Account --output text`
    const { stdout } = await execPromise(command)
    const accountId = stdout.trim()
    
    if (accountId && accountId.length > 0 && !accountId.includes('error')) {
      l.dim(`${p} S3 credentials valid for account: ${accountId}`)
      return { 
        valid: true, 
        details: { accountId, region } 
      }
    } else {
      return { 
        valid: false, 
        error: 'Invalid response from AWS API' 
      }
    }
  } catch (error) {
    const errorMessage = (error as Error).message
    l.dim(`${p} S3 credential test failed: ${errorMessage}`)
    
    if (errorMessage.includes('InvalidUserID.NotFound') || errorMessage.includes('does not exist')) {
      return { 
        valid: false, 
        error: 'Access key ID not found or invalid' 
      }
    } else if (errorMessage.includes('SignatureDoesNotMatch')) {
      return { 
        valid: false, 
        error: 'Secret access key is incorrect' 
      }
    } else if (errorMessage.includes('TokenRefreshRequired')) {
      return { 
        valid: false, 
        error: 'Credentials have expired' 
      }
    } else {
      return { 
        valid: false, 
        error: `Credential test failed: ${errorMessage}` 
      }
    }
  }
}

export async function testR2Credentials(accountId: string, email: string, globalApiKey: string): Promise<CredentialValidationResult> {
  const p = '[config/utils/credential-tester]'
  l.dim(`${p} Testing R2 credentials for account: ${accountId.slice(0, 8)}***`)
  
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
    
    l.dim(`${p} Creating unified R2/Vectorize/Workers AI API token for testing`)
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
      l.dim(`${p} Failed to fetch permission groups: ${errorText}`)
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
    
    l.dim(`${p} Found ${allPermissions.length} relevant permission groups`)
    
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
      l.dim(`${p} Failed to create test token: ${errorText}`)
      return { 
        valid: false, 
        error: 'Failed to create unified R2/Vectorize/Workers AI API token' 
      }
    }
    
    const tokenData = await createResponse.json()
    
    if (tokenData.result?.value) {
      l.dim(`${p} Test token created successfully`)
      
      process.env['CLOUDFLARE_R2_API_TOKEN'] = tokenData.result.value
      process.env['CLOUDFLARE_API_TOKEN'] = tokenData.result.value
      
      const client = new R2Client(accountId)
      const buckets = await client.listBuckets()
      l.dim(`${p} Successfully listed ${buckets.length} R2 buckets`)
      
      const testBucketName = `autoshow-test-${Date.now()}`
      l.dim(`${p} Creating test bucket: ${testBucketName}`)
      const bucketCreated = await client.createBucket(testBucketName)
      
      if (bucketCreated) {
        l.dim(`${p} Running R2 health check on test bucket`)
        const healthCheckPassed = await client.healthCheck(testBucketName)
        
        if (healthCheckPassed) {
          l.dim(`${p} Testing Vectorize capabilities`)
          const vectorizeTest = await testVectorizeCapabilities(accountId, tokenData.result.value)
          
          l.dim(`${p} Testing Workers AI capabilities`)
          const workersAITest = await testWorkersAICapabilities(accountId, tokenData.result.value)
          
          l.dim(`${p} All tests successful, saving unified token`)
          const { updateEnvVariable } = await import('../utils/env-writer')
          await updateEnvVariable('CLOUDFLARE_API_TOKEN', tokenData.result.value)
          
          l.dim(`${p} Keeping unified token in process environment for immediate use`)
          
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
    l.dim(`${p} R2/Vectorize/Workers AI credential test failed: ${errorMessage}`)
    
    return { 
      valid: false, 
      error: `R2/Vectorize/Workers AI credential test failed: ${errorMessage}` 
    }
  } finally {
    l.dim(`${p} Cleaning up temporary environment variables`)
    
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