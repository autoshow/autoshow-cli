import { l, err } from '@/logging'
import { existsSync, readFileSync } from '@/node-utils'
import { getOrCreateBucket } from './bucket'
import { buildUploadCommand } from './command'
import { getPublicUrl } from './services/s3'
import { checkR2Configuration, getR2Client } from './services/r2'
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
  
  if (!options.save || !['s3', 'r2'].includes(options.save)) {
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
      l.warn(`${p} 1. Set environment variables:`)
      l.warn(`${p}    export CLOUDFLARE_ACCOUNT_ID=your-32-char-hex-account-id`)
      l.warn(`${p}    export CLOUDFLARE_EMAIL=your-cloudflare-email`)
      l.warn(`${p}    export CLOUDFLARE_GLOBAL_API_KEY=your-global-api-key`)
      l.warn(`${p} Your account ID can be found in the Cloudflare dashboard`)
      l.warn(`${p} Your global API key can be found in My Profile > API Tokens`)
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
    
    if (options.save === 'r2') {
      const client = getR2Client()
      if (!client) {
        err(`${p} Failed to create R2 client`)
        return null
      }
      
      const fileContent = readFileSync(filePath)
      const uploaded = await client.putObject(bucketName, s3Key, fileContent)
      
      if (!uploaded) {
        err(`${p} Failed to upload file to R2`)
        return null
      }
    } else {
      const uploadCommand = buildUploadCommand(filePath, bucketName, s3Key, options)
      const { stderr } = await execPromise(uploadCommand)
      
      if (stderr && !stderr.includes('upload:')) {
        err(`${p} ${options.save} upload warning: ${stderr}`)
      }
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
  
  if (!options.save || !['s3', 'r2'].includes(options.save)) {
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