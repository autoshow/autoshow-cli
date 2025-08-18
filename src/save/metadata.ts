import { uploadJsonMetadata as factoryUploadJsonMetadata } from './service-factory'
import type { ProcessingOptions } from '@/text/text-types'
import type { UploadMetadata } from '@/save/save-types'

export async function uploadJsonMetadata(
  baseFilePath: string,
  options: ProcessingOptions,
  metadata: UploadMetadata,
  sessionId: string
): Promise<string | null> {
  return factoryUploadJsonMetadata(baseFilePath, options, metadata, sessionId)
}