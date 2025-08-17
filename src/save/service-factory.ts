import { l, err } from '@/logging'
import type { ProcessingOptions, UploadMetadata } from '@/types'

export interface CloudStorageService {
  uploadFile(filePath: string, options: ProcessingOptions, sessionId?: string): Promise<string | null>
  uploadAllFiles(baseFilePath: string, options: ProcessingOptions, metadata?: UploadMetadata): Promise<void>
  getOrCreateBucket(options: ProcessingOptions): Promise<string | null>
  uploadJsonMetadata(baseFilePath: string, options: ProcessingOptions, metadata: UploadMetadata, sessionId: string): Promise<string | null>
}

class AwsStorageService implements CloudStorageService {
  async uploadFile(filePath: string, options: ProcessingOptions, sessionId?: string): Promise<string | null> {
    const { uploadToAws } = await import('./aws/upload')
    return uploadToAws(filePath, options, sessionId)
  }
  
  async uploadAllFiles(baseFilePath: string, options: ProcessingOptions, metadata?: UploadMetadata): Promise<void> {
    const { uploadAllAwsOutputFiles } = await import('./aws/upload')
    return uploadAllAwsOutputFiles(baseFilePath, options, metadata)
  }
  
  async getOrCreateBucket(options: ProcessingOptions): Promise<string | null> {
    const { getOrCreateAwsBucket } = await import('./aws/bucket')
    return getOrCreateAwsBucket(options)
  }
  
  async uploadJsonMetadata(baseFilePath: string, options: ProcessingOptions, metadata: UploadMetadata, sessionId: string): Promise<string | null> {
    const { uploadAwsJsonMetadata } = await import('./aws/metadata')
    return uploadAwsJsonMetadata(baseFilePath, options, metadata, sessionId)
  }
}

class CloudflareStorageService implements CloudStorageService {
  async uploadFile(filePath: string, options: ProcessingOptions, sessionId?: string): Promise<string | null> {
    const { uploadToCloudflare } = await import('./cloudflare/upload')
    return uploadToCloudflare(filePath, options, sessionId)
  }
  
  async uploadAllFiles(baseFilePath: string, options: ProcessingOptions, metadata?: UploadMetadata): Promise<void> {
    const { uploadAllCloudflareOutputFiles } = await import('./cloudflare/upload')
    return uploadAllCloudflareOutputFiles(baseFilePath, options, metadata)
  }
  
  async getOrCreateBucket(options: ProcessingOptions): Promise<string | null> {
    const { getOrCreateCloudflareBucket } = await import('./cloudflare/bucket')
    return getOrCreateCloudflareBucket(options)
  }
  
  async uploadJsonMetadata(baseFilePath: string, options: ProcessingOptions, metadata: UploadMetadata, sessionId: string): Promise<string | null> {
    const { uploadCloudflareJsonMetadata } = await import('./cloudflare/metadata')
    return uploadCloudflareJsonMetadata(baseFilePath, options, metadata, sessionId)
  }
}

export function createStorageService(options: ProcessingOptions): CloudStorageService | null {
  const p = '[save/service-factory]'
  
  if (!options.save || !['s3', 'r2'].includes(options.save)) {
    l.dim(`${p} No cloud storage service specified`)
    return null
  }
  
  switch (options.save) {
    case 's3':
      l.dim(`${p} Creating AWS S3 storage service`)
      return new AwsStorageService()
    case 'r2':
      l.dim(`${p} Creating Cloudflare R2 storage service`)
      return new CloudflareStorageService()
    default:
      err(`${p} Unknown storage service: ${options.save}`)
      return null
  }
}

export async function uploadToStorage(
  filePath: string,
  options: ProcessingOptions,
  sessionId?: string
): Promise<string | null> {
  const p = '[save/service-factory]'
  l.dim(`${p} Uploading file to storage service: ${options.save}`)
  
  const service = createStorageService(options)
  if (!service) {
    l.dim(`${p} No storage service available`)
    return null
  }
  
  return service.uploadFile(filePath, options, sessionId)
}

export async function uploadAllOutputFiles(
  baseFilePath: string,
  options: ProcessingOptions,
  metadata?: UploadMetadata
): Promise<void> {
  const p = '[save/service-factory]'
  l.dim(`${p} Uploading all output files to storage service: ${options.save}`)
  
  const service = createStorageService(options)
  if (!service) {
    l.dim(`${p} No storage service available`)
    return
  }
  
  return service.uploadAllFiles(baseFilePath, options, metadata)
}

export async function getOrCreateBucket(options: ProcessingOptions): Promise<string | null> {
  const p = '[save/service-factory]'
  l.dim(`${p} Getting or creating bucket for storage service: ${options.save}`)
  
  const service = createStorageService(options)
  if (!service) {
    err(`${p} No storage service available`)
    return null
  }
  
  return service.getOrCreateBucket(options)
}

export async function uploadJsonMetadata(
  baseFilePath: string,
  options: ProcessingOptions,
  metadata: UploadMetadata,
  sessionId: string
): Promise<string | null> {
  const p = '[save/service-factory]'
  l.dim(`${p} Uploading JSON metadata to storage service: ${options.save}`)
  
  const service = createStorageService(options)
  if (!service) {
    err(`${p} No storage service available`)
    return null
  }
  
  return service.uploadJsonMetadata(baseFilePath, options, metadata, sessionId)
}