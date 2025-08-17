import { Command } from 'commander'
import { checkAllConfigs } from './check-all-configs'
import { configureCommand } from './configure-command'
import { l, logInitialFunctionCall } from '@/logging'
import type { ConfigureOptions } from '@/types'

export const createConfigCommand = (): Command => {
  const p = '[config/create-config-command]'
  l.dim(`${p} Creating config command`)
  
  const configCommand = new Command('config')
    .description('Check cloud storage configurations and credentials')
    .action(async () => {
      logInitialFunctionCall('configCommand', {})
      await checkAllConfigs()
    })
  
  const configureSubCommand = new Command('configure')
    .description('Interactive setup for cloud storage services (S3, R2)')
    .option('--service <service>', 'Configure specific service: s3, r2, or all')
    .option('--reset', 'Reset all configurations (remove from .env)')
    .option('--test', 'Test current configurations without changing anything')
    .action(async (options: ConfigureOptions) => {
      logInitialFunctionCall('configureCommand', options as Record<string, unknown>)
      await configureCommand(options)
    })
  
  configCommand.addCommand(configureSubCommand)
  
  l.dim(`${p} Config command created successfully`)
  return configCommand
}