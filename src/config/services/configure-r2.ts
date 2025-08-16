import { l, err } from '@/logging'
import { updateEnvVariable } from '../utils/env-writer'
import { testR2Credentials } from '../utils/credential-tester'
import { createInterface } from 'readline'

export async function configureR2Interactive(): Promise<boolean> {
  const p = '[config/services/configure-r2]'
  l.step('\n=== Cloudflare R2 Configuration ===\n')
  
  l.info('R2 Setup Requirements:')
  l.info('• R2 Access Key ID (32 characters)')
  l.info('• R2 Secret Access Key')
  l.info('• Cloudflare Account ID (32-character hex string)')
  l.info('• AWS CLI must be installed')
  l.info('• Create API tokens at: https://dash.cloudflare.com/?to=/:account/r2/api-tokens\n')
  
  l.dim('Type "skip" to skip R2 configuration or press Enter to leave empty\n')
  
  const accountId = await promptForInput('Enter your Cloudflare Account ID: ')
  if (accountId.toLowerCase() === 'skip' || !accountId.trim()) {
    l.info('Skipping R2 configuration')
    return false
  }
  
  if (!/^[a-f0-9]{32}$/i.test(accountId)) {
    err(`${p} Invalid Cloudflare Account ID format (must be 32-character hex string)`)
    l.warn('Example: c6494d4164a5eb0cd3848193bd552d68')
    l.warn('Find your Account ID in the Cloudflare dashboard URL or R2 overview page')
    
    const retry = await promptForConfirmation('Would you like to try again? (y/n): ')
    if (retry) {
      return await configureR2Interactive()
    }
    return false
  }
  
  const accessKeyId = await promptForInput('Enter your R2 Access Key ID: ')
  if (accessKeyId.toLowerCase() === 'skip' || !accessKeyId.trim()) {
    l.info('Skipping R2 configuration')
    return false
  }
  
  if (accessKeyId.length !== 32) {
    err(`${p} Invalid R2 Access Key ID format (must be exactly 32 characters)`)
    l.warn('R2 Access Key IDs are different from AWS Access Key IDs')
    l.warn('Create R2-specific API tokens at the Cloudflare dashboard')
    
    const retry = await promptForConfirmation('Would you like to try again? (y/n): ')
    if (retry) {
      return await configureR2Interactive()
    }
    return false
  }
  
  const secretAccessKey = await promptForInput('Enter your R2 Secret Access Key: ')
  if (secretAccessKey.toLowerCase() === 'skip' || !secretAccessKey.trim()) {
    l.info('Skipping R2 configuration')
    return false
  }
  
  l.info('\nTesting R2 credentials...')
  const testResult = await testR2Credentials(accessKeyId, secretAccessKey, accountId)
  
  if (!testResult.valid) {
    err(`${p} R2 credential validation failed: ${testResult.error}`)
    l.warn('\nTroubleshooting R2 Issues:')
    l.warn('• Ensure you created R2-specific API tokens (not AWS credentials)')
    l.warn('• Verify the Account ID is correct (32-character hex string)')
    l.warn('• Check that the API tokens have Admin Read & Write permissions')
    l.warn('• Try regenerating the API tokens if they appear invalid')
    
    const retry = await promptForConfirmation('Would you like to try again with different credentials? (y/n): ')
    if (retry) {
      return await configureR2Interactive()
    }
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