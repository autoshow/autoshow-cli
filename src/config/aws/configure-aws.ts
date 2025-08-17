import { l, err } from '@/logging'
import { updateEnvVariable } from '../env-writer'
import { testAwsCredentials } from './test-aws-credentials'
import { createInterface } from 'readline'

async function promptForInput(message: string): Promise<string> {
  const rl = createInterface({
    input: process.stdin,
    output: process.stdout
  })
  
  return new Promise((resolve) => {
    rl.question(message, (answer) => {
      rl.close()
      resolve(answer.trim())
    })
  })
}

async function promptForConfirmation(message: string): Promise<boolean> {
  const response = await promptForInput(message)
  return ['y', 'yes', 'true', '1'].includes(response.toLowerCase())
}

export async function configureAwsInteractive(): Promise<boolean> {
  const p = '[config/aws/configure-aws]'
  l.step('\n=== Amazon S3 Configuration ===\n')
  
  l.info('S3 Setup Requirements:')
  l.info('• AWS Access Key ID (starts with AKIA)')
  l.info('• AWS Secret Access Key (40 characters)')
  l.info('• AWS Region (optional, defaults to us-east-1)')
  l.info('• AWS CLI must be installed\n')
  
  l.dim('Type "skip" to skip S3 configuration or press Enter to leave empty\n')
  
  const accessKeyId = await promptForInput('Enter your AWS Access Key ID: ')
  if (accessKeyId.toLowerCase() === 'skip' || !accessKeyId.trim()) {
    l.info('Skipping S3 configuration')
    return false
  }
  
  if (!accessKeyId.startsWith('AKIA') || accessKeyId.length !== 20) {
    err(`${p} Invalid AWS Access Key ID format (should start with AKIA and be 20 characters)`)
    const retry = await promptForConfirmation('Would you like to try again? (y/n): ')
    if (retry) {
      return await configureAwsInteractive()
    }
    return false
  }
  
  const secretAccessKey = await promptForInput('Enter your AWS Secret Access Key: ')
  if (secretAccessKey.toLowerCase() === 'skip' || !secretAccessKey.trim()) {
    l.info('Skipping S3 configuration')
    return false
  }
  
  if (secretAccessKey.length !== 40) {
    err(`${p} Invalid AWS Secret Access Key format (should be 40 characters)`)
    const retry = await promptForConfirmation('Would you like to try again? (y/n): ')
    if (retry) {
      return await configureAwsInteractive()
    }
    return false
  }
  
  const region = await promptForInput('Enter your AWS Region (default: us-east-1): ') || 'us-east-1'
  
  l.info('\nTesting S3 credentials...')
  l.dim(`${p} Temporarily clearing AWS_PROFILE for credential test`)
  const originalProfile = process.env['AWS_PROFILE']
  delete process.env['AWS_PROFILE']
  
  try {
    const testResult = await testAwsCredentials(accessKeyId, secretAccessKey, region)
    
    if (!testResult.valid) {
      err(`${p} S3 credential validation failed: ${testResult.error}`)
      l.warn('\nTroubleshooting S3 Issues:')
      l.warn('• Verify your AWS Access Key ID and Secret Access Key')
      l.warn('• Ensure the credentials have not expired')
      l.warn('• Check that the credentials have S3 permissions')
      l.warn('• Try creating new credentials in the AWS Console')
      
      const retry = await promptForConfirmation('Would you like to try again with different credentials? (y/n): ')
      if (retry) {
        return await configureAwsInteractive()
      }
      return false
    }
    
    l.success('S3 credentials validated successfully!')
    l.info(`Account ID: ${testResult.details?.['accountId']}`)
    l.info(`Region: ${region}`)
    
    const saveCredentials = await promptForConfirmation('Save S3 credentials to .env file? (y/n): ')
    if (!saveCredentials) {
      l.info('S3 credentials not saved')
      return false
    }
    
    const success = await Promise.all([
      updateEnvVariable('AWS_ACCESS_KEY_ID', accessKeyId),
      updateEnvVariable('AWS_SECRET_ACCESS_KEY', secretAccessKey),
      updateEnvVariable('AWS_REGION', region)
    ])
    
    if (success.every(Boolean)) {
      l.success('S3 configuration saved successfully!')
      l.info('\nNext steps:')
      l.info('• Use --save s3 in text commands to upload to S3')
      l.info('• Customize bucket names with --s3-bucket-prefix')
      l.info('• See docs/save/02-s3.md for more details\n')
      return true
    } else {
      err(`${p} Failed to save S3 configuration to .env file`)
      return false
    }
  } finally {
    if (originalProfile) {
      process.env['AWS_PROFILE'] = originalProfile
      l.dim(`${p} Restored AWS_PROFILE to: ${originalProfile}`)
    }
  }
}