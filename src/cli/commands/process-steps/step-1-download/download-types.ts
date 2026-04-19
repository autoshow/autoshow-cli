import type { ResolvedBatch } from '~/types/cli-dir-types'
import type { PreparedDocument, DocumentMetadata, ExtractionMetadata, Step3Metadata, WebArticleMetadata } from '~/types/process-types'

export type Step1SourceRef = {
  url?: string
  filePath?: string
}

export type YtDlpAuthMode = 'cookies-file' | 'cookies-from-browser' | 'none'

export type YtDlpListOptions = {
  limit?: number
  all?: boolean
  order?: 'newest' | 'oldest'
}

export type PreparedDocumentMetadata = Pick<PreparedDocument, 'step1Metadata' | 'effectiveFilePath' | 'tempCleanup'>

export type BuildOptsDefaults = {
  defaultTtsEngine?: 'kitten'
}

export type ResolvedProcessTargetPlan =
  | { kind: 'directory', targets: string[] }
  | { kind: 'input_list', resolvedBatch: ResolvedBatch }
  | { kind: 'resolved_batch', resolvedBatch: ResolvedBatch }
  | { kind: 'youtube_collection', targets: string[] }
  | { kind: 'single', target: string }

export type WriteDocumentOutputMetadataOptions = {
  step1: DocumentMetadata
  step2: ExtractionMetadata | ExtractionMetadata[]
  step3: Step3Metadata | Step3Metadata[]
  mistralOcrModel: string | undefined
  glmOcrModel: string | undefined
  llmService: string
  llmModel: string
  llmInputTokenCount: number
  llmOutputTokenCount: number
  artifactFiles: Record<string, string>
  completionStatus?: 'full' | 'incomplete' | 'failed' | undefined
  requestedProviders?: Array<{ service: string, model: string }> | undefined
  providerStates?: Array<Record<string, unknown>> | undefined
  missingProviders?: Array<{ service: string, model: string }> | undefined
  web?: WebArticleMetadata | undefined
  errors?: Array<{ service: string, model: string, message: string }> | undefined
}

export type BatchManifestEntry = Record<string, unknown>

export type BatchManifestErrorEntry = {
  service?: string
  model?: string
  message?: string
}

export type SttManifestProviderStatus = 'succeeded' | 'missing' | 'failed' | 'skipped'

export type SttManifestProviderSummary = {
  label: string
  status: SttManifestProviderStatus
  message?: string
}

export type SttBatchItemSummary = {
  label: string
  completionStatus: 'full' | 'incomplete' | 'failed'
  providers: SttManifestProviderSummary[]
}
