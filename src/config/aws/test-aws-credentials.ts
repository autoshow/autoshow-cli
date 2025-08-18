import { l } from '@/logging'
import { execPromise } from '@/node-utils'
import type { CredentialValidationResult } from '@/types'

export async function testAwsCredentials(accessKeyId: string, secretAccessKey: string, region = 'us-east-1'): Promise<CredentialValidationResult> {
  const p = '[config/aws/test-aws-credentials]'
  
  try {
    const command = `AWS_ACCESS_KEY_ID="${accessKeyId}" AWS_SECRET_ACCESS_KEY="${secretAccessKey}" AWS_REGION="${region}" aws sts get-caller-identity --query Account --output text`
    const { stdout } = await execPromise(command)
    const accountId = stdout.trim()
    
    if (accountId && accountId.length > 0 && !accountId.includes('error')) {
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
    l.warn(`${p} AWS S3 credential test failed: ${errorMessage}`)
    
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