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
  l.dim(`${p} Starting ${options.save} upload for file: ${filePath}`)
  
  if (!options.save || (options.save !== 's3' && options.save !== 'r2')) {
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
      err(`${p} Failed to get or create ${options.save} bucket`)
      return null
    }
    
    const s3Key = `${sessionId}/${jsonFileName}`
    
    l.dim(`${p} Uploading JSON to ${options.save}://${bucketName}/${s3Key}`)
    
    const uploadCommand = buildUploadCommand(jsonFilePath, bucketName, s3Key, options)
    const { stderr } = await execPromise(uploadCommand)
    
    if (stderr && !stderr.includes('upload:')) {
      err(`${p} ${options.save} upload warning: ${stderr}`)
    }
    
    const publicUrl = getPublicUrl(options, bucketName, s3Key)
    l.success(`${p} Successfully uploaded JSON metadata to ${options.save}: ${publicUrl}`)
    
    if (!existsSync(jsonFilePath)) {
      l.dim(`${p} JSON file already cleaned up`)
    } else {
      const { execPromise } = await import('@/node-utils')
      await execPromise(`rm "${jsonFilePath}"`)
      l.dim(`${p} Cleaned up temporary JSON file: ${jsonFilePath}`)
    }
    
    return publicUrl
  } catch (error) {
    err(`${p} Failed to create or upload JSON metadata: ${(error as Error).message}`)
    return null
  }
}

function isValidCloudflareAccountId(accountId: string): boolean {
  const hexPattern = /^[a-f0-9]{32}$/i
  return hexPattern.test(accountId)
}

function checkR2Configuration(): { isValid: boolean; error?: string } {
  const cloudflareAccountId = process.env['CLOUDFLARE_ACCOUNT_ID']
  
  if (!cloudflareAccountId) {
    return { 
      isValid: false, 
      error: 'CLOUDFLARE_ACCOUNT_ID environment variable is not set' 
    }
  }
  
  if (!isValidCloudflareAccountId(cloudflareAccountId)) {
    return {
      isValid: false,
      error: `Invalid CLOUDFLARE_ACCOUNT_ID format. Expected a 32-character hex string, got: ${cloudflareAccountId}`
    }
  }
  
  return { isValid: true }
}

function buildUploadCommand(
  filePath: string,
  bucketName: string,
  s3Key: string,
  options: ProcessingOptions
): string {
  if (options.save === 'r2') {
    const profile = process.env['AWS_PROFILE'] || 'r2'
    return `aws s3 cp "${filePath}" "s3://${bucketName}/${s3Key}" --profile ${profile}${getEndpointFlag(options)}`
  }
  return `aws s3 cp "${filePath}" "s3://${bucketName}/${s3Key}"`
}

function buildBucketCommand(
  command: string,
  bucketName: string,
  options: ProcessingOptions,
  additionalArgs?: string
): string {
  if (options.save === 'r2') {
    const profile = process.env['AWS_PROFILE'] || 'r2'
    return `aws s3api ${command} --bucket "${bucketName}" --profile ${profile}${getEndpointFlag(options)}${additionalArgs || ''}`
  }
  return `aws s3api ${command} --bucket "${bucketName}"${additionalArgs || ''}`
}

async function getOrCreateBucket(options: ProcessingOptions): Promise<string | null> {
  const p = '[text/utils/s3-upload]'
  
  const basePrefix = options.s3BucketPrefix || 'autoshow'
  const accountId = await getAccountId(options)
  const region = getRegion(options)
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
      return null
    }
  }
}

async function getAccountId(options: ProcessingOptions): Promise<string> {
  const p = '[text/utils/s3-upload]'
  
  if (options.save === 'r2') {
    const cloudflareAccountId = process.env['CLOUDFLARE_ACCOUNT_ID']
    if (cloudflareAccountId && isValidCloudflareAccountId(cloudflareAccountId)) {
      l.dim(`${p} Using Cloudflare account ID: ${cloudflareAccountId}`)
      return cloudflareAccountId
    } else if (cloudflareAccountId) {
      err(`${p} Invalid CLOUDFLARE_ACCOUNT_ID format: ${cloudflareAccountId}`)
      err(`${p} Expected a 32-character hex string (e.g., c6494d4164a5eb0cd3848193bd552d68)`)
      return 'invalid-account-id'
    }
  }
  
  try {
    const { stdout } = await execPromise('aws sts get-caller-identity --query Account --output text')
    const accountId = stdout.trim()
    l.dim(`${p} Retrieved AWS account ID: ${accountId}`)
    return accountId
  } catch (error) {
    err(`${p} Failed to get account ID: ${(error as Error).message}`)
    return 'unknown'
  }
}

function getRegion(options: ProcessingOptions): string {
  if (options.save === 'r2') {
    return 'auto'
  }
  return process.env['AWS_REGION'] || 'us-east-1'
}

function getEndpointFlag(options: ProcessingOptions): string {
  if (options.save === 'r2') {
    const accountId = process.env['CLOUDFLARE_ACCOUNT_ID']
    if (!accountId) {
      err('[text/utils/s3-upload] CLOUDFLARE_ACCOUNT_ID is required for R2')
      return ''
    }
    if (!isValidCloudflareAccountId(accountId)) {
      err(`[text/utils/s3-upload] Invalid CLOUDFLARE_ACCOUNT_ID format: ${accountId}`)
      return ''
    }
    return ` --endpoint-url "https://${accountId}.r2.cloudflarestorage.com"`
  }
  return ''
}

function getPublicUrl(options: ProcessingOptions, bucketName: string, s3Key: string): string {
  if (options.save === 'r2') {
    const accountId = process.env['CLOUDFLARE_ACCOUNT_ID'] || 'unknown'
    return `https://${accountId}.r2.cloudflarestorage.com/${bucketName}/${s3Key}`
  }
  return `https://${bucketName}.s3.amazonaws.com/${s3Key}`
}

async function configureBucketDefaults(bucketName: string, options: ProcessingOptions): Promise<void> {
  const p = '[text/utils/s3-upload]'
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

export async function uploadAllOutputFiles(
  baseFilePath: string,
  options: ProcessingOptions,
  metadata?: UploadMetadata
): Promise<void> {
  const p = '[text/utils/s3-upload]'
  
  if (!options.save || (options.save !== 's3' && options.save !== 'r2')) {
    return
  }
  
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