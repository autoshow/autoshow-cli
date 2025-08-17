import { l, err, logInitialFunctionCall } from '@/logging'
import { configureS3Interactive } from './services/configure-s3'
import { configureR2Interactive } from './services/configure-r2'
import { checkAllConfigs } from './check-all-configs'
import { readEnvFile } from './utils/env-writer'
import { createInterface } from 'readline'
import type { ConfigureOptions } from '@/types'

export async function configureCommand(options: ConfigureOptions): Promise<void> {
  const p = '[config/configure-command]'
  logInitialFunctionCall('configureCommand', options as Record<string, unknown>)
  l.step('\n🔧 AutoShow Cloud Storage Configuration\n')
  
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
  const hasR2 = !!(currentEnv['CLOUDFLARE_ACCOUNT_ID'] && currentEnv['AWS_PROFILE'])
  
  l.info('Current Configuration Status:')
  l.info(`S3: ${hasS3 ? '✓ Configured' : '✗ Not configured'}`)
  l.info(`R2: ${hasR2 ? '✓ Configured' : '✗ Not configured'}\n`)
  
  if (options.service) {
    l.dim(`${p} Configuring specific service: ${options.service}`)
    await configureSpecificService(options.service)
    return
  }
  
  l.info('Choose services to configure:')
  l.info('1. Amazon S3')
  l.info('2. Cloudflare R2')
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
      l.dim(`${p} User selected R2 configuration`)
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

async function configureSpecificService(service: 's3' | 'r2' | 'all'): Promise<void> {
  const p = '[config/configure-command]'
  l.dim(`${p} Starting configuration for service: ${service}`)
  
  if (service === 'all') {
    l.info('Configuring all services. You can skip individual services by typing "skip" when prompted.\n')
    
    const results: Array<{ service: string; success: boolean }> = []
    
    try {
      l.dim(`${p} Starting S3 configuration`)
      const s3Success = await configureS3Interactive()
      results.push({ service: 'S3', success: s3Success })
    } catch (error) {
      err(`${p} Error during S3 configuration: ${(error as Error).message}`)
      results.push({ service: 'S3', success: false })
    }
    
    try {
      l.dim(`${p} Starting R2 configuration`)
      const r2Success = await configureR2Interactive()
      results.push({ service: 'R2', success: r2Success })
    } catch (error) {
      err(`${p} Error during R2 configuration: ${(error as Error).message}`)
      results.push({ service: 'R2', success: false })
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
      l.success('\nConfiguration completed! You can now use the --save option with text commands.')
      l.info('Examples:')
      if (successful.some(r => r.service === 'S3')) {
        l.info('• npm run as -- text --video "URL" --save s3')
      }
      if (successful.some(r => r.service === 'R2')) {
        l.info('• npm run as -- text --rss "FEED" --save r2')
      }
      l.info('')
    }
    return
  }
  
  let success = false
  
  try {
    switch (service) {
      case 's3':
        l.dim(`${p} Configuring S3`)
        success = await configureS3Interactive()
        break
      case 'r2':
        l.dim(`${p} Configuring R2`)
        success = await configureR2Interactive()
        break
    }
    
    if (success) {
      l.success(`${service.toUpperCase()} configuration completed successfully!`)
      l.info(`You can now use --save ${service} with text commands.\n`)
    } else {
      l.warn(`${service.toUpperCase()} configuration was skipped or failed.`)
    }
  } catch (error) {
    err(`${p} Error configuring ${service.toUpperCase()}: ${(error as Error).message}`)
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