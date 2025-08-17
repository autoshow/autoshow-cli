import { l, err } from '@/logging'
import { writeFile, existsSync, readFileSync, execPromise } from '@/node-utils'
import { getOrCreateBucket } from './bucket'
import { buildUploadCommand } from './command'
import { getPublicUrl } from './services/s3'
import { getR2Client } from './services/r2'
import type { ProcessingOptions, UploadMetadata } from '@/types'

export async function uploadJsonMetadata(
  baseFilePath: string,
  options: ProcessingOptions,
  metadata: UploadMetadata,
  sessionId: string
): Promise<string | null> {
  const p = '[save/metadata]'
  
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
    
    const bucketName = await getOrCreateBucket(options)
    if (!bucketName) {
      err(`${p} Failed to get or create ${options.save} bucket`)
      return null
    }
    
    const s3Key = `${sessionId}/${jsonFileName}`
    
    l.dim(`${p} Uploading JSON to ${options.save}://${bucketName}/${s3Key}`)
    
    if (options.save === 'r2') {
      const client = getR2Client()
      if (!client) {
        err(`${p} Failed to create R2 client`)
        return null
      }
      
      const fileContent = readFileSync(jsonFilePath)
      const uploaded = await client.putObject(bucketName, s3Key, fileContent)
      
      if (!uploaded) {
        err(`${p} Failed to upload JSON metadata to R2`)
        return null
      }
    } else {
      const uploadCommand = buildUploadCommand(jsonFilePath, bucketName, s3Key, options)
      const { stderr } = await execPromise(uploadCommand)
      
      if (stderr && !stderr.includes('upload:')) {
        err(`${p} ${options.save} upload warning: ${stderr}`)
      }
    }
    
    const publicUrl = getPublicUrl(options, bucketName, s3Key)
    l.success(`${p} Successfully uploaded JSON metadata to ${options.save}: ${publicUrl}`)
    
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