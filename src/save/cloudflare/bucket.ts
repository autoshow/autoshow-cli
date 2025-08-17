import { l, err } from '@/logging'
import { checkR2Configuration } from './config'
import { headBucket, createBucket, putBucketVersioning, putBucketLifecycle } from './client'
import { getCloudflareAccountId, getCloudflareRegion } from './utils'
import type { ProcessingOptions } from '@/types'

export async function getOrCreateCloudflareBucket(options: ProcessingOptions): Promise<string | null> {
  const p = '[save/cloudflare/bucket]'
  
  const basePrefix = options.s3BucketPrefix || 'autoshow'
  const accountId = await getCloudflareAccountId()
  const region = getCloudflareRegion()
  const bucketName = `${basePrefix}-${accountId}-${region}`.toLowerCase()
  
  l.dim(`${p} Checking if R2 bucket exists: ${bucketName}`)
  
  const r2Check = checkR2Configuration()
  if (!r2Check.isValid) {
    err(`${p} R2 configuration error: ${r2Check.error}`)
    return null
  }
  
  try {
    const exists = await headBucket(accountId, bucketName)
    if (exists) {
      l.dim(`${p} R2 bucket exists: ${bucketName}`)
      return bucketName
    }
    
    l.dim(`${p} R2 bucket does not exist, creating: ${bucketName}`)
    const created = await createBucket(accountId, bucketName)
    
    if (!created) {
      err(`${p} Failed to create R2 bucket`)
      return null
    }
    
    l.dim(`${p} Successfully created R2 bucket: ${bucketName}`)
    await configureCloudflareBucketDefaults(accountId, bucketName)
    return bucketName
  } catch (error) {
    err(`${p} R2 bucket operation failed: ${(error as Error).message}`)
    return null
  }
}

async function configureCloudflareBucketDefaults(accountId: string, bucketName: string): Promise<void> {
  const p = '[save/cloudflare/bucket]'
  l.dim(`${p} Configuring R2 bucket defaults for: ${bucketName}`)
  
  try {
    await putBucketVersioning(accountId, bucketName, true)
    l.dim(`${p} Enabled versioning for R2 bucket`)
    
    await putBucketLifecycle(accountId, bucketName, 90)
    l.dim(`${p} Configured lifecycle policy for R2 bucket`)
  } catch (error) {
    l.warn(`${p} Failed to configure some R2 bucket defaults: ${(error as Error).message}`)
  }
}