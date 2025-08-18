import { uploadToStorage, uploadAllOutputFiles as factoryUploadAllOutputFiles } from './service-factory'
import type { ProcessingOptions, UploadMetadata } from '@/types'

export async function uploadToS3(
  filePath: string,
  options: ProcessingOptions,
  sessionId?: string
): Promise<string | null> {
  return uploadToStorage(filePath, options, sessionId)
}

export async function uploadAllOutputFiles(
  baseFilePath: string,
  options: ProcessingOptions,
  metadata?: UploadMetadata
): Promise<void> {
  return factoryUploadAllOutputFiles(baseFilePath, options, metadata)
}