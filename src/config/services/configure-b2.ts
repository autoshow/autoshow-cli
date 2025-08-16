import { l, err } from '@/logging'
import { updateEnvVariable } from '../utils/env-writer'
import { testB2Credentials } from '../utils/credential-tester'
import { createInterface } from 'readline'

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
  
  l.dim('Type "skip" to skip B2 configuration or press Enter to leave empty\n')
  
  const keyId = await promptForInput('Enter your B2 Application Key ID: ')
  if (keyId.toLowerCase() === 'skip' || !keyId.trim()) {
    l.info('Skipping B2 configuration')
    return false
  }
  
  if (keyId.length < 12) {
    err(`${p} Invalid B2 Application Key ID format (must be at least 12 characters)`)
    l.warn('B2 Application Key IDs are typically around 25 characters long')
    l.warn('Example: 005d2f4eee1e3540000000002')
    l.warn('Make sure you are not using the Master Application Key')
    
    const retry = await promptForConfirmation('Would you like to try again? (y/n): ')
    if (retry) {
      return await configureB2Interactive()
    }
    return false
  }
  
  const applicationKey = await promptForInput('Enter your B2 Application Key: ')
  if (applicationKey.toLowerCase() === 'skip' || !applicationKey.trim()) {
    l.info('Skipping B2 configuration')
    return false
  }
  
  const region = await promptForInput('Enter your B2 Region (default: us-west-004): ') || 'us-west-004'
  
  const validRegions = ['us-west-004', 'us-east-005', 'eu-central-003']
  if (!validRegions.includes(region)) {
    err(`${p} Invalid B2 region. Valid options: ${validRegions.join(', ')}`)
    l.warn('Most common region is us-west-004 (California)')
    
    const retry = await promptForConfirmation('Would you like to try again? (y/n): ')
    if (retry) {
      return await configureB2Interactive()
    }
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
    l.warn('• Create a new Application Key at: https://secure.backblaze.com/app_keys.htm')
    
    if (testResult.error?.includes('invalid or expired')) {
      l.warn('\nYour current B2 key appears to be invalid. You need to:')
      l.warn('1. Go to https://secure.backblaze.com/app_keys.htm')
      l.warn('2. Delete the old application key')
      l.warn('3. Create a new Application Key with proper capabilities')
      l.warn('4. Use the new credentials')
    }
    
    const retry = await promptForConfirmation('Would you like to try again with different credentials? (y/n): ')
    if (retry) {
      return await configureB2Interactive()
    }
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