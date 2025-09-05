import { Command } from 'commander'
import { checkAllConfigs } from './check-all-configs'
import { configureCommand } from './configure-command'
import { logInitialFunctionCall } from '@/logging'
import type { ConfigureOptions } from '@/config/config-types'

export const createConfigCommand = (): Command => {
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
  
  return configCommand
}