import { l, err } from '@/logging'
import { existsSync, execPromise } from '@/node-utils'
import { getOrCreateAwsBucket } from './bucket'
import { buildUploadCommand } from './command'
import { getAwsPublicUrl } from './utils'
import { uploadAwsJsonMetadata } from './metadata'
import type { ProcessingOptions, UploadMetadata } from '@/types'

export async function uploadToAws(
  filePath: string,
  options: ProcessingOptions,
  sessionId?: string
): Promise<string | null> {
  const p = '[save/aws/upload]'
  l.dim(`${p} Starting S3 upload for file: ${filePath}`)
  
  if (!existsSync(filePath)) {
    err(`${p} File not found: ${filePath}`)
    return null
  }
  
  const bucketName = await getOrCreateAwsBucket(options)
  if (!bucketName) {
    err(`${p} Failed to get or create S3 bucket`)
    return null
  }
  
  const uniqueId = sessionId || Date.now().toString()
  const fileName = filePath.split('/').pop()
  const s3Key = `${uniqueId}/${fileName}`
  
  try {
    l.dim(`${p} Uploading ${filePath} to S3://${bucketName}/${s3Key}`)
    
    const uploadCommand = buildUploadCommand(filePath, bucketName, s3Key, options)
    const { stderr } = await execPromise(uploadCommand)
    
    if (stderr && !stderr.includes('upload:')) {
      err(`${p} S3 upload warning: ${stderr}`)
    }
    
    const publicUrl = getAwsPublicUrl(bucketName, s3Key)
    l.success(`${p} Successfully uploaded to S3: ${publicUrl}`)
    
    return publicUrl
  } catch (error) {
    err(`${p} Failed to upload to S3: ${(error as Error).message}`)
    return null
  }
}

export async function uploadAllAwsOutputFiles(
  baseFilePath: string,
  options: ProcessingOptions,
  metadata?: UploadMetadata
): Promise<void> {
  const p = '[save/aws/upload]'
  
  l.dim(`${p} Starting S3 upload process`)
  
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
      await uploadToAws(file, options, sessionId)
    }
  }
  
  if (metadata) {
    l.dim(`${p} Uploading JSON metadata`)
    await uploadAwsJsonMetadata(baseFilePath, options, metadata, sessionId)
  }
}