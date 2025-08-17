import { l } from '@/logging'
import { uploadToStorage, uploadAllOutputFiles as factoryUploadAllOutputFiles } from './service-factory'
import type { ProcessingOptions, UploadMetadata } from '@/types'

export async function uploadToS3(
  filePath: string,
  options: ProcessingOptions,
  sessionId?: string
): Promise<string | null> {
  const p = '[save/upload]'
  l.dim(`${p} Delegating file upload to service factory`)
  
  return uploadToStorage(filePath, options, sessionId)
}

export async function uploadAllOutputFiles(
  baseFilePath: string,
  options: ProcessingOptions,
  metadata?: UploadMetadata
): Promise<void> {
  const p = '[save/upload]'
  l.dim(`${p} Delegating all file uploads to service factory`)
  
  return factoryUploadAllOutputFiles(baseFilePath, options, metadata)
}