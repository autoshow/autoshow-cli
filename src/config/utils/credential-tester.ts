import { l } from '@/logging'
import { execPromise } from '@/node-utils'
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

export async function testR2Credentials(accessKeyId: string, secretAccessKey: string, accountId: string): Promise<CredentialValidationResult> {
  const p = '[config/utils/credential-tester]'
  l.dim(`${p} Testing R2 credentials for account: ${accountId.slice(0, 8)}***`)
  
  if (accessKeyId.length !== 32) {
    return { 
      valid: false, 
      error: `R2 access key must be 32 characters, got ${accessKeyId.length}` 
    }
  }
  
  if (!/^[a-f0-9]{32}$/i.test(accountId)) {
    return { 
      valid: false, 
      error: 'Account ID must be a 32-character hexadecimal string' 
    }
  }
  
  try {
    const endpoint = `https://${accountId}.r2.cloudflarestorage.com`
    const command = `AWS_ACCESS_KEY_ID="${accessKeyId}" AWS_SECRET_ACCESS_KEY="${secretAccessKey}" aws s3api list-buckets --endpoint-url "${endpoint}"`
    
    await execPromise(command)
    l.dim(`${p} R2 credentials valid for account: ${accountId}`)
    return { 
      valid: true, 
      details: { accountId, endpoint } 
    }
  } catch (error) {
    const errorMessage = (error as Error).message
    l.dim(`${p} R2 credential test failed: ${errorMessage}`)
    
    if (errorMessage.includes('InvalidAccessKeyId')) {
      return { 
        valid: false, 
        error: 'R2 access key ID is invalid or not found' 
      }
    } else if (errorMessage.includes('SignatureDoesNotMatch')) {
      return { 
        valid: false, 
        error: 'R2 secret access key is incorrect' 
      }
    } else if (errorMessage.includes('access key has length')) {
      return { 
        valid: false, 
        error: 'Invalid R2 access key length (must be 32 characters)' 
      }
    } else {
      return { 
        valid: false, 
        error: `R2 credential test failed: ${errorMessage}` 
      }
    }
  }
}

export async function testB2Credentials(keyId: string, applicationKey: string, region = 'us-west-004'): Promise<CredentialValidationResult> {
  const p = '[config/utils/credential-tester]'
  l.dim(`${p} Testing B2 credentials for key ID: ${keyId.slice(0, 8)}***`)
  
  try {
    const endpoint = `https://s3.${region}.backblazeb2.com`
    const command = `AWS_ACCESS_KEY_ID="${keyId}" AWS_SECRET_ACCESS_KEY="${applicationKey}" aws s3api list-buckets --endpoint-url "${endpoint}"`
    
    await execPromise(command)
    l.dim(`${p} B2 credentials valid for key: ${keyId}`)
    return { 
      valid: true, 
      details: { keyId, region, endpoint } 
    }
  } catch (error) {
    const errorMessage = (error as Error).message
    l.dim(`${p} B2 credential test failed: ${errorMessage}`)
    
    if (errorMessage.includes('InvalidAccessKeyId') || errorMessage.includes('not valid')) {
      return { 
        valid: false, 
        error: 'B2 application key ID is invalid, expired, or revoked' 
      }
    } else if (errorMessage.includes('SignatureDoesNotMatch')) {
      return { 
        valid: false, 
        error: 'B2 application key is incorrect' 
      }
    } else if (errorMessage.includes('Forbidden') || errorMessage.includes('Access Denied')) {
      return { 
        valid: false, 
        error: 'B2 application key lacks required permissions (needs listBuckets capability)' 
      }
    } else {
      return { 
        valid: false, 
        error: `B2 credential test failed: ${errorMessage}` 
      }
    }
  }
}