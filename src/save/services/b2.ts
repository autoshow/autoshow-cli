import { l } from '@/logging'
import { execPromise } from '@/node-utils'
import { buildCommandWithEnv } from '../command'
import type { ProcessingOptions } from '@/types'

export async function checkB2Configuration(): Promise<{ isValid: boolean; error?: string }> {
  const p = '[save/services/b2]'
  const b2KeyId = process.env['B2_APPLICATION_KEY_ID']
  const b2Key = process.env['B2_APPLICATION_KEY']
  
  l.dim(`${p} Checking B2 configuration`)
  
  if (!b2KeyId) {
    return { 
      isValid: false, 
      error: 'B2_APPLICATION_KEY_ID environment variable is not set' 
    }
  }
  
  if (!b2Key) {
    return {
      isValid: false,
      error: 'B2_APPLICATION_KEY environment variable is not set'
    }
  }
  
  if (b2KeyId.length < 12) {
    return {
      isValid: false,
      error: `Invalid B2_APPLICATION_KEY_ID format. Expected at least 12 characters, got: ${b2KeyId.length}`
    }
  }
  
  l.dim(`${p} Testing B2 credentials by listing buckets`)
  l.dim(`${p} Using Key ID: ${b2KeyId.slice(0, 6)}${'*'.repeat(b2KeyId.length - 6)}`)
  
  try {
    const region = process.env['B2_REGION'] || 'us-west-004'
    const testCommand = buildCommandWithEnv(
      `aws s3api list-buckets --endpoint-url "https://s3.${region}.backblazeb2.com"`,
      { save: 'b2' } as ProcessingOptions
    )
    
    l.dim(`${p} Testing with endpoint: https://s3.${region}.backblazeb2.com`)
    await execPromise(testCommand)
    l.dim(`${p} B2 credentials are valid`)
    return { isValid: true }
  } catch (error) {
    const errorMessage = (error as Error).message
    l.dim(`${p} B2 credential test failed with error: ${errorMessage}`)
    
    if (errorMessage.includes('InvalidAccessKeyId') || errorMessage.includes('not valid')) {
      return {
        isValid: false,
        error: `B2 Application Key ID '${b2KeyId.slice(0, 6)}***' is invalid or expired. Please check your credentials at https://secure.backblaze.com/app_keys.htm`
      }
    }
    
    if (errorMessage.includes('SignatureDoesNotMatch')) {
      return {
        isValid: false,
        error: `B2 Application Key signature mismatch. Please verify your B2_APPLICATION_KEY is correct and matches the Key ID`
      }
    }
    
    if (errorMessage.includes('Forbidden') || errorMessage.includes('Access Denied')) {
      return {
        isValid: false,
        error: `B2 Application Key lacks required permissions. Ensure it has 'listBuckets' capability and is not restricted to specific buckets`
      }
    }
    
    if (errorMessage.includes('Could not resolve host') || errorMessage.includes('endpoint')) {
      return {
        isValid: false,
        error: `B2 endpoint connection failed. Check your B2_REGION setting (current: ${process.env['B2_REGION'] || 'us-west-004'})`
      }
    }
    
    return {
      isValid: false,
      error: `B2 credential test failed: ${errorMessage}`
    }
  }
}

export function getB2EnvironmentVars(): Record<string, string> {
  const p = '[save/services/b2]'
  const b2KeyId = process.env['B2_APPLICATION_KEY_ID']
  const b2Key = process.env['B2_APPLICATION_KEY']
  
  if (!b2KeyId || !b2Key) {
    l.dim(`${p} B2 credentials not found in environment`)
    return {}
  }
  
  l.dim(`${p} B2 credentials found, returning environment variables`)
  return {
    AWS_ACCESS_KEY_ID: b2KeyId,
    AWS_SECRET_ACCESS_KEY: b2Key
  }
}