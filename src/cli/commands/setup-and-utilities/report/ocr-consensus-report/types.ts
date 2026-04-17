import type {
  ExtractionMetadata,
  ExtractionResult,
  OcrTarget,
  PageResult
} from '~/types'
import type { OcrProviderState } from '~/cli/commands/process-steps/step-2-ocr/ocr-run-state'

export type OcrProviderArtifact = {
  id: string
  service: OcrTarget['service']
  model: string
  label: string
  resultPath: string
  metadata: ExtractionMetadata
  result: ExtractionResult
  actualCostCents: number | null
  estimatedCostCents: number | null
  actualProcessingTimeMs: number | null
  estimatedProcessingTimeMs: number | null
}

export type MissingOcrProviderSummary = {
  providerId: string
  label: string
  status: OcrProviderState['status']
  artifactDir: string
  retryable: boolean
  lastError: string | null
}

export type OcrProviderVariant = {
  providerId: string
  label: string
  text: string
  similarity: number
  confidence: number | null
}

export type OcrComparisonRow = {
  id: string
  pageNumber: number
  windowIndex: number
  consensusText: string
  confidence: number
  averageSimilarity: number
  reviewReasons: string[]
  variants: OcrProviderVariant[]
}

export type OcrProviderSummary = {
  providerId: string
  label: string
  similarity: number
  rowCoverage: number
  pageCoverage: number
  totalPages: number
  tokenEstimate: number
  promptTokens: number | null
  completionTokens: number | null
  actualCostCents: number | null
  estimatedCostCents: number | null
  actualProcessingTimeMs: number | null
  estimatedProcessingTimeMs: number | null
}

export type OcrRunMetadataSummary = {
  title: string | null
  author: string | null
  pageCount: number | null
  format: string | null
  completionStatus: string | null
  actualTotalCostCents: number | null
  estimatedTotalCostCents: number | null
  actualTotalProcessingTimeMs: number | null
  estimatedTotalProcessingTimeMs: number | null
  wallTimeMs: number | null
  requestedProviderKeys: string[]
  producedProviderKeys: string[]
}

export type OcrRunConsensusAnalysis = {
  runDir: string
  runLabel: string
  metadata: OcrRunMetadataSummary
  providers: OcrProviderArtifact[]
  missingProviders: MissingOcrProviderSummary[]
  rows: OcrComparisonRow[]
  reviewRows: OcrComparisonRow[]
  providerSummary: OcrProviderSummary[]
  consensusText: string
  averageSimilarity: number
  pageCountMismatch: boolean
}

export type ProviderPageData = {
  pageNumber: number
  normalizedText: string
  tokens: string[]
  confidence: number | null
  localWindows: Array<{ startRel: number, endRel: number }>
}

export type { ExtractionMetadata, ExtractionResult, OcrTarget, PageResult }
