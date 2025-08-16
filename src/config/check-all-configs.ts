import { l } from '@/logging'
import { checkS3Config } from './check-s3-config'
import { checkR2Configuration } from '@/save/services/r2'
import { checkB2Configuration } from '@/save/services/b2'
import { execPromise } from '@/node-utils'

interface ConfigStatus {
  service: string
  configured: boolean
  tested: boolean
  issues: string[]
  details: Record<string, string>
}

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
  
  l.dim(`${p} Checking B2 configuration`)
  const b2Status = await checkB2ConfigStatus()
  configurations.push(b2Status)
  
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
  const awsProfile = process.env['AWS_PROFILE']
  
  status.details['Account ID'] = maskCredential(cloudflareAccountId, 8)
  status.details['AWS Profile'] = awsProfile || 'Not set'
  
  try {
    const r2Check = checkR2Configuration()
    status.configured = r2Check.isValid
    if (!r2Check.isValid && r2Check.error) {
      status.issues.push(r2Check.error)
    }
    
    if (status.configured && cloudflareAccountId) {
      l.dim(`${p} Testing R2 credentials`)
      try {
        const profileArg = awsProfile ? `--profile ${awsProfile}` : ''
        const testCommand = `aws s3api list-buckets ${profileArg} --region auto --endpoint-url "https://${cloudflareAccountId}.r2.cloudflarestorage.com"`
        l.dim(`${p} R2 test command: ${testCommand.replace(cloudflareAccountId, cloudflareAccountId.slice(0, 8) + '***')}`)
        await execPromise(testCommand)
        status.tested = true
        l.dim(`${p} R2 credentials test successful`)
      } catch (error) {
        const errorMessage = (error as Error).message
        l.dim(`${p} R2 credentials test failed: ${errorMessage}`)
        
        if (errorMessage.includes('InvalidRegionName')) {
          status.issues.push('R2 region configuration issue - ensure region is set to "auto" for R2 operations')
        } else if (errorMessage.includes('InvalidAccessKeyId') || errorMessage.includes('SignatureDoesNotMatch')) {
          status.issues.push('R2 API credentials are invalid - check your R2 API tokens and AWS CLI profile configuration')
        } else if (errorMessage.includes('Could not resolve host')) {
          status.issues.push('R2 endpoint unreachable - check your Cloudflare Account ID')
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

async function checkB2ConfigStatus(): Promise<ConfigStatus> {
  const status: ConfigStatus = {
    service: 'Backblaze B2',
    configured: false,
    tested: false,
    issues: [],
    details: {}
  }
  
  const b2KeyId = process.env['B2_APPLICATION_KEY_ID']
  const b2Key = process.env['B2_APPLICATION_KEY']
  const b2Region = process.env['B2_REGION'] || 'us-west-004'
  
  status.details['Key ID'] = maskCredential(b2KeyId, 6)
  status.details['Application Key'] = maskCredential(b2Key, 4)
  status.details['Region'] = b2Region
  
  try {
    const b2Check = await checkB2Configuration()
    status.configured = b2Check.isValid
    status.tested = b2Check.isValid
    if (!b2Check.isValid && b2Check.error) {
      status.issues.push(b2Check.error)
      
      if (b2Check.error.includes('invalid or expired')) {
        status.issues.push('Verify the application key was created with the correct capabilities: listBuckets, writeFiles, readFiles')
        status.issues.push('Check if the key has been revoked or expired in your Backblaze B2 account')
        status.issues.push('Ensure you are not using the Master Application Key (use a restricted application key instead)')
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
  
  const awsProfile = process.env['AWS_PROFILE']
  if (awsProfile === 'r2') {
    l.warn('Global Note: AWS_PROFILE is set to "r2"')
    l.warn('This affects all AWS CLI commands. Consider:')
    l.warn('  • Unset AWS_PROFILE for S3: unset AWS_PROFILE')
    l.warn('  • Or set it only for R2 commands: AWS_PROFILE=r2 npm run as -- text --save r2')
    l.dim('')
  }
  
  for (const config of problematicServices) {
    l.opts(`${config.service} Setup:`)
    
    switch (config.service) {
      case 'Amazon S3':
        if (config.issues.some(issue => issue.includes('r2'))) {
          l.dim('  Current Issue: AWS_PROFILE set to "r2" interferes with S3')
          l.dim('  Quick Fix: Temporarily unset for S3 operations:')
          l.dim('    unset AWS_PROFILE && npm run as -- text --save s3')
          l.dim('  Or use S3 with environment variables:')
          l.dim('    export AWS_ACCESS_KEY_ID=your-s3-key')
          l.dim('    export AWS_SECRET_ACCESS_KEY=your-s3-secret')
        } else {
          l.dim('  1. Install and configure AWS CLI:')
          l.dim('     aws configure')
          l.dim('  2. Set environment variables (optional):')
          l.dim('     export AWS_REGION=us-west-2')
          l.dim('  3. Ensure your credentials have S3 permissions')
        }
        break
        
      case 'Cloudflare R2':
        l.dim('  1. Create R2 API tokens at:')
        l.dim('     https://dash.cloudflare.com/?to=/:account/r2/api-tokens')
        l.dim('  2. Configure AWS CLI profile for R2:')
        l.dim('     aws configure --profile r2')
        l.dim('  3. Set environment variables:')
        l.dim('     export AWS_PROFILE=r2')
        l.dim('     export CLOUDFLARE_ACCOUNT_ID=your-32-char-hex-account-id')
        l.dim('  4. R2 uses region "auto" - do not set AWS_REGION for R2 operations')
        break
        
      case 'Backblaze B2':
        l.dim('  1. Create NEW application key at:')
        l.dim('     https://secure.backblaze.com/app_keys.htm')
        l.dim('  2. Key requirements:')
        l.dim('     - Type: Application Key (NOT Master Key)')
        l.dim('     - Capabilities: listBuckets, writeFiles, readFiles')
        l.dim('     - Access: All buckets OR specific bucket')
        l.dim('  3. Set environment variables:')
        l.dim('     export B2_APPLICATION_KEY_ID=your-new-key-id')
        l.dim('     export B2_APPLICATION_KEY=your-new-application-key')
        l.dim('     export B2_REGION=us-west-004  # Optional')
        if (config.issues.some(issue => issue.includes('invalid or expired'))) {
          l.warn('  4. Your current B2 key is invalid - you must create a new one')
        }
        break
    }
    l.dim('')
  }
  
  l.dim('For detailed setup instructions, see:')
  l.dim('  docs/save/02-s3.md')
  l.dim('  docs/save/03-r2.md') 
  l.dim('  docs/save/04-b2.md')
}