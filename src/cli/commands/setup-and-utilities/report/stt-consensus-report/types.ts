import type {
  PersistedTranscriptionEvidence,
  TranscriptionEvidenceCapabilities,
  TranscriptionEvidenceSegment,
  TranscriptionEvidenceWord
} from '~/types'

export type ProviderTranscript = {
  id: string
  service: string
  model: string
  label: string
  transcriptPath: string
  resultPath: string
  rawText: string
  evidence: PersistedTranscriptionEvidence
  tokenCount: number | null
  actualCostCents: number | null
  estimatedCostCents: number | null
  actualProcessingTimeMs: number | null
  estimatedProcessingTimeMs: number | null
}

export type ProviderVariant = {
  providerId: string
  label: string
  text: string
  similarity: number
  wordCount: number
  speaker?: string
  supportsWindow: boolean
}

export type ComparisonRow = {
  id: string
  startSeconds: number
  endSeconds: number
  startTimestamp: string
  endTimestamp: string
  speaker?: string
  consensusText: string
  confidence: number
  averageSimilarity: number
  reviewReasons: string[]
  variants: ProviderVariant[]
}

export type ProviderSummary = {
  providerId: string
  label: string
  similarity: number
  rowCoverage: number
  wordCount: number
  timingQuality: PersistedTranscriptionEvidence['timingQuality']
  capabilities: TranscriptionEvidenceCapabilities
  tokenCount: number | null
  actualCostCents: number | null
  estimatedCostCents: number | null
  actualProcessingTimeMs: number | null
  estimatedProcessingTimeMs: number | null
}

export type ReviewWindow = {
  rowId: string
  startTimestamp: string
  endTimestamp: string
  speaker?: string
  consensusText: string
  confidence: number
  reasons: string[]
  clipPath: string | null
}

export type RunMetadataSummary = {
  title: string | null
  duration: string | null
  completionStatus: string | null
  actualTotalCostCents: number | null
  estimatedTotalCostCents: number | null
  actualTotalProcessingTimeMs: number | null
  estimatedTotalProcessingTimeMs: number | null
  wallTimeMs: number | null
  requestedProviderKeys: string[]
  producedProviderKeys: string[]
}

export type RunConsensusAnalysis = {
  runDir: string
  runLabel: string
  metadata: RunMetadataSummary
  providers: ProviderTranscript[]
  rows: ComparisonRow[]
  reviewWindows: ReviewWindow[]
  providerSummary: ProviderSummary[]
  consensusText: string
  audioPath: string | null
}

export type TimeObservation = {
  time: number
  providerId: string
}

export type TimeCluster = {
  time: number
  observations: TimeObservation[]
  providerIds: Set<string>
}

export type SpeakerTrack = {
  key: string
  providerId: string
  speaker: string
  intervals: Array<{ start: number, end: number }>
  totalDuration: number
  firstStart: number
}

export type SpeakerCluster = {
  tracks: SpeakerTrack[]
  providerIds: Set<string>
  intervals: Array<{ start: number, end: number }>
  totalDuration: number
  firstStart: number
}

export type WordObservation = {
  providerId: string
  label: string
  text: string
  normalized: string
  midpoint: number
  relative: number
  weight: number
}

export type {
  PersistedTranscriptionEvidence,
  TranscriptionEvidenceCapabilities,
  TranscriptionEvidenceSegment,
  TranscriptionEvidenceWord
}
