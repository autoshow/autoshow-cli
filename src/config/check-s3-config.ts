import { l } from '@/logging'
import { execPromise } from '@/node-utils'

interface S3ConfigResult {
  configured: boolean
  tested: boolean
  issues: string[]
  details: Record<string, string>
}

function maskCredential(credential: string | undefined, showLength: number = 4): string {
  if (!credential) return 'Not set'
  if (credential.length <= showLength) return '*'.repeat(credential.length)
  return credential.slice(0, showLength) + '*'.repeat(credential.length - showLength)
}

export async function checkS3Config(): Promise<S3ConfigResult> {
  const p = '[config/check-s3-config]'
  l.dim(`${p} Checking S3 configuration`)
  
  const result: S3ConfigResult = {
    configured: false,
    tested: false,
    issues: [],
    details: {}
  }
  
  const awsAccessKeyId = process.env['AWS_ACCESS_KEY_ID']
  const awsSecretAccessKey = process.env['AWS_SECRET_ACCESS_KEY']
  const awsRegion = process.env['AWS_REGION'] || 'us-east-1'
  const awsProfile = process.env['AWS_PROFILE']
  
  result.details['Access Key ID'] = maskCredential(awsAccessKeyId, 6)
  result.details['Secret Access Key'] = maskCredential(awsSecretAccessKey, 4)
  result.details['Region'] = awsRegion
  result.details['Profile'] = awsProfile || 'Default'
  
  if (awsAccessKeyId && awsSecretAccessKey) {
    l.dim(`${p} Environment credentials found, testing those first`)
    result.configured = true
    
    try {
      l.dim(`${p} Testing environment AWS credentials`)
      const envTestCommand = `AWS_PROFILE="" aws sts get-caller-identity --query Account --output text`
      const { stdout } = await execPromise(envTestCommand)
      const accountId = stdout.trim()
      
      if (accountId && accountId !== 'None') {
        result.tested = true
        result.details['Account ID'] = accountId
        result.details['Credential Source'] = 'Environment variables'
        l.dim(`${p} Environment AWS credentials test successful, account: ${accountId}`)
        return result
      }
    } catch (error) {
      const errorMessage = (error as Error).message
      l.dim(`${p} Environment credentials test failed: ${errorMessage}`)
      result.issues.push(`Environment credentials test failed: ${errorMessage}`)
    }
  }
  
  if (awsProfile) {
    l.dim(`${p} AWS_PROFILE is set to '${awsProfile}'`)
    
    if (awsProfile === 'r2') {
      result.issues.push('AWS_PROFILE is set to "r2" which contains R2 credentials, not AWS S3 credentials')
      result.issues.push('For S3 operations, either unset AWS_PROFILE or set it to an AWS profile')
      
      l.dim(`${p} Attempting to test default AWS profile instead`)
      try {
        const defaultTestCommand = `AWS_PROFILE=default aws sts get-caller-identity --query Account --output text`
        const { stdout } = await execPromise(defaultTestCommand)
        const accountId = stdout.trim()
        
        if (accountId && accountId !== 'None') {
          result.configured = true
          result.tested = true
          result.details['Account ID'] = accountId
          result.details['Credential Source'] = 'Default AWS profile (tested separately)'
          l.dim(`${p} Default AWS profile test successful, account: ${accountId}`)
          result.issues.push('Default AWS profile works - consider unsetting AWS_PROFILE for S3 operations')
          return result
        }
      } catch (error) {
        l.dim(`${p} Default profile test also failed: ${(error as Error).message}`)
        result.issues.push(`Default AWS profile also unavailable: ${(error as Error).message}`)
      }
    } else {
      result.configured = true
      
      try {
        l.dim(`${p} Testing AWS credentials with profile: ${awsProfile}`)
        const profileTestCommand = `aws sts get-caller-identity --query Account --output text --profile ${awsProfile}`
        const { stdout } = await execPromise(profileTestCommand)
        const accountId = stdout.trim()
        
        if (accountId && accountId !== 'None') {
          result.tested = true
          result.details['Account ID'] = accountId
          result.details['Credential Source'] = `Profile: ${awsProfile}`
          l.dim(`${p} AWS profile credentials test successful, account: ${accountId}`)
          return result
        }
      } catch (error) {
        const errorMessage = (error as Error).message
        l.dim(`${p} Profile credentials test failed: ${errorMessage}`)
        result.issues.push(`Profile "${awsProfile}" test failed: ${errorMessage}`)
      }
    }
  }
  
  if (!result.configured) {
    result.issues.push('No valid AWS credentials found for S3 access')
    result.issues.push('Run "aws configure" or set AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY')
  }
  
  return result
}