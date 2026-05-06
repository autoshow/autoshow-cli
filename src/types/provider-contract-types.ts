import type { ExtractRoute, InputFamily } from './cli-dir-types'
import type { SttBatchSummaryItem } from '../cli/commands/process-steps/step-2-extract/step-2-stt/stt-types'

export type ProviderSpec = {
  provider: string
  model?: string | undefined
}

export type BatchPolicy = {
  enabled?: boolean | undefined
  limit?: number | undefined
  all?: boolean | undefined
  order?: 'newest' | 'oldest' | undefined
  concurrency?: number | undefined
}

export type ResumePolicy = {
  path?: string | undefined
  retryableOnly?: boolean | undefined
}

export type ProviderCheckpoint = {
  schemaVersion: 2
  kind: 'provider-checkpoint'
  provider: string
  model?: string | undefined
  metadata: Record<string, unknown>
}

export type ProviderResult = {
  schemaVersion: 2
  kind: 'provider-result'
  provider: string
  model?: string | undefined
  metadata: Record<string, unknown>
  result: Record<string, unknown>
}

export type RunManifest = {
  schemaVersion: 2
  kind: 'metadata' | 'download' | 'extract' | 'write' | 'tts' | 'image' | 'video' | 'music'
  metadata: Record<string, unknown>
}

export type BatchManifest = {
  schemaVersion: 2
  kind: RunManifest['kind']
  items: Record<string, unknown>[]
  source?: Record<string, unknown> | undefined
}

export type SttBatchSummary = {
  schemaVersion: 2
  kind: 'stt-batch-summary'
  source?: {
    sourceKind?: string | undefined
    sourceUrl?: string | undefined
    title?: string | undefined
    author?: string | undefined
    selectedCount?: number | undefined
  } | undefined
  totals: {
    items: number
    captionBacked: number
    sttFallback: number
    skipped: number
    incomplete: number
    failed: number
  }
  items: SttBatchSummaryItem[]
}

export type ExtractBatchManifestItem = {
  input: string
  inputFamily: InputFamily
  extractRoute?: ExtractRoute | undefined
  childBatchEntry?: {
    route: ExtractRoute
    index: number
  } | undefined
  completionStatus: 'full' | 'incomplete' | 'failed' | 'skipped'
  skipReason?: string | undefined
  outputDir?: string | undefined
}

export type ExtractBatchManifest = {
  schemaVersion: 2
  createdAt: string
  items: ExtractBatchManifestItem[]
  childBatches: {
    media?: string | undefined
    document?: string | undefined
    'x-space'?: string | undefined
  }
}
