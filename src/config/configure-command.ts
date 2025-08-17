import { l, err, logInitialFunctionCall } from '@/logging'
import { configureAwsInteractive } from './aws/configure-aws'
import { configureCloudflareInteractive } from './cloudflare/configure-cloudflare'
import { checkAllConfigs } from './check-all-configs'
import { readEnvFile } from './env-writer'
import { createInterface } from 'readline'
import type { ConfigureOptions } from '@/types'

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

async function configureSpecificService(service: 's3' | 'r2' | 'all'): Promise<void> {
  const p = '[config/configure-command]'
  l.dim(`${p} Starting configuration for service: ${service}`)
  
  if (service === 'all') {
    l.info('Configuring all services. You can skip individual services by typing "skip" when prompted.\n')
    
    const results: Array<{ service: string; success: boolean }> = []
    
    try {
      l.dim(`${p} Starting AWS S3 configuration`)
      const awsSuccess = await configureAwsInteractive()
      results.push({ service: 'S3', success: awsSuccess })
    } catch (error) {
      err(`${p} Error during AWS S3 configuration: ${(error as Error).message}`)
      results.push({ service: 'S3', success: false })
    }
    
    try {
      l.dim(`${p} Starting Cloudflare R2/Vectorize configuration`)
      const cloudflareSuccess = await configureCloudflareInteractive()
      results.push({ service: 'R2 & Vectorize', success: cloudflareSuccess })
    } catch (error) {
      err(`${p} Error during Cloudflare R2/Vectorize configuration: ${(error as Error).message}`)
      results.push({ service: 'R2 & Vectorize', success: false })
    }
    
    const successful = results.filter(result => result.success)
    const skipped = results.filter(result => !result.success)
    
    l.final(`\n=== Configuration Summary ===`)
    l.final(`Successfully configured: ${successful.length}/2 services`)
    
    if (successful.length > 0) {
      l.success(`Configured services: ${successful.map(r => r.service).join(', ')}`)
    }
    
    if (skipped.length > 0) {
      l.warn(`Skipped/Failed services: ${skipped.map(r => r.service).join(', ')}`)
    }
    
    if (successful.length > 0) {
      l.success('\nConfiguration completed! You can now use cloud storage and AI services.')
      l.info('Examples:')
      if (successful.some(r => r.service === 'S3')) {
        l.info('• npm run as -- text --video "URL" --save s3')
      }
      if (successful.some(r => r.service.includes('R2'))) {
        l.info('• npm run as -- text --rss "FEED" --save r2')
        l.info('• npm run as -- text embed --create')
        l.info('• npm run as -- text embed --query "your question"')
      }
      l.info('')
    }
    return
  }
  
  let success = false
  
  try {
    switch (service) {
      case 's3':
        l.dim(`${p} Configuring AWS S3`)
        success = await configureAwsInteractive()
        break
      case 'r2':
        l.dim(`${p} Configuring Cloudflare R2/Vectorize`)
        success = await configureCloudflareInteractive()
        break
    }
    
    if (success) {
      const serviceName = service === 'r2' ? 'R2/Vectorize' : service.toUpperCase()
      l.success(`${serviceName} configuration completed successfully!`)
      
      if (service === 'r2') {
        l.info('You can now use:')
        l.info(`• --save r2 with text commands`)
        l.info(`• text embed commands for Vectorize embeddings`)
      } else {
        l.info(`You can now use --save ${service} with text commands.`)
      }
      l.info('')
    } else {
      const serviceName = service === 'r2' ? 'R2/Vectorize' : service.toUpperCase()
      l.warn(`${serviceName} configuration was skipped or failed.`)
    }
  } catch (error) {
    const serviceName = service === 'r2' ? 'R2/Vectorize' : service.toUpperCase()
    err(`${p} Error configuring ${serviceName}: ${(error as Error).message}`)
  }
}

export async function configureCommand(options: ConfigureOptions): Promise<void> {
  const p = '[config/configure-command]'
  logInitialFunctionCall('configureCommand', options as Record<string, unknown>)
  l.step('\n🔧 AutoShow Cloud Storage & AI Services Configuration\n')
  
  if (options.test) {
    l.info('Running configuration test...\n')
    await checkAllConfigs()
    return
  }
  
  if (options.reset) {
    l.warn('Reset functionality not implemented yet')
    l.info('Manually edit .env file to remove credentials\n')
    return
  }
  
  l.dim(`${p} Reading current environment configuration`)
  const currentEnv = await readEnvFile()
  const hasS3 = !!(currentEnv['AWS_ACCESS_KEY_ID'] && currentEnv['AWS_SECRET_ACCESS_KEY'])
  const hasR2 = !!(currentEnv['CLOUDFLARE_ACCOUNT_ID'] && currentEnv['CLOUDFLARE_API_TOKEN'])
  
  l.info('Current Configuration Status:')
  l.info(`S3: ${hasS3 ? '✓ Configured' : '✗ Not configured'}`)
  l.info(`R2 & Vectorize: ${hasR2 ? '✓ Configured' : '✗ Not configured'}\n`)
  
  if (options.service) {
    l.dim(`${p} Configuring specific service: ${options.service}`)
    await configureSpecificService(options.service)
    return
  }
  
  l.info('Choose services to configure:')
  l.info('1. Amazon S3')
  l.info('2. Cloudflare R2 & Vectorize (unified setup)')
  l.info('3. All services')
  l.info('4. Exit\n')
  l.dim('You can skip individual services during configuration by typing "skip"\n')
  
  const choice = await promptForInput('Enter your choice (1-4): ')
  
  switch (choice) {
    case '1':
      l.dim(`${p} User selected S3 configuration`)
      await configureSpecificService('s3')
      break
    case '2':
      l.dim(`${p} User selected R2/Vectorize configuration`)
      await configureSpecificService('r2')
      break
    case '3':
      l.dim(`${p} User selected all services configuration`)
      await configureSpecificService('all')
      break
    case '4':
      l.info('Configuration cancelled')
      break
    default:
      err(`${p} Invalid choice: ${choice}`)
      l.warn('Please run the command again and select a valid option (1-4)')
      break
  }
}