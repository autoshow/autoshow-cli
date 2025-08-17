import { l } from '@/logging'
import { execPromise } from '@/node-utils'
import { R2Client } from '@/save/services/r2-client'
import type { CredentialValidationResult } from '@/types'

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
  
  try {
    process.env['CLOUDFLARE_ACCOUNT_ID'] = accountId
    process.env['CLOUDFLARE_EMAIL'] = email
    process.env['CLOUDFLARE_GLOBAL_API_KEY'] = globalApiKey
    
    l.dim(`${p} Creating R2 API token for testing`)
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
    const r2Permissions = permData.result.filter((perm: any) => 
      perm.name === 'Workers R2 Storage:Read' ||
      perm.name === 'Workers R2 Storage:Write' ||
      perm.name.includes('R2')
    )
    
    if (r2Permissions.length === 0) {
      return { 
        valid: false, 
        error: 'R2 permissions not available for this account' 
      }
    }
    
    l.dim(`${p} Found ${r2Permissions.length} R2 permission groups`)
    
    const tokenBody = {
      name: `autoshow-r2-test-${Date.now()}`,
      policies: [
        {
          effect: 'allow',
          permission_groups: r2Permissions.map((perm: any) => ({
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
        error: 'Failed to create R2 API token' 
      }
    }
    
    const tokenData = await createResponse.json()
    
    if (tokenData.result?.value) {
      l.dim(`${p} Test token created successfully`)
      
      process.env['CLOUDFLARE_R2_API_TOKEN'] = tokenData.result.value
      
      const client = new R2Client(accountId)
      const buckets = await client.listBuckets()
      l.dim(`${p} Successfully listed ${buckets.length} buckets`)
      
      const testBucketName = `autoshow-test-${Date.now()}`
      l.dim(`${p} Creating test bucket: ${testBucketName}`)
      const bucketCreated = await client.createBucket(testBucketName)
      
      if (bucketCreated) {
        l.dim(`${p} Running health check on test bucket`)
        const healthCheckPassed = await client.healthCheck(testBucketName)
        
        if (healthCheckPassed) {
          l.dim(`${p} All R2 operations successful, saving token`)
          const { updateEnvVariable } = await import('../utils/env-writer')
          await updateEnvVariable('CLOUDFLARE_R2_API_TOKEN', tokenData.result.value)
          
          return { 
            valid: true, 
            details: { 
              accountId, 
              email,
              apiToken: 'Created and tested',
              testBucket: testBucketName,
              bucketCount: buckets.length.toString()
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
    l.dim(`${p} R2 credential test failed: ${errorMessage}`)
    
    return { 
      valid: false, 
      error: `R2 credential test failed: ${errorMessage}` 
    }
  } finally {
    delete process.env['CLOUDFLARE_ACCOUNT_ID']
    delete process.env['CLOUDFLARE_EMAIL']
    delete process.env['CLOUDFLARE_GLOBAL_API_KEY']
    delete process.env['CLOUDFLARE_R2_API_TOKEN']
  }
}