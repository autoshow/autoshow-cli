import { l } from '@/logging'
import { execPromise } from '@/node-utils'
import type { ConfigStatus } from '@/types'

function maskCredential(credential: string | undefined, showLength: number = 4): string {
  if (!credential) return 'Not set'
  if (credential.length <= showLength) return '*'.repeat(credential.length)
  return credential.slice(0, showLength) + '*'.repeat(credential.length - showLength)
}

export async function checkAwsConfig(): Promise<ConfigStatus> {
  const p = '[config/aws/check-aws-config]'
  l.dim(`${p} Checking AWS S3 configuration`)
  
  const status: ConfigStatus = {
    service: 'Amazon S3',
    configured: false,
    tested: false,
    issues: [],
    details: {}
  }
  
  const awsAccessKeyId = process.env['AWS_ACCESS_KEY_ID']
  const awsSecretAccessKey = process.env['AWS_SECRET_ACCESS_KEY']
  const awsRegion = process.env['AWS_REGION'] || 'us-east-1'
  const awsProfile = process.env['AWS_PROFILE']
  
  status.details['Access Key ID'] = maskCredential(awsAccessKeyId, 6)
  status.details['Secret Access Key'] = maskCredential(awsSecretAccessKey, 4)
  status.details['Region'] = awsRegion
  status.details['Profile'] = awsProfile || 'Default'
  
  if (awsAccessKeyId && awsSecretAccessKey) {
    l.dim(`${p} Environment credentials found, testing those first`)
    status.configured = true
    
    try {
      l.dim(`${p} Testing environment AWS credentials`)
      const envTestCommand = `AWS_PROFILE="" aws sts get-caller-identity --query Account --output text`
      const { stdout } = await execPromise(envTestCommand)
      const accountId = stdout.trim()
      
      if (accountId && accountId !== 'None') {
        status.tested = true
        status.details['Account ID'] = accountId
        status.details['Credential Source'] = 'Environment variables'
        l.dim(`${p} Environment AWS credentials test successful, account: ${accountId}`)
        return status
      }
    } catch (error) {
      const errorMessage = (error as Error).message
      l.dim(`${p} Environment credentials test failed: ${errorMessage}`)
      status.issues.push(`Environment credentials test failed: ${errorMessage}`)
    }
  }
  
  if (awsProfile) {
    l.dim(`${p} AWS_PROFILE is set to '${awsProfile}'`)
    
    if (awsProfile === 'r2') {
      status.issues.push('AWS_PROFILE is set to "r2" which contains R2 credentials, not AWS S3 credentials')
      status.issues.push('For S3 operations, either unset AWS_PROFILE or set it to an AWS profile')
      
      l.dim(`${p} Attempting to test default AWS profile instead`)
      try {
        const defaultTestCommand = `AWS_PROFILE=default aws sts get-caller-identity --query Account --output text`
        const { stdout } = await execPromise(defaultTestCommand)
        const accountId = stdout.trim()
        
        if (accountId && accountId !== 'None') {
          status.configured = true
          status.tested = true
          status.details['Account ID'] = accountId
          status.details['Credential Source'] = 'Default AWS profile (tested separately)'
          l.dim(`${p} Default AWS profile test successful, account: ${accountId}`)
          status.issues.push('Default AWS profile works - consider unsetting AWS_PROFILE for S3 operations')
          return status
        }
      } catch (error) {
        l.dim(`${p} Default profile test also failed: ${(error as Error).message}`)
        status.issues.push(`Default AWS profile also unavailable: ${(error as Error).message}`)
      }
    } else {
      status.configured = true
      
      try {
        l.dim(`${p} Testing AWS credentials with profile: ${awsProfile}`)
        const profileTestCommand = `aws sts get-caller-identity --query Account --output text --profile ${awsProfile}`
        const { stdout } = await execPromise(profileTestCommand)
        const accountId = stdout.trim()
        
        if (accountId && accountId !== 'None') {
          status.tested = true
          status.details['Account ID'] = accountId
          status.details['Credential Source'] = `Profile: ${awsProfile}`
          l.dim(`${p} AWS profile credentials test successful, account: ${accountId}`)
          return status
        }
      } catch (error) {
        const errorMessage = (error as Error).message
        l.dim(`${p} Profile credentials test failed: ${errorMessage}`)
        status.issues.push(`Profile "${awsProfile}" test failed: ${errorMessage}`)
      }
    }
  }
  
  if (!status.configured) {
    status.issues.push('No valid AWS credentials found for S3 access')
    status.issues.push('Run "aws configure" or set AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY')
  }
  
  l.dim(`${p} AWS S3 configuration check completed`)
  return status
}