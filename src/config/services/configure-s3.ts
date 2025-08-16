import { l, err } from '@/logging'
import { updateEnvVariable } from '../utils/env-writer'
import { testS3Credentials } from '../utils/credential-tester'

export async function configureS3Interactive(): Promise<boolean> {
  const p = '[config/services/configure-s3]'
  l.step('\n=== Amazon S3 Configuration ===\n')
  
  l.info('S3 Setup Requirements:')
  l.info('• AWS Access Key ID (starts with AKIA)')
  l.info('• AWS Secret Access Key (40 characters)')
  l.info('• AWS Region (optional, defaults to us-east-1)')
  l.info('• AWS CLI must be installed\n')
  
  const accessKeyId = await promptForInput('Enter your AWS Access Key ID: ')
  if (!accessKeyId) {
    err(`${p} AWS Access Key ID is required`)
    return false
  }
  
  if (!accessKeyId.startsWith('AKIA') || accessKeyId.length !== 20) {
    err(`${p} Invalid AWS Access Key ID format (should start with AKIA and be 20 characters)`)
    return false
  }
  
  const secretAccessKey = await promptForInput('Enter your AWS Secret Access Key: ')
  if (!secretAccessKey) {
    err(`${p} AWS Secret Access Key is required`)
    return false
  }
  
  if (secretAccessKey.length !== 40) {
    err(`${p} Invalid AWS Secret Access Key format (should be 40 characters)`)
    return false
  }
  
  const region = await promptForInput('Enter your AWS Region (default: us-east-1): ') || 'us-east-1'
  
  l.info('\nTesting S3 credentials...')
  const testResult = await testS3Credentials(accessKeyId, secretAccessKey, region)
  
  if (!testResult.valid) {
    err(`${p} S3 credential validation failed: ${testResult.error}`)
    return false
  }
  
  l.success('S3 credentials validated successfully!')
  l.info(`Account ID: ${testResult.details?.['accountId']}`)
  
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
}

async function promptForInput(message: string): Promise<string> {
  const { stdin, stdout } = process
  stdout.write(message)
  
  return new Promise((resolve) => {
    stdin.once('data', (data) => {
      resolve(data.toString().trim())
    })
  })
}

async function promptForConfirmation(message: string): Promise<boolean> {
  const response = await promptForInput(message)
  return ['y', 'yes', 'true', '1'].includes(response.toLowerCase())
}