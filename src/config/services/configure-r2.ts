import { l, err } from '@/logging'
import { updateEnvVariable } from '../utils/env-writer'
import { testR2Credentials } from '../utils/credential-tester'
import { R2Client } from '@/save/services/r2-client'
import { createInterface } from 'readline'

async function testVectorizeAPI(accountId: string, apiToken: string): Promise<boolean> {
  const p = '[config/services/configure-r2]'
  
  try {
    l.dim(`${p} Testing Vectorize API access`)
    const response = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${accountId}/vectorize/v2/indexes`,
      {
        headers: {
          'Authorization': `Bearer ${apiToken}`,
          'Content-Type': 'application/json'
        }
      }
    )
    
    if (response.ok) {
      const data = await response.json()
      l.dim(`${p} Vectorize API test successful, found ${data.result?.length || 0} indexes`)
      return true
    } else if (response.status === 403) {
      err(`${p} Vectorize API access denied - insufficient permissions`)
      return false
    } else {
      err(`${p} Vectorize API test failed with status: ${response.status}`)
      return false
    }
  } catch (error) {
    err(`${p} Error testing Vectorize API: ${(error as Error).message}`)
    return false
  }
}

async function testWorkersAI(accountId: string, apiToken: string): Promise<boolean> {
  const p = '[config/services/configure-r2]'
  
  try {
    l.dim(`${p} Testing Workers AI access with bge-m3 model`)
    const response = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/@cf/baai/bge-m3`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          text: 'test embedding'
        })
      }
    )
    
    if (response.ok) {
      const data = await response.json()
      if (data.success && data.result?.data?.[0]) {
        l.dim(`${p} Workers AI test successful with bge-m3 model`)
        return true
      } else {
        err(`${p} Workers AI returned unsuccessful response`)
        return false
      }
    } else if (response.status === 403) {
      err(`${p} Workers AI access denied - insufficient permissions`)
      return false
    } else {
      err(`${p} Workers AI test failed with status: ${response.status}`)
      return false
    }
  } catch (error) {
    err(`${p} Error testing Workers AI: ${(error as Error).message}`)
    return false
  }
}

export async function configureR2Interactive(): Promise<boolean> {
  const p = '[config/services/configure-r2]'
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
      return await configureR2Interactive()
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
      return await configureR2Interactive()
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
      return await configureR2Interactive()
    }
    return false
  }
  
  l.info('\nTesting R2 credentials and creating unified API token...')
  const testResult = await testR2Credentials(accountId, email, globalApiKey)
  
  if (!testResult.valid) {
    err(`${p} R2 credential validation failed: ${testResult.error}`)
    l.warn('\nTroubleshooting R2/Vectorize Issues:')
    l.warn('• Ensure your Account ID is correct (32-character hex string)')
    l.warn('• Verify your email matches your Cloudflare account')
    l.warn('• Check that your Global API Key is valid')
    l.warn('• Ensure R2, Vectorize, and Workers AI are enabled on your Cloudflare account')
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
  
  const unifiedToken = process.env['CLOUDFLARE_API_TOKEN']
  if (!unifiedToken) {
    err(`${p} No unified token found after credential testing`)
    return false
  }
  
  l.info('\nVerifying unified API token capabilities...')
  l.dim(`${p} Using token created during credential testing`)
  
  const vectorizeTest = await testVectorizeAPI(accountId, unifiedToken)
  const workersAITest = await testWorkersAI(accountId, unifiedToken)
  
  if (vectorizeTest && workersAITest) {
    l.success('All services (R2, Vectorize, Workers AI) are accessible!')
    l.info('Unified token supports embeddings and AI inference')
  } else if (vectorizeTest) {
    l.warn('Vectorize works but Workers AI access failed - embeddings may not work')
  } else if (workersAITest) {
    l.warn('Workers AI works but Vectorize access failed - vector storage may not work')
  } else {
    l.warn('Both Vectorize and Workers AI tests failed - token may have limited functionality')
  }
  
  const saveCredentials = await promptForConfirmation('Save R2/Vectorize/Workers AI credentials to .env file? (y/n): ')
  if (!saveCredentials) {
    l.info('R2/Vectorize/Workers AI credentials not saved')
    return false
  }
  
  const success = await Promise.all([
    updateEnvVariable('CLOUDFLARE_ACCOUNT_ID', accountId),
    updateEnvVariable('CLOUDFLARE_EMAIL', email),
    updateEnvVariable('CLOUDFLARE_GLOBAL_API_KEY', globalApiKey)
  ])
  
  if (success.every(Boolean)) {
    l.success('R2/Vectorize/Workers AI configuration saved successfully!')
    
    l.info('\nRunning final health check...')
    
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
    l.info('• Use text embed commands to create and query Vectorize embeddings')
    l.info('• Customize bucket names with --s3-bucket-prefix')
    l.info('• A unified API token has been automatically generated and saved')
    l.info('• See docs/save/03-r2.md for more details\n')
    return true
  } else {
    err(`${p} Failed to save R2/Vectorize/Workers AI configuration to .env file`)
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