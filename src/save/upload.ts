import { l, err } from '@/logging'
import { existsSync } from '@/node-utils'
import { getOrCreateBucket } from './bucket'
import { buildUploadCommand } from './command'
import { getPublicUrl } from './services/s3'
import { checkR2Configuration } from './services/r2'
import { checkB2Configuration } from './services/b2'
import { uploadJsonMetadata } from './metadata'
import { execPromise } from '@/node-utils'
import type { ProcessingOptions, UploadMetadata } from '@/types'

export async function uploadToS3(
  filePath: string,
  options: ProcessingOptions,
  sessionId?: string
): Promise<string | null> {
  const p = '[save/upload]'
  l.dim(`${p} Starting ${options.save} upload for file: ${filePath}`)
  
  if (!options.save || !['s3', 'r2', 'b2'].includes(options.save)) {
    l.dim(`${p} Upload not enabled or different service selected`)
    return null
  }
  
  if (!existsSync(filePath)) {
    err(`${p} File not found: ${filePath}`)
    return null
  }
  
  if (options.save === 'r2') {
    const r2Check = checkR2Configuration()
    if (!r2Check.isValid) {
      err(`${p} R2 configuration error: ${r2Check.error}`)
      l.warn(`${p} To use R2, you need to:`)
      l.warn(`${p} 1. Create R2 API tokens at https://dash.cloudflare.com/?to=/:account/r2/api-tokens`)
      l.warn(`${p} 2. Configure AWS CLI with R2 credentials:`)
      l.warn(`${p}    aws configure --profile r2`)
      l.warn(`${p} 3. Set environment variables:`)
      l.warn(`${p}    export AWS_PROFILE=r2`)
      l.warn(`${p}    export CLOUDFLARE_ACCOUNT_ID=your-32-char-hex-account-id`)
      l.warn(`${p} Your account ID can be found in the Cloudflare dashboard or R2 overview page`)
      return null
    }
  }
  
  if (options.save === 'b2') {
    const b2Check = await checkB2Configuration()
    if (!b2Check.isValid) {
      err(`${p} B2 configuration error: ${b2Check.error}`)
      l.warn(`${p} To use B2, you need to:`)
      l.warn(`${p} 1. Create an application key at https://secure.backblaze.com/app_keys.htm`)
      l.warn(`${p} 2. Ensure the key has 'listBuckets' and 'writeFiles' capabilities`)
      l.warn(`${p} 3. Set environment variables:`)
      l.warn(`${p}    export B2_APPLICATION_KEY_ID=your-key-id`)
      l.warn(`${p}    export B2_APPLICATION_KEY=your-application-key`)
      l.warn(`${p}    export B2_REGION=your-region (optional, defaults to us-west-004)`)
      l.warn(`${p} 4. Alternative: export AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY`)
      return null
    }
  }
  
  const bucketName = await getOrCreateBucket(options)
  if (!bucketName) {
    err(`${p} Failed to get or create ${options.save} bucket`)
    return null
  }
  
  const uniqueId = sessionId || Date.now().toString()
  const fileName = filePath.split('/').pop()
  const s3Key = `${uniqueId}/${fileName}`
  
  try {
    l.dim(`${p} Uploading ${filePath} to ${options.save}://${bucketName}/${s3Key}`)
    
    const uploadCommand = buildUploadCommand(filePath, bucketName, s3Key, options)
    const { stderr } = await execPromise(uploadCommand)
    
    if (stderr && !stderr.includes('upload:')) {
      err(`${p} ${options.save} upload warning: ${stderr}`)
    }
    
    const publicUrl = getPublicUrl(options, bucketName, s3Key)
    l.success(`${p} Successfully uploaded to ${options.save}: ${publicUrl}`)
    
    return publicUrl
  } catch (error) {
    err(`${p} Failed to upload to ${options.save}: ${(error as Error).message}`)
    return null
  }
}

export async function uploadAllOutputFiles(
  baseFilePath: string,
  options: ProcessingOptions,
  metadata?: UploadMetadata
): Promise<void> {
  const p = '[save/upload]'
  
  if (!options.save || !['s3', 'r2', 'b2'].includes(options.save)) {
    return
  }
  
  l.dim(`${p} Starting upload process for ${options.save}`)
  
  if (options.save === 'r2') {
    const r2Check = checkR2Configuration()
    if (!r2Check.isValid) {
      err(`${p} R2 configuration error: ${r2Check.error}`)
      l.warn(`${p} Your Cloudflare account ID should be a 32-character hex string`)
      l.warn(`${p} Example: c6494d4164a5eb0cd3848193bd552d68`)
      l.warn(`${p} You can find it in the Cloudflare dashboard URL or R2 overview page`)
      return
    }
  }
  
  if (options.save === 'b2') {
    const b2Check = await checkB2Configuration()
    if (!b2Check.isValid) {
      err(`${p} B2 configuration error: ${b2Check.error}`)
      l.warn(`${p} Please ensure you have valid B2 credentials configured`)
      l.warn(`${p} You can create application keys at https://secure.backblaze.com/app_keys.htm`)
      return
    }
  }
  
  const sessionId = Date.now().toString()
  l.dim(`${p} Using session ID for uploads: ${sessionId}`)
  
  const possibleFiles = [
    `${baseFilePath}-chatgpt-shownotes.md`,
    `${baseFilePath}-claude-shownotes.md`,
    `${baseFilePath}-gemini-shownotes.md`,
    `${baseFilePath}-prompt.md`
  ]
  
  l.dim(`${p} Checking for output files to upload`)
  
  for (const file of possibleFiles) {
    if (existsSync(file)) {
      l.dim(`${p} Found file to upload: ${file}`)
      await uploadToS3(file, options, sessionId)
    }
  }
  
  if (metadata) {
    l.dim(`${p} Uploading JSON metadata`)
    await uploadJsonMetadata(baseFilePath, options, metadata, sessionId)
  }
}