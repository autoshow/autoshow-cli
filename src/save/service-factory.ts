import { err } from '@/logging'
import type { ProcessingOptions } from '@/text/text-types'
import type { UploadMetadata } from '@/save/save-types'

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
    return null
  }
  
  switch (options.save) {
    case 's3':
      return new AwsStorageService()
    case 'r2':
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
  const service = createStorageService(options)
  if (!service) {
    return null
  }
  
  return service.uploadFile(filePath, options, sessionId)
}

export async function uploadAllOutputFiles(
  baseFilePath: string,
  options: ProcessingOptions,
  metadata?: UploadMetadata
): Promise<void> {
  const service = createStorageService(options)
  if (!service) {
    return
  }
  
  return service.uploadAllFiles(baseFilePath, options, metadata)
}

export async function getOrCreateBucket(options: ProcessingOptions): Promise<string | null> {
  const p = '[save/service-factory]'
  
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
  
  const service = createStorageService(options)
  if (!service) {
    err(`${p} No storage service available`)
    return null
  }
  
  return service.uploadJsonMetadata(baseFilePath, options, metadata, sessionId)
}