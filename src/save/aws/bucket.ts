import { l, err } from '@/logging'
import { execPromise } from '@/node-utils'
import { buildBucketCommand } from './command'
import { getAwsAccountId, getAwsRegion } from './utils'
import type { ProcessingOptions } from '@/text/text-types'

export async function getOrCreateAwsBucket(options: ProcessingOptions): Promise<string | null> {
  const p = '[save/aws/bucket]'
  
  const basePrefix = options.s3BucketPrefix || 'autoshow'
  const accountId = await getAwsAccountId()
  const region = getAwsRegion()
  const bucketName = `${basePrefix}-${accountId}-${region}`.toLowerCase()
  
  try {
    const checkCommand = buildBucketCommand('head-bucket', bucketName, options) + ' 2>/dev/null'
    await execPromise(checkCommand)
    return bucketName
  } catch {
    try {
      let createArgs = ''
      if (region !== 'us-east-1') {
        createArgs = ` --region "${region}" --create-bucket-configuration LocationConstraint="${region}"`
      }
      
      const createCommand = buildBucketCommand('create-bucket', bucketName, options, createArgs)
      await execPromise(createCommand)
      l.success(`${p} Created S3 bucket: ${bucketName}`)
      
      await configureAwsBucketDefaults(bucketName, options)
      
      return bucketName
    } catch (error) {
      err(`${p} Failed to create S3 bucket: ${(error as Error).message}`)
      return null
    }
  }
}

async function configureAwsBucketDefaults(bucketName: string, options: ProcessingOptions): Promise<void> {
  const p = '[save/aws/bucket]'
  
  try {
    const versioningCommand = buildBucketCommand('put-bucket-versioning', bucketName, options, ' --versioning-configuration Status=Enabled')
    await execPromise(versioningCommand)
    
    const publicAccessCommand = buildBucketCommand(
      'put-public-access-block',
      bucketName,
      options,
      ' --public-access-block-configuration "BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true"'
    )
    await execPromise(publicAccessCommand)
    
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
    
  } catch (error) {
    l.warn(`${p} Failed to configure some S3 bucket defaults: ${(error as Error).message}`)
  }
}