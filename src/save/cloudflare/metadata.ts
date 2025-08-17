import { l, err } from '@/logging'
import { writeFile, existsSync, readFileSync, execPromise } from '@/node-utils'
import { getOrCreateCloudflareBucket } from './bucket'
import { getCloudflarePublicUrl } from './utils'
import { checkR2Configuration } from './config'
import { putObject } from './client'
import { getCloudflareAccountId } from './utils'
import type { ProcessingOptions, UploadMetadata } from '@/types'

export async function uploadCloudflareJsonMetadata(
  baseFilePath: string,
  options: ProcessingOptions,
  metadata: UploadMetadata,
  sessionId: string
): Promise<string | null> {
  const p = '[save/cloudflare/metadata]'
  
  const jsonData = {
    id: parseInt(sessionId),
    metadata: {
      showLink: metadata.metadata.showLink || '',
      channel: metadata.metadata.channel || '',
      channelURL: metadata.metadata.channelURL || '',
      title: metadata.metadata.title,
      description: metadata.metadata.description || '',
      publishDate: metadata.metadata.publishDate,
      coverImage: metadata.metadata.coverImage || ''
    },
    config: {
      transcriptionService: metadata.transcriptionService || '',
      transcriptionModel: metadata.transcriptionModel || '',
      transcriptionCostCents: metadata.transcriptionCostCents,
      audioDuration: Math.round(metadata.audioDuration),
      llmService: metadata.llmService || '',
      llmModel: metadata.llmModel || '',
      llmCostCents: metadata.llmCostCents
    },
    prompt: metadata.promptSections,
    transcript: metadata.transcript,
    llmOutput: metadata.llmOutput
  }
  
  const baseFileName = baseFilePath.split('/').pop()
  const jsonFileName = metadata.llmService 
    ? `${baseFileName}-${metadata.llmService}-metadata.json`
    : `${baseFileName}-metadata.json`
  const jsonFilePath = `${baseFilePath}-metadata.json`
  
  l.dim(`${p} Creating JSON metadata file: ${jsonFilePath}`)
  
  try {
    await writeFile(jsonFilePath, JSON.stringify(jsonData, null, 2))
    l.dim(`${p} JSON metadata file created successfully`)
    
    const bucketName = await getOrCreateCloudflareBucket(options)
    if (!bucketName) {
      err(`${p} Failed to get or create R2 bucket`)
      return null
    }
    
    const s3Key = `${sessionId}/${jsonFileName}`
    
    l.dim(`${p} Uploading JSON to R2://${bucketName}/${s3Key}`)
    
    const r2Check = checkR2Configuration()
    if (!r2Check.isValid) {
      err(`${p} R2 configuration error: ${r2Check.error}`)
      return null
    }
    
    const accountId = await getCloudflareAccountId()
    const fileContent = readFileSync(jsonFilePath)
    const uploaded = await putObject(accountId, bucketName, s3Key, fileContent)
    
    if (!uploaded) {
      err(`${p} Failed to upload JSON metadata to R2`)
      return null
    }
    
    const publicUrl = getCloudflarePublicUrl(bucketName, s3Key)
    l.success(`${p} Successfully uploaded JSON metadata to R2: ${publicUrl}`)
    
    if (!existsSync(jsonFilePath)) {
      l.dim(`${p} JSON file already cleaned up`)
    } else {
      await execPromise(`rm "${jsonFilePath}"`)
      l.dim(`${p} Cleaned up temporary JSON file: ${jsonFilePath}`)
    }
    
    return publicUrl
  } catch (error) {
    err(`${p} Failed to create or upload JSON metadata: ${(error as Error).message}`)
    return null
  }
}