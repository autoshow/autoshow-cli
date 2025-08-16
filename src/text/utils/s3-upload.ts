import { l, err } from '@/logging'
import { execPromise, existsSync, writeFile } from '@/node-utils'
import type { ProcessingOptions, ShowNoteMetadata } from '@/types'

interface UploadMetadata {
  metadata: ShowNoteMetadata
  transcriptionService?: string
  transcriptionModel?: string
  transcriptionCostCents: number
  audioDuration: number
  llmService?: string
  llmModel?: string
  llmCostCents: number
  promptSections: string[]
  transcript: string
  llmOutput: string
}

export async function uploadToS3(
  filePath: string,
  options: ProcessingOptions,
  sessionId?: string
): Promise<string | null> {
  const p = '[text/utils/s3-upload]'
  l.dim(`${p} Starting S3 upload for file: ${filePath}`)
  
  if (!options.save || options.save !== 's3') {
    l.dim(`${p} S3 upload not enabled or different service selected`)
    return null
  }
  
  if (!existsSync(filePath)) {
    err(`${p} File not found: ${filePath}`)
    return null
  }
  
  const bucketName = await getOrCreateBucket(options)
  if (!bucketName) {
    err(`${p} Failed to get or create S3 bucket`)
    return null
  }
  
  const uniqueId = sessionId || Date.now().toString()
  const fileName = filePath.split('/').pop()
  const s3Key = `${uniqueId}/${fileName}`
  
  try {
    l.dim(`${p} Uploading ${filePath} to s3://${bucketName}/${s3Key}`)
    
    const uploadCommand = `aws s3 cp "${filePath}" "s3://${bucketName}/${s3Key}"`
    const { stderr } = await execPromise(uploadCommand)
    
    if (stderr && !stderr.includes('upload:')) {
      err(`${p} S3 upload warning: ${stderr}`)
    }
    
    const s3Url = `https://${bucketName}.s3.amazonaws.com/${s3Key}`
    l.success(`${p} Successfully uploaded to S3: ${s3Url}`)
    
    return s3Url
  } catch (error) {
    err(`${p} Failed to upload to S3: ${(error as Error).message}`)
    return null
  }
}

async function uploadJsonMetadata(
  baseFilePath: string,
  options: ProcessingOptions,
  metadata: UploadMetadata,
  sessionId: string
): Promise<string | null> {
  const p = '[text/utils/s3-upload]'
  
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
      err(`${p} Failed to get or create S3 bucket`)
      return null
    }
    
    const s3Key = `${sessionId}/${jsonFileName}`
    
    l.dim(`${p} Uploading JSON to s3://${bucketName}/${s3Key}`)
    
    const uploadCommand = `aws s3 cp "${jsonFilePath}" "s3://${bucketName}/${s3Key}"`
    const { stderr } = await execPromise(uploadCommand)
    
    if (stderr && !stderr.includes('upload:')) {
      err(`${p} S3 upload warning: ${stderr}`)
    }
    
    const s3Url = `https://${bucketName}.s3.amazonaws.com/${s3Key}`
    l.success(`${p} Successfully uploaded JSON metadata to S3: ${s3Url}`)
    
    if (!existsSync(jsonFilePath)) {
      l.dim(`${p} JSON file already cleaned up`)
    } else {
      const { execPromise } = await import('@/node-utils')
      await execPromise(`rm "${jsonFilePath}"`)
      l.dim(`${p} Cleaned up temporary JSON file: ${jsonFilePath}`)
    }
    
    return s3Url
  } catch (error) {
    err(`${p} Failed to create or upload JSON metadata: ${(error as Error).message}`)
    return null
  }
}

async function getOrCreateBucket(options: ProcessingOptions): Promise<string | null> {
  const p = '[text/utils/s3-upload]'
  
  const basePrefix = options.s3BucketPrefix || 'autoshow'
  const accountId = await getAccountId()
  const region = process.env['AWS_REGION'] || 'us-east-1'
  const bucketName = `${basePrefix}-${accountId}-${region}`.toLowerCase()
  
  l.dim(`${p} Checking if bucket exists: ${bucketName}`)
  
  try {
    const checkCommand = `aws s3api head-bucket --bucket "${bucketName}" 2>/dev/null`
    await execPromise(checkCommand)
    l.dim(`${p} Bucket exists: ${bucketName}`)
    return bucketName
  } catch {
    l.dim(`${p} Bucket does not exist, creating: ${bucketName}`)
    
    try {
      let createCommand = `aws s3api create-bucket --bucket "${bucketName}"`
      if (region !== 'us-east-1') {
        createCommand += ` --region "${region}" --create-bucket-configuration LocationConstraint="${region}"`
      }
      
      await execPromise(createCommand)
      l.dim(`${p} Successfully created bucket: ${bucketName}`)
      
      await configureBucketDefaults(bucketName)
      
      return bucketName
    } catch (error) {
      err(`${p} Failed to create bucket: ${(error as Error).message}`)
      return null
    }
  }
}

async function getAccountId(): Promise<string> {
  const p = '[text/utils/s3-upload]'
  
  try {
    const { stdout } = await execPromise('aws sts get-caller-identity --query Account --output text')
    const accountId = stdout.trim()
    l.dim(`${p} Retrieved AWS account ID: ${accountId}`)
    return accountId
  } catch (error) {
    err(`${p} Failed to get AWS account ID: ${(error as Error).message}`)
    return 'unknown'
  }
}

async function configureBucketDefaults(bucketName: string): Promise<void> {
  const p = '[text/utils/s3-upload]'
  l.dim(`${p} Configuring bucket defaults for: ${bucketName}`)
  
  try {
    await execPromise(`aws s3api put-bucket-versioning --bucket "${bucketName}" --versioning-configuration Status=Enabled`)
    l.dim(`${p} Enabled versioning for bucket`)
    
    await execPromise(`aws s3api put-public-access-block --bucket "${bucketName}" --public-access-block-configuration "BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true"`)
    l.dim(`${p} Configured public access block for bucket`)
    
    const lifecyclePolicy = {
      Rules: [{
        ID: 'DeleteOldFiles',
        Status: 'Enabled',
        Expiration: { Days: 90 }
      }]
    }
    const lifecycleJson = JSON.stringify(lifecyclePolicy).replace(/"/g, '\\"')
    await execPromise(`aws s3api put-bucket-lifecycle-configuration --bucket "${bucketName}" --lifecycle-configuration "${lifecycleJson}"`)
    l.dim(`${p} Configured lifecycle policy for bucket`)
    
  } catch (error) {
    l.warn(`${p} Failed to configure some bucket defaults: ${(error as Error).message}`)
  }
}

export async function uploadAllOutputFiles(
  baseFilePath: string,
  options: ProcessingOptions,
  metadata?: UploadMetadata
): Promise<void> {
  const p = '[text/utils/s3-upload]'
  
  if (!options.save || options.save !== 's3') {
    return
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