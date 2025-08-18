import { l } from '@/logging'
import { checkAwsConfig } from './aws/check-aws-config'
import { checkCloudflareConfig } from './cloudflare/check-cloudflare-config'
import type { ConfigStatus } from '@/config/config-types'

function displayConfigurationSummary(configurations: ConfigStatus[]): void {
  l.step('Configuration Summary:')
  l.dim('═'.repeat(80))
  
  for (const config of configurations) {
    const statusIcon = config.configured ? '✓' : '✗'
    const testIcon = config.tested ? '✓' : (config.configured ? '⚠' : '✗')
    
    l.opts(`${statusIcon} ${config.service}`)
    l.dim(`  Configured: ${config.configured ? 'Yes' : 'No'}`)
    l.dim(`  Tested: ${config.tested ? 'Yes' : 'No'} ${testIcon}`)
    
    if (Object.keys(config.details).length > 0) {
      l.dim('  Settings:')
      for (const [key, value] of Object.entries(config.details)) {
        l.dim(`    ${key}: ${value}`)
      }
    }
    
    if (config.issues.length > 0) {
      l.warn('  Issues:')
      for (const issue of config.issues) {
        l.warn(`    • ${issue}`)
      }
    }
    l.dim('')
  }
}

function displaySetupGuidance(configurations: ConfigStatus[]): void {
  const problematicServices = configurations.filter(config => !config.configured || config.issues.length > 0)
  
  if (problematicServices.length === 0) {
    l.success('All cloud storage services are properly configured and tested!')
    return
  }
  
  l.step('\nSetup Guidance:')
  l.dim('═'.repeat(80))
  
  for (const config of problematicServices) {
    l.opts(`${config.service} Setup:`)
    
    switch (config.service) {
      case 'Amazon S3':
        l.dim('  1. Install and configure AWS CLI:')
        l.dim('     aws configure')
        l.dim('  2. Set environment variables (optional):')
        l.dim('     export AWS_REGION=us-west-2')
        l.dim('  3. Ensure your credentials have S3 permissions')
        break
        
      case 'Cloudflare R2 & Vectorize':
        l.dim('  1. Get your Cloudflare Account ID from the dashboard')
        l.dim('  2. Get your Global API Key at:')
        l.dim('     https://dash.cloudflare.com/profile/api-tokens')
        l.dim('  3. Run interactive configuration:')
        l.dim('     npm run as -- config configure --service r2')
        l.dim('  4. This will set up both R2 storage and Vectorize embeddings')
        l.dim('  5. A unified API token will be created automatically')
        break
    }
    l.dim('')
  }
  
  l.dim('For detailed setup instructions, see:')
  l.dim('  docs/save/02-s3.md')
  l.dim('  docs/save/03-r2.md')
}

export async function checkAllConfigs(): Promise<void> {
  const configurations: ConfigStatus[] = []
  
  const awsStatus = await checkAwsConfig()
  configurations.push(awsStatus)
  
  const cloudflareStatus = await checkCloudflareConfig()
  configurations.push(cloudflareStatus)
  
  displayConfigurationSummary(configurations)
  displaySetupGuidance(configurations)
}