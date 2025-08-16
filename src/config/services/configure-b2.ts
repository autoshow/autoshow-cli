import { l, err } from '@/logging'
import { updateEnvVariable } from '../utils/env-writer'
import { testB2Credentials } from '../utils/credential-tester'

export async function configureB2Interactive(): Promise<boolean> {
  const p = '[config/services/configure-b2]'
  l.step('\n=== Backblaze B2 Configuration ===\n')
  
  l.info('B2 Setup Requirements:')
  l.info('• B2 Application Key ID (NOT Master Application Key)')
  l.info('• B2 Application Key')
  l.info('• AWS CLI must be installed')
  l.info('• Required capabilities: listBuckets, writeFiles, readFiles')
  l.info('• Create application key at: https://secure.backblaze.com/app_keys.htm\n')
  
  l.warn('IMPORTANT: Do not use your Master Application Key!')
  l.warn('You must create a restricted Application Key with specific capabilities.\n')
  
  const keyId = await promptForInput('Enter your B2 Application Key ID: ')
  if (!keyId) {
    err(`${p} B2 Application Key ID is required`)
    return false
  }
  
  if (keyId.length < 12) {
    err(`${p} Invalid B2 Application Key ID format (must be at least 12 characters)`)
    return false
  }
  
  const applicationKey = await promptForInput('Enter your B2 Application Key: ')
  if (!applicationKey) {
    err(`${p} B2 Application Key is required`)
    return false
  }
  
  const region = await promptForInput('Enter your B2 Region (default: us-west-004): ') || 'us-west-004'
  
  const validRegions = ['us-west-004', 'us-east-005', 'eu-central-003']
  if (!validRegions.includes(region)) {
    err(`${p} Invalid B2 region. Valid options: ${validRegions.join(', ')}`)
    return false
  }
  
  l.info('\nTesting B2 credentials...')
  const testResult = await testB2Credentials(keyId, applicationKey, region)
  
  if (!testResult.valid) {
    err(`${p} B2 credential validation failed: ${testResult.error}`)
    l.warn('\nTroubleshooting B2 Issues:')
    l.warn('• Ensure you created an Application Key (not Master Key)')
    l.warn('• Key must have listBuckets, writeFiles, readFiles capabilities')
    l.warn('• Check if the key has been revoked or expired')
    l.warn('• Verify the key is not restricted to specific buckets (unless intended)')
    return false
  }
  
  l.success('B2 credentials validated successfully!')
  l.info(`Key ID: ${keyId}`)
  l.info(`Region: ${region}`)
  l.info(`Endpoint: ${testResult.details?.['endpoint']}`)
  
  const saveCredentials = await promptForConfirmation('Save B2 credentials to .env file? (y/n): ')
  if (!saveCredentials) {
    l.info('B2 credentials not saved')
    return false
  }
  
  const success = await Promise.all([
    updateEnvVariable('B2_APPLICATION_KEY_ID', keyId),
    updateEnvVariable('B2_APPLICATION_KEY', applicationKey),
    updateEnvVariable('B2_REGION', region)
  ])
  
  if (success.every(Boolean)) {
    l.success('B2 configuration saved successfully!')
    l.info('\nNext steps:')
    l.info('• Use --save b2 in text commands to upload to B2')
    l.info('• Customize bucket names with --s3-bucket-prefix')
    l.info('• See docs/save/04-b2.md for more details\n')
    return true
  } else {
    err(`${p} Failed to save B2 configuration to .env file`)
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