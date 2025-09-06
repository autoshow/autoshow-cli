import { l, err } from '@/logging'
import { updateEnvVariable } from '../env-writer'
import { testCloudflareCredentials } from './test-cloudflare-credentials'
import { createBucket, healthCheck } from '../../save/save-services/cloudflare/client'
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

export async function configureCloudflareInteractive(): Promise<boolean> {
  const p = '[config/cloudflare/configure-cloudflare]'
  l.step('\n=== Cloudflare R2 & Vectorize Configuration ===\n')
  
  l.info('R2 & Vectorize Setup Requirements:')
  l.info('• Cloudflare Account ID (32-character hex string)')
  l.info('• Cloudflare Email (account email)')
  l.info('• Cloudflare Global API Key')
  l.info('• This will set up R2 storage, Vectorize embeddings, and Workers AI')
  l.info('• Get your Global API Key at: https://dash.cloudflare.com/profile/api-tokens\n')
  
  l.dim('Type "skip" to skip R2/Vectorize configuration or press Enter to leave empty\n')
  
  const accountId = await promptForInput('Enter your Cloudflare Account ID: ')
  if (accountId.toLowerCase() === 'skip' || !accountId.trim()) {
    l.info('Skipping R2/Vectorize configuration')
    return false
  }
  
  if (!/^[a-f0-9]{32}$/i.test(accountId)) {
    err(`${p} Invalid Cloudflare Account ID format (must be 32-character hex string)`)
    l.warn('Example: c6494d4164a5eb0cd3848193bd552d68')
    l.warn('Find your Account ID in the Cloudflare dashboard URL or R2 overview page')
    
    const retry = await promptForConfirmation('Would you like to try again? (y/n): ')
    if (retry) {
      return await configureCloudflareInteractive()
    }
    return false
  }
  
  const email = await promptForInput('Enter your Cloudflare Email: ')
  if (email.toLowerCase() === 'skip' || !email.trim()) {
    l.info('Skipping R2/Vectorize configuration')
    return false
  }
  
  if (!email.includes('@')) {
    err(`${p} Invalid email format`)
    const retry = await promptForConfirmation('Would you like to try again? (y/n): ')
    if (retry) {
      return await configureCloudflareInteractive()
    }
    return false
  }
  
  const globalApiKey = await promptForInput('Enter your Cloudflare Global API Key: ')
  if (globalApiKey.toLowerCase() === 'skip' || !globalApiKey.trim()) {
    l.info('Skipping R2/Vectorize configuration')
    return false
  }
  
  if (globalApiKey.length !== 37) {
    err(`${p} Invalid Global API Key format (should be 37 characters)`)
    l.warn('Find your Global API Key at: https://dash.cloudflare.com/profile/api-tokens')
    
    const retry = await promptForConfirmation('Would you like to try again? (y/n): ')
    if (retry) {
      return await configureCloudflareInteractive()
    }
    return false
  }
  
  l.info('\nTesting Cloudflare credentials and creating unified API token...')
  const testResult = await testCloudflareCredentials(accountId, email, globalApiKey)
  
  if (!testResult.valid) {
    err(`${p} Cloudflare credential validation failed: ${testResult.error}`)
    l.warn('\nTroubleshooting Cloudflare Issues:')
    l.warn('• Your Global API Key can be found at: https://dash.cloudflare.com/profile/api-tokens')
    
    const retry = await promptForConfirmation('Would you like to try again with different credentials? (y/n): ')
    if (retry) {
      return await configureCloudflareInteractive()
    }
    return false
  }
  
  l.success('Cloudflare credentials validated successfully!')
  l.info(`Account ID: ${accountId}`)
  l.info(`Email: ${email}`)
  
  if (testResult.details?.['testBucket']) {
    l.info(`Test bucket created: ${testResult.details['testBucket']}`)
    l.info('All R2 operations (create, read, write, delete) tested successfully')
  }
  
  const unifiedToken = process.env['CLOUDFLARE_API_TOKEN']
  if (!unifiedToken) {
    err(`${p} No unified token found after credential testing`)
    return false
  }
  
  l.info('\nVerifying unified API token capabilities...')
  
  const vectorizeWorking = testResult.details?.['vectorizeWorking'] === 'true'
  const workersAIWorking = testResult.details?.['workersAIWorking'] === 'true'
  
  if (vectorizeWorking && workersAIWorking) {
    l.success('All services (R2, Vectorize, Workers AI) are accessible!')
    l.info('Unified token supports embeddings and AI inference')
  } else if (vectorizeWorking) {
    l.warn('Vectorize works but Workers AI access failed - embeddings may not work')
  } else if (workersAIWorking) {
    l.warn('Workers AI works but Vectorize access failed - vector storage may not work')
  } else {
    l.warn('Both Vectorize and Workers AI tests failed - token may have limited functionality')
  }
  
  const saveCredentials = await promptForConfirmation('Save Cloudflare credentials to .env file? (y/n): ')
  if (!saveCredentials) {
    l.info('Cloudflare credentials not saved')
    return false
  }
  
  const success = await Promise.all([
    updateEnvVariable('CLOUDFLARE_ACCOUNT_ID', accountId),
    updateEnvVariable('CLOUDFLARE_EMAIL', email),
    updateEnvVariable('CLOUDFLARE_GLOBAL_API_KEY', globalApiKey)
  ])
  
  if (success.every(Boolean)) {
    l.success('Cloudflare configuration saved successfully!')
    
    l.info('\nRunning final health check...')
    
    const defaultBucketName = `autoshow-${accountId}-auto`.toLowerCase()
    
    l.info(`Creating default bucket: ${defaultBucketName}`)
    const bucketCreated = await createBucket(accountId, defaultBucketName)
    
    if (bucketCreated) {
      const healthCheckPassed = await healthCheck(accountId, defaultBucketName)
      if (healthCheckPassed) {
        l.success('✓ Default bucket created and health check passed!')
      } else {
        l.warn('⚠ Default bucket created but health check failed')
      }
    } else {
      l.warn('⚠ Could not create default bucket, it may already exist')
    }
    
    l.info('\nNext steps:')
    l.info('• See docs/save/03-r2.md for more details\n')
    return true
  } else {
    err(`${p} Failed to save Cloudflare configuration to .env file`)
    return false
  }
}