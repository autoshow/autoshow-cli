import { l, err } from '@/logging'
import { execPromise } from '@/node-utils'
import { buildBucketCommand } from './command'
import { getAccountIdForService, getRegionForService } from './services/s3'
import { getR2Client } from './services/r2'
import type { ProcessingOptions } from '@/types'

export async function getOrCreateBucket(options: ProcessingOptions): Promise<string | null> {
  const p = '[save/bucket]'
  
  const basePrefix = options.s3BucketPrefix || 'autoshow'
  const accountId = await getAccountIdForService(options)
  const region = getRegionForService(options)
  const bucketName = `${basePrefix}-${accountId}-${region}`.toLowerCase()
  
  l.dim(`${p} Checking if bucket exists: ${bucketName}`)
  
  if (options.save === 'r2') {
    const client = getR2Client()
    if (!client) {
      err(`${p} Failed to create R2 client`)
      return null
    }
    
    try {
      const exists = await client.headBucket(bucketName)
      if (exists) {
        l.dim(`${p} Bucket exists: ${bucketName}`)
        return bucketName
      }
      
      l.dim(`${p} Bucket does not exist, creating: ${bucketName}`)
      const created = await client.createBucket(bucketName)
      
      if (!created) {
        err(`${p} Failed to create R2 bucket`)
        return null
      }
      
      l.dim(`${p} Successfully created bucket: ${bucketName}`)
      await configureBucketDefaults(bucketName, options)
      return bucketName
    } catch (error) {
      err(`${p} R2 bucket operation failed: ${(error as Error).message}`)
      return null
    }
  }
  
  try {
    const checkCommand = buildBucketCommand('head-bucket', bucketName, options) + ' 2>/dev/null'
    await execPromise(checkCommand)
    l.dim(`${p} Bucket exists: ${bucketName}`)
    return bucketName
  } catch {
    l.dim(`${p} Bucket does not exist, creating: ${bucketName}`)
    
    try {
      let createArgs = ''
      if (options.save === 's3' && region !== 'us-east-1') {
        createArgs = ` --region "${region}" --create-bucket-configuration LocationConstraint="${region}"`
      }
      
      const createCommand = buildBucketCommand('create-bucket', bucketName, options, createArgs)
      await execPromise(createCommand)
      l.dim(`${p} Successfully created bucket: ${bucketName}`)
      
      await configureBucketDefaults(bucketName, options)
      
      return bucketName
    } catch (error) {
      err(`${p} Failed to create bucket: ${(error as Error).message}`)
      return null
    }
  }
}

async function configureBucketDefaults(bucketName: string, options: ProcessingOptions): Promise<void> {
  const p = '[save/bucket]'
  l.dim(`${p} Configuring bucket defaults for: ${bucketName}`)
  
  if (options.save === 'r2') {
    const client = getR2Client()
    if (!client) {
      err(`${p} Failed to create R2 client for bucket configuration`)
      return
    }
    
    try {
      await client.putBucketVersioning(bucketName, true)
      l.dim(`${p} Enabled versioning for R2 bucket`)
      
      await client.putBucketLifecycle(bucketName, 90)
      l.dim(`${p} Configured lifecycle policy for R2 bucket`)
    } catch (error) {
      l.warn(`${p} Failed to configure some R2 bucket defaults: ${(error as Error).message}`)
    }
    return
  }
  
  try {
    const versioningCommand = buildBucketCommand('put-bucket-versioning', bucketName, options, ' --versioning-configuration Status=Enabled')
    await execPromise(versioningCommand)
    l.dim(`${p} Enabled versioning for bucket`)
    
    if (options.save === 's3') {
      const publicAccessCommand = buildBucketCommand(
        'put-public-access-block',
        bucketName,
        options,
        ' --public-access-block-configuration "BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true"'
      )
      await execPromise(publicAccessCommand)
      l.dim(`${p} Configured public access block for bucket`)
    }
    
    const lifecyclePolicy = {
      Rules: [{
        ID: 'DeleteOldFiles',
        Status: 'Enabled',
        Expiration: { Days: 90 }
      }]
    }
    const lifecycleJson = JSON.stringify(lifecyclePolicy).replace(/"/g, '\\"')
    const lifecycleCommand = buildBucketCommand(
      'put-bucket-lifecycle-configuration',
      bucketName,
      options,
      ` --lifecycle-configuration "${lifecycleJson}"`
    )
    await execPromise(lifecycleCommand)
    l.dim(`${p} Configured lifecycle policy for bucket`)
    
  } catch (error) {
    l.warn(`${p} Failed to configure some bucket defaults: ${(error as Error).message}`)
  }
}