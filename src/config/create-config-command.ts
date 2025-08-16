import { Command } from 'commander'
import { checkAllConfigs } from './check-all-configs'
import { l, err, logInitialFunctionCall } from '@/logging'
import { exit } from '@/node-utils'

export const createConfigCommand = (): Command => {
  const p = '[config/create-config-command]'
  l.dim(`${p} Creating config command`)
  
  const configCommand = new Command('config')
    .description('Analyze and diagnose cloud storage configurations for S3, R2, and B2')
    .action(async () => {
      logInitialFunctionCall('configCommand', {})
      
      try {
        l.step('\nCloud Storage Configuration Analysis\n')
        await checkAllConfigs()
        l.success('\nConfiguration analysis completed successfully')
      } catch (error) {
        err(`Configuration analysis failed: ${(error as Error).message}`)
        exit(1)
      }
    })
  
  l.dim(`${p} Config command created successfully`)
  return configCommand
}