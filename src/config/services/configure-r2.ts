import { l, err } from '@/logging'
import { updateEnvVariable } from '../utils/env-writer'
import { testR2Credentials } from '../utils/credential-tester'
import { R2Client } from '@/save/services/r2-client'
import { createInterface } from 'readline'

export async function configureR2Interactive(): Promise<boolean> {
  const p = '[config/services/configure-r2]'
  l.step('\n=== Cloudflare R2 Configuration ===\n')
  
  l.info('R2 Setup Requirements:')
  l.info('• Cloudflare Account ID (32-character hex string)')
  l.info('• Cloudflare Email (account email)')
  l.info('• Cloudflare Global API Key')
  l.info('• Get your Global API Key at: https://dash.cloudflare.com/profile/api-tokens\n')
  
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
  
  const email = await promptForInput('Enter your Cloudflare Email: ')
  if (email.toLowerCase() === 'skip' || !email.trim()) {
    l.info('Skipping R2 configuration')
    return false
  }
  
  if (!email.includes('@')) {
    err(`${p} Invalid email format`)
    const retry = await promptForConfirmation('Would you like to try again? (y/n): ')
    if (retry) {
      return await configureR2Interactive()
    }
    return false
  }
  
  const globalApiKey = await promptForInput('Enter your Cloudflare Global API Key: ')
  if (globalApiKey.toLowerCase() === 'skip' || !globalApiKey.trim()) {
    l.info('Skipping R2 configuration')
    return false
  }
  
  if (globalApiKey.length !== 37) {
    err(`${p} Invalid Global API Key format (should be 37 characters)`)
    l.warn('Find your Global API Key at: https://dash.cloudflare.com/profile/api-tokens')
    
    const retry = await promptForConfirmation('Would you like to try again? (y/n): ')
    if (retry) {
      return await configureR2Interactive()
    }
    return false
  }
  
  l.info('\nTesting R2 credentials and creating API token...')
  const testResult = await testR2Credentials(accountId, email, globalApiKey)
  
  if (!testResult.valid) {
    err(`${p} R2 credential validation failed: ${testResult.error}`)
    l.warn('\nTroubleshooting R2 Issues:')
    l.warn('• Ensure your Account ID is correct (32-character hex string)')
    l.warn('• Verify your email matches your Cloudflare account')
    l.warn('• Check that your Global API Key is valid')
    l.warn('• Ensure R2 is enabled on your Cloudflare account')
    l.warn('• Your Global API Key can be found at: https://dash.cloudflare.com/profile/api-tokens')
    
    const retry = await promptForConfirmation('Would you like to try again with different credentials? (y/n): ')
    if (retry) {
      return await configureR2Interactive()
    }
    return false
  }
  
  l.success('R2 credentials validated successfully!')
  l.info(`Account ID: ${accountId}`)
  l.info(`Email: ${email}`)
  
  if (testResult.details?.['testBucket']) {
    l.info(`Test bucket created: ${testResult.details['testBucket']}`)
    l.info('All R2 operations (create, read, write, delete) tested successfully')
  }
  
  if (testResult.details?.['apiToken']) {
    l.info('R2 API token has been automatically created and saved')
  }
  
  const saveCredentials = await promptForConfirmation('Save R2 credentials to .env file? (y/n): ')
  if (!saveCredentials) {
    l.info('R2 credentials not saved')
    return false
  }
  
  const success = await Promise.all([
    updateEnvVariable('CLOUDFLARE_ACCOUNT_ID', accountId),
    updateEnvVariable('CLOUDFLARE_EMAIL', email),
    updateEnvVariable('CLOUDFLARE_GLOBAL_API_KEY', globalApiKey)
  ])
  
  if (success.every(Boolean)) {
    l.success('R2 configuration saved successfully!')
    
    l.info('\nRunning final health check...')
    process.env['CLOUDFLARE_ACCOUNT_ID'] = accountId
    process.env['CLOUDFLARE_EMAIL'] = email
    process.env['CLOUDFLARE_GLOBAL_API_KEY'] = globalApiKey
    
    const client = new R2Client(accountId)
    const defaultBucketName = `autoshow-${accountId}-auto`.toLowerCase()
    
    l.info(`Creating default bucket: ${defaultBucketName}`)
    const bucketCreated = await client.createBucket(defaultBucketName)
    
    if (bucketCreated) {
      const healthCheckPassed = await client.healthCheck(defaultBucketName)
      if (healthCheckPassed) {
        l.success('✓ Default bucket created and health check passed!')
      } else {
        l.warn('⚠ Default bucket created but health check failed')
      }
    } else {
      l.warn('⚠ Could not create default bucket, it may already exist')
    }
    
    l.info('\nNext steps:')
    l.info('• Use --save r2 in text commands to upload to R2')
    l.info('• Customize bucket names with --s3-bucket-prefix')
    l.info('• An R2 API token has been automatically generated and saved')
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