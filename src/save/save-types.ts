import type { ShowNoteMetadata } from '@/text/text-types'

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