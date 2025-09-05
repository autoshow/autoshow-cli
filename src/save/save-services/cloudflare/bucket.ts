import { l, err } from '@/logging'
import { checkR2Configuration } from './config'
import { headBucket, createBucket, putBucketVersioning, putBucketLifecycle } from './client'
import { getCloudflareAccountId, getCloudflareRegion } from './utils'
import type { ProcessingOptions } from '@/text/text-types'

export async function getOrCreateCloudflareBucket(options: ProcessingOptions): Promise<string | null> {
  const p = '[save/cloudflare/bucket]'
  
  const basePrefix = options.s3BucketPrefix || 'autoshow'
  const accountId = await getCloudflareAccountId()
  const region = getCloudflareRegion()
  const bucketName = `${basePrefix}-${accountId}-${region}`.toLowerCase()
  
  const r2Check = checkR2Configuration()
  if (!r2Check.isValid) {
    err(`${p} R2 configuration error: ${r2Check.error}`)
    return null
  }
  
  try {
    const exists = await headBucket(accountId, bucketName)
    if (exists) {
      return bucketName
    }
    
    const created = await createBucket(accountId, bucketName)
    
    if (!created) {
      err(`${p} Failed to create R2 bucket`)
      return null
    }
    
    l.success(`${p} Created R2 bucket: ${bucketName}`)
    await configureCloudflareBucketDefaults(accountId, bucketName)
    return bucketName
  } catch (error) {
    err(`${p} R2 bucket operation failed: ${(error as Error).message}`)
    return null
  }
}

async function configureCloudflareBucketDefaults(accountId: string, bucketName: string): Promise<void> {
  const p = '[save/cloudflare/bucket]'
  
  try {
    await putBucketVersioning(accountId, bucketName, true)
    await putBucketLifecycle(accountId, bucketName, 90)
  } catch (error) {
    l.warn(`${p} Failed to configure some R2 bucket defaults: ${(error as Error).message}`)
  }
}