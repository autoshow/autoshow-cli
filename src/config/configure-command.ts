import { l, err, logInitialFunctionCall } from '@/logging'
import { configureS3Interactive } from './services/configure-s3'
import { configureR2Interactive } from './services/configure-r2'
import { configureB2Interactive } from './services/configure-b2'
import { checkAllConfigs } from './check-all-configs'
import { readEnvFile } from './utils/env-writer'
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
  
  const currentEnv = await readEnvFile()
  const hasS3 = !!(currentEnv['AWS_ACCESS_KEY_ID'] && currentEnv['AWS_SECRET_ACCESS_KEY'])
  const hasR2 = !!(currentEnv['CLOUDFLARE_ACCOUNT_ID'] && currentEnv['AWS_PROFILE'])
  const hasB2 = !!(currentEnv['B2_APPLICATION_KEY_ID'] && currentEnv['B2_APPLICATION_KEY'])
  
  l.info('Current Configuration Status:')
  l.info(`S3: ${hasS3 ? '✓ Configured' : '✗ Not configured'}`)
  l.info(`R2: ${hasR2 ? '✓ Configured' : '✗ Not configured'}`)
  l.info(`B2: ${hasB2 ? '✓ Configured' : '✗ Not configured'}\n`)
  
  if (options.service) {
    await configureSpecificService(options.service)
    return
  }
  
  l.info('Choose services to configure:')
  l.info('1. Amazon S3')
  l.info('2. Cloudflare R2')
  l.info('3. Backblaze B2')
  l.info('4. All services')
  l.info('5. Exit\n')
  
  const choice = await promptForInput('Enter your choice (1-5): ')
  
  switch (choice) {
    case '1':
      await configureSpecificService('s3')
      break
    case '2':
      await configureSpecificService('r2')
      break
    case '3':
      await configureSpecificService('b2')
      break
    case '4':
      await configureSpecificService('all')
      break
    case '5':
      l.info('Configuration cancelled')
      break
    default:
      err(`${p} Invalid choice: ${choice}`)
      break
  }
}

async function configureSpecificService(service: 's3' | 'r2' | 'b2' | 'all'): Promise<void> {
  const p = '[config/configure-command]'
  l.dim(`${p} Configuring service: ${service}`)
  
  if (service === 'all') {
    const results = await Promise.allSettled([
      configureS3Interactive(),
      configureR2Interactive(),
      configureB2Interactive()
    ])
    
    const successful = results.filter(result => 
      result.status === 'fulfilled' && result.value === true
    ).length
    
    l.final(`\n=== Configuration Summary ===`)
    l.final(`Successfully configured ${successful}/3 services`)
    
    if (successful > 0) {
      l.success('\nConfiguration completed! You can now use the --save option with text commands.')
      l.info('Examples:')
      l.info('• npm run as -- text --video "URL" --save s3')
      l.info('• npm run as -- text --rss "FEED" --save r2')
      l.info('• npm run as -- text --file "PATH" --save b2\n')
    }
    return
  }
  
  let success = false
  
  switch (service) {
    case 's3':
      success = await configureS3Interactive()
      break
    case 'r2':
      success = await configureR2Interactive()
      break
    case 'b2':
      success = await configureB2Interactive()
      break
  }
  
  if (success) {
    l.success(`${service.toUpperCase()} configuration completed successfully!`)
    l.info(`You can now use --save ${service} with text commands.\n`)
  } else {
    err(`${p} Failed to configure ${service.toUpperCase()}`)
  }
}

async function promptForInput(message: string): Promise<string> {
  const { stdin, stdout } = process
  
  return new Promise((resolve) => {
    stdin.setRawMode(false)
    stdin.setEncoding('utf8')
    stdout.write(message)
    
    stdin.once('data', (data) => {
      resolve(data.toString().trim())
    })
  })
}