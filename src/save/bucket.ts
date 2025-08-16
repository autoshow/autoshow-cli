import { l, err } from '@/logging'
import { execPromise } from '@/node-utils'
import { buildBucketCommand } from './command'
import { getAccountIdForService, getRegionForService } from './services/s3'
import type { ProcessingOptions } from '@/types'

export async function getOrCreateBucket(options: ProcessingOptions): Promise<string | null> {
  const p = '[save/bucket]'
  
  const basePrefix = options.s3BucketPrefix || 'autoshow'
  const accountId = await getAccountIdForService(options)
  const region = getRegionForService(options)
  const bucketName = `${basePrefix}-${accountId}-${region}`.toLowerCase()
  
  l.dim(`${p} Checking if bucket exists: ${bucketName}`)
  
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
      } else if (options.save === 'r2') {
        createArgs = ' --create-bucket-configuration LocationConstraint="auto"'
      } else if (options.save === 'b2') {
        createArgs = ` --region "${region}"`
      }
      
      const createCommand = buildBucketCommand('create-bucket', bucketName, options, createArgs)
      await execPromise(createCommand)
      l.dim(`${p} Successfully created bucket: ${bucketName}`)
      
      await configureBucketDefaults(bucketName, options)
      
      return bucketName
    } catch (error) {
      err(`${p} Failed to create bucket: ${(error as Error).message}`)
      if (options.save === 'r2' && (error as Error).message.includes('Invalid endpoint')) {
        err(`${p} The endpoint URL appears to be invalid. Please check your CLOUDFLARE_ACCOUNT_ID.`)
        err(`${p} It should be a 32-character hex string like: c6494d4164a5eb0cd3848193bd552d68`)
      }
      if (options.save === 'b2') {
        const errorMessage = (error as Error).message
        if (errorMessage.includes('InvalidAccessKeyId') || errorMessage.includes('not valid')) {
          err(`${p} Invalid B2 credentials detected during bucket creation.`)
          err(`${p} Please verify your B2 Application Key at: https://secure.backblaze.com/app_keys.htm`)
          err(`${p} Required capabilities: listBuckets, writeFiles`)
          err(`${p} Make sure the key is not expired or revoked`)
        } else if (errorMessage.includes('BucketAlreadyExists')) {
          err(`${p} Bucket name '${bucketName}' is already taken. Try a different --s3-bucket-prefix`)
        } else if (errorMessage.includes('Forbidden') || errorMessage.includes('Access Denied')) {
          err(`${p} B2 Application Key lacks bucket creation permissions`)
          err(`${p} Ensure the key has 'listBuckets' and 'writeFiles' capabilities`)
        } else if (errorMessage.includes('endpoint')) {
          err(`${p} The B2 endpoint URL appears to be invalid. Please check your B2_REGION setting.`)
          err(`${p} Common regions include: us-west-004, eu-central-003, us-east-005`)
        }
      }
      return null
    }
  }
}

async function configureBucketDefaults(bucketName: string, options: ProcessingOptions): Promise<void> {
  const p = '[save/bucket]'
  l.dim(`${p} Configuring bucket defaults for: ${bucketName}`)
  
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