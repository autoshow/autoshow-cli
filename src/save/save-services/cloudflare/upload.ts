import { l, err } from '@/logging'
import { existsSync, readFileSync } from '@/node-utils'
import { getOrCreateCloudflareBucket } from './bucket'
import { getCloudflarePublicUrl, getCloudflareAccountId } from './utils'
import { checkR2Configuration } from './config'
import { putObject } from './client'
import { uploadCloudflareJsonMetadata } from './metadata'
import type { ProcessingOptions } from '@/text/text-types'
import type { UploadMetadata } from '@/save/save-types'

export async function uploadToCloudflare(
  filePath: string,
  options: ProcessingOptions,
  sessionId?: string
): Promise<string | null> {
  const p = '[save/cloudflare/upload]'
  
  if (!existsSync(filePath)) {
    err(`${p} File not found: ${filePath}`)
    return null
  }
  
  const r2Check = checkR2Configuration()
  if (!r2Check.isValid) {
    err(`${p} R2 configuration error: ${r2Check.error}`)
    return null
  }
  
  const bucketName = await getOrCreateCloudflareBucket(options)
  if (!bucketName) {
    err(`${p} Failed to get or create R2 bucket`)
    return null
  }
  
  const uniqueId = sessionId || Date.now().toString()
  const fileName = filePath.split('/').pop()
  const s3Key = `${uniqueId}/${fileName}`
  
  try {
    const accountId = await getCloudflareAccountId()
    const fileContent = readFileSync(filePath)
    const uploaded = await putObject(accountId, bucketName, s3Key, fileContent)
    
    if (!uploaded) {
      err(`${p} Failed to upload file to R2`)
      return null
    }
    
    const publicUrl = getCloudflarePublicUrl(bucketName, s3Key)
    l.success(`${p} Successfully uploaded to R2: ${publicUrl}`)
    
    return publicUrl
  } catch (error) {
    err(`${p} Failed to upload to R2: ${(error as Error).message}`)
    return null
  }
}

export async function uploadAllCloudflareOutputFiles(
  baseFilePath: string,
  options: ProcessingOptions,
  metadata?: UploadMetadata
): Promise<void> {
  const p = '[save/cloudflare/upload]'
  
  const r2Check = checkR2Configuration()
  if (!r2Check.isValid) {
    err(`${p} R2 configuration error: ${r2Check.error}`)
    return
  }
  
  const sessionId = Date.now().toString()
  
  const possibleFiles = [
    `${baseFilePath}-chatgpt-shownotes.md`,
    `${baseFilePath}-claude-shownotes.md`,
    `${baseFilePath}-gemini-shownotes.md`,
    `${baseFilePath}-prompt.md`
  ]
  
  const uploadPromises = possibleFiles
    .filter(file => existsSync(file))
    .map(file => uploadToCloudflare(file, options, sessionId))
  
  await Promise.all(uploadPromises)
  
  if (metadata) {
    await uploadCloudflareJsonMetadata(baseFilePath, options, metadata, sessionId)
  }
}