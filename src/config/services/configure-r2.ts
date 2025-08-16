import { l, err } from '@/logging'
import { updateEnvVariable } from '../utils/env-writer'
import { testR2Credentials } from '../utils/credential-tester'

export async function configureR2Interactive(): Promise<boolean> {
  const p = '[config/services/configure-r2]'
  l.step('\n=== Cloudflare R2 Configuration ===\n')
  
  l.info('R2 Setup Requirements:')
  l.info('• R2 Access Key ID (32 characters)')
  l.info('• R2 Secret Access Key')
  l.info('• Cloudflare Account ID (32-character hex string)')
  l.info('• AWS CLI must be installed')
  l.info('• Create API tokens at: https://dash.cloudflare.com/?to=/:account/r2/api-tokens\n')
  
  const accountId = await promptForInput('Enter your Cloudflare Account ID: ')
  if (!accountId) {
    err(`${p} Cloudflare Account ID is required`)
    return false
  }
  
  if (!/^[a-f0-9]{32}$/i.test(accountId)) {
    err(`${p} Invalid Cloudflare Account ID format (must be 32-character hex string)`)
    return false
  }
  
  const accessKeyId = await promptForInput('Enter your R2 Access Key ID: ')
  if (!accessKeyId) {
    err(`${p} R2 Access Key ID is required`)
    return false
  }
  
  if (accessKeyId.length !== 32) {
    err(`${p} Invalid R2 Access Key ID format (must be 32 characters)`)
    return false
  }
  
  const secretAccessKey = await promptForInput('Enter your R2 Secret Access Key: ')
  if (!secretAccessKey) {
    err(`${p} R2 Secret Access Key is required`)
    return false
  }
  
  l.info('\nTesting R2 credentials...')
  const testResult = await testR2Credentials(accessKeyId, secretAccessKey, accountId)
  
  if (!testResult.valid) {
    err(`${p} R2 credential validation failed: ${testResult.error}`)
    return false
  }
  
  l.success('R2 credentials validated successfully!')
  l.info(`Account ID: ${accountId}`)
  l.info(`Endpoint: ${testResult.details?.['endpoint']}`)
  
  const saveCredentials = await promptForConfirmation('Save R2 credentials to .env file? (y/n): ')
  if (!saveCredentials) {
    l.info('R2 credentials not saved')
    return false
  }
  
  const success = await Promise.all([
    updateEnvVariable('CLOUDFLARE_ACCOUNT_ID', accountId),
    updateEnvVariable('AWS_PROFILE', 'r2')
  ])
  
  if (success.every(Boolean)) {
    l.success('R2 configuration saved successfully!')
    l.warn('\nIMPORTANT: You must also configure AWS CLI with R2 credentials:')
    l.info('Run: aws configure --profile r2')
    l.info(`Access Key ID: ${accessKeyId}`)
    l.info(`Secret Access Key: ${secretAccessKey}`)
    l.info('Region: auto')
    l.info('Output format: json\n')
    l.info('Next steps:')
    l.info('• Use --save r2 in text commands to upload to R2')
    l.info('• Customize bucket names with --s3-bucket-prefix')
    l.info('• See docs/save/03-r2.md for more details\n')
    return true
  } else {
    err(`${p} Failed to save R2 configuration to .env file`)
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