import { l, err } from '@/logging'
import { writeFile, existsSync, execPromise } from '@/node-utils'
import { getOrCreateAwsBucket } from './bucket'
import { buildUploadCommand } from './command'
import { getAwsPublicUrl } from './utils'
import type { ProcessingOptions } from '@/text/text-types'
import type { UploadMetadata } from '@/save/save-types'

export async function uploadAwsJsonMetadata(
  baseFilePath: string,
  options: ProcessingOptions,
  metadata: UploadMetadata,
  sessionId: string
): Promise<string | null> {
  const p = '[save/aws/metadata]'
  
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
  
  try {
    await writeFile(jsonFilePath, JSON.stringify(jsonData, null, 2))
    
    const bucketName = await getOrCreateAwsBucket(options)
    if (!bucketName) {
      err(`${p} Failed to get or create S3 bucket`)
      return null
    }
    
    const s3Key = `${sessionId}/${jsonFileName}`
    
    const uploadCommand = buildUploadCommand(jsonFilePath, bucketName, s3Key, options)
    const { stderr } = await execPromise(uploadCommand)
    
    if (stderr && !stderr.includes('upload:')) {
      err(`${p} S3 upload warning: ${stderr}`)
    }
    
    const publicUrl = getAwsPublicUrl(bucketName, s3Key)
    l.success(`${p} Successfully uploaded JSON metadata to S3: ${publicUrl}`)
    
    if (!existsSync(jsonFilePath)) {
      l.dim(`${p} JSON file already cleaned up`)
    } else {
      await execPromise(`rm "${jsonFilePath}"`)
    }
    
    return publicUrl
  } catch (error) {
    err(`${p} Failed to create or upload JSON metadata: ${(error as Error).message}`)
    return null
  }
}