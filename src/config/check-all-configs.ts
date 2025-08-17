import { l } from '@/logging'
import { checkS3Config } from './check-s3-config'
import { checkR2Configuration } from '@/save/services/r2'
import { R2Client } from '@/save/services/r2-client'
import type { ConfigStatus } from '@/types'

function maskCredential(credential: string | undefined, showLength: number = 4): string {
  if (!credential) return 'Not set'
  if (credential.length <= showLength) return '*'.repeat(credential.length)
  return credential.slice(0, showLength) + '*'.repeat(credential.length - showLength)
}

export async function checkAllConfigs(): Promise<void> {
  const p = '[config/check-all-configs]'
  l.dim(`${p} Starting comprehensive configuration check`)
  
  const configurations: ConfigStatus[] = []
  
  l.dim(`${p} Checking S3 configuration`)
  const s3Status = await checkS3ConfigStatus()
  configurations.push(s3Status)
  
  l.dim(`${p} Checking R2 configuration`)
  const r2Status = await checkR2ConfigStatus()
  configurations.push(r2Status)
  
  l.dim(`${p} Displaying configuration summary`)
  displayConfigurationSummary(configurations)
  
  l.dim(`${p} Providing setup guidance`)
  displaySetupGuidance(configurations)
}

async function checkS3ConfigStatus(): Promise<ConfigStatus> {
  const p = '[config/check-all-configs]'
  const status: ConfigStatus = {
    service: 'Amazon S3',
    configured: false,
    tested: false,
    issues: [],
    details: {}
  }
  
  try {
    const result = await checkS3Config()
    status.configured = result.configured
    status.tested = result.tested
    status.issues = result.issues
    status.details = result.details
  } catch (error) {
    l.dim(`${p} Error checking S3 config: ${(error as Error).message}`)
    status.issues.push(`Configuration check failed: ${(error as Error).message}`)
  }
  
  return status
}

async function checkR2ConfigStatus(): Promise<ConfigStatus> {
  const p = '[config/check-all-configs]'
  const status: ConfigStatus = {
    service: 'Cloudflare R2',
    configured: false,
    tested: false,
    issues: [],
    details: {}
  }
  
  const cloudflareAccountId = process.env['CLOUDFLARE_ACCOUNT_ID']
  const email = process.env['CLOUDFLARE_EMAIL']
  const globalApiKey = process.env['CLOUDFLARE_GLOBAL_API_KEY']
  const r2ApiToken = process.env['CLOUDFLARE_R2_API_TOKEN']
  
  status.details['Account ID'] = maskCredential(cloudflareAccountId, 8)
  status.details['Email'] = email ? email.replace(/^(.{3}).*(@.*)$/, '$1***$2') : 'Not set'
  status.details['Global API Key'] = globalApiKey ? '***' : 'Not set'
  status.details['R2 API Token'] = r2ApiToken ? '***' : 'Not set'
  
  try {
    const r2Check = checkR2Configuration()
    status.configured = r2Check.isValid
    if (!r2Check.isValid && r2Check.error) {
      status.issues.push(r2Check.error)
    }
    
    if (status.configured && cloudflareAccountId) {
      l.dim(`${p} Testing R2 credentials`)
      try {
        const client = new R2Client(cloudflareAccountId)
        const buckets = await client.listBuckets()
        status.tested = true
        status.details['Buckets'] = buckets.length.toString()
        l.dim(`${p} R2 credentials test successful, found ${buckets.length} buckets`)
      } catch (error) {
        const errorMessage = (error as Error).message
        l.dim(`${p} R2 credentials test failed: ${errorMessage}`)
        
        if (errorMessage.includes('Failed to get R2 token')) {
          status.issues.push('Failed to create or use R2 API token - check your credentials')
        } else if (errorMessage.includes('Invalid credentials')) {
          status.issues.push('R2 API credentials are invalid - check your email and Global API Key')
        } else if (errorMessage.includes('Account not found')) {
          status.issues.push('R2 account not found - check your Cloudflare Account ID')
        } else {
          status.issues.push(`Credential test failed: ${errorMessage}`)
        }
      }
    }
  } catch (error) {
    status.issues.push(`Configuration check failed: ${(error as Error).message}`)
  }
  
  return status
}

function displayConfigurationSummary(configurations: ConfigStatus[]): void {
  const p = '[config/check-all-configs]'
  l.dim(`${p} Displaying configuration summary`)
  
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
  const p = '[config/check-all-configs]'
  l.dim(`${p} Displaying setup guidance`)
  
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
        
      case 'Cloudflare R2':
        l.dim('  1. Get your Cloudflare Account ID from the dashboard')
        l.dim('  2. Get your Global API Key at:')
        l.dim('     https://dash.cloudflare.com/profile/api-tokens')
        l.dim('  3. Set environment variables:')
        l.dim('     export CLOUDFLARE_ACCOUNT_ID=your-32-char-hex-account-id')
        l.dim('     export CLOUDFLARE_EMAIL=your-cloudflare-email')
        l.dim('     export CLOUDFLARE_GLOBAL_API_KEY=your-global-api-key')
        l.dim('  4. Run configuration to generate R2 API token:')
        l.dim('     npm run as -- config configure --service r2')
        break
    }
    l.dim('')
  }
  
  l.dim('For detailed setup instructions, see:')
  l.dim('  docs/save/02-s3.md')
  l.dim('  docs/save/03-r2.md')
}