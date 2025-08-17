import { l } from '@/logging'
import { uploadJsonMetadata as factoryUploadJsonMetadata } from './service-factory'
import type { ProcessingOptions, UploadMetadata } from '@/types'

export async function uploadJsonMetadata(
  baseFilePath: string,
  options: ProcessingOptions,
  metadata: UploadMetadata,
  sessionId: string
): Promise<string | null> {
  const p = '[save/metadata]'
  l.dim(`${p} Delegating metadata upload to service factory`)
  
  return factoryUploadJsonMetadata(baseFilePath, options, metadata, sessionId)
}