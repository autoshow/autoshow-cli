import type { ShowNoteMetadata, ProcessingOptions } from '@/text/text-types'

export interface UploadMetadata {
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

export interface R2Token {
  accessKeyId: string
  secretAccessKey: string
  expiresAt: number
}

export interface CloudStorageService {
  uploadFile(filePath: string, options: ProcessingOptions, sessionId?: string): Promise<string | null>
  uploadAllFiles(baseFilePath: string, options: ProcessingOptions, metadata?: UploadMetadata): Promise<void>
  getOrCreateBucket(options: ProcessingOptions): Promise<string | null>
  uploadJsonMetadata(baseFilePath: string, options: ProcessingOptions, metadata: UploadMetadata, sessionId: string): Promise<string | null>
}